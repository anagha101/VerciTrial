import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AuraFarmView } from './AuraFarmView.jsx'
import {
  getRsvpImagePublicUrl,
  uploadRsvpImageFile,
  validateRsvpImageFile,
} from '../lib/rsvpImages.js'
import {
  createSunsetSignup,
  fetchSignupApprovalStatus,
  fetchSignupByRsvpCode,
  listAuraFarmSignups,
  notifyAdminOfRsvp,
  sanitizeRsvpCodeInput,
  touchSignupLastRsvp,
  updateSignupProfileByCode,
} from '../lib/signupApi.js'
import {
  describeEpisodeLoadError,
  fetchActiveEpisodeInfo,
  fetchCurrentEpisodeNumber,
} from '../lib/episodeApi.js'

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function phoneDigitsOk(phone) {
  return phone.replace(/\D/g, '').length >= 7
}

function stepTitle(step) {
  if (step === 'intro') return '\u00a0'
  if (step === 'gate') return 'RSVP'
  if (step === 'new-rsvp') return 'New RSVP'
  if (step === 'pending') return 'Pending'
  if (step === 'profile') return 'Your profile'
  if (step === 'aura-farm') return 'Aura Farm'
  return 'RSVP'
}

/**
 * @param {{
 *   open: boolean
 *   onRequestClose: () => void
 *   onSaved?: () => void
 * }} props
 */
export function RsvpModal({ open, onRequestClose, onSaved }) {
  const dialogRef = useRef(null)
  const fileInputRef = useRef(null)
  const uploadSessionIdRef = useRef('')
  const titleId = useId()

  const [step, setStep] = useState('intro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [episodeInfo, setEpisodeInfo] = useState(null)
  const [episodeNumber, setEpisodeNumber] = useState(null)
  const [episodeLoading, setEpisodeLoading] = useState(false)
  const [episodeError, setEpisodeError] = useState(null)

  const [codeInput, setCodeInput] = useState('')
  const [rsvpCode, setRsvpCode] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [heardAbout, setHeardAbout] = useState('')
  const [primaryContact, setPrimaryContact] = useState(null)

  const [profileMessage, setProfileMessage] = useState('')
  const [localImageFile, setLocalImageFile] = useState(null)
  const [blobPreviewUrl, setBlobPreviewUrl] = useState(null)
  const [imageObjectPath, setImageObjectPath] = useState(null)

  const [auraFarmItems, setAuraFarmItems] = useState([])

  const revokeBlobPreview = useCallback(() => {
    setBlobPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const resetForm = useCallback(() => {
    setStep('intro')
    setBusy(false)
    setError(null)
    setCodeInput('')
    setRsvpCode('')
    setFullName('')
    setEmail('')
    setPhone('')
    setHeardAbout('')
    setPrimaryContact(null)
    setProfileMessage('')
    setLocalImageFile(null)
    revokeBlobPreview()
    setImageObjectPath(null)
    setAuraFarmItems([])
  }, [revokeBlobPreview])

  const loadSignupIntoState = useCallback(
    (row) => {
      setRsvpCode(row.code ?? '')
      setFullName(row.full_name ?? '')
      setEmail(row.email ?? '')
      setPhone(row.phone ?? '')
      setHeardAbout(row.heard_about ?? '')
      setPrimaryContact(row.primary_contact ?? null)
      setProfileMessage(row.profile_message ?? '')
      setImageObjectPath(row.image_object_path ?? null)
      setLocalImageFile(null)
      revokeBlobPreview()
    },
    [revokeBlobPreview],
  )

  useEffect(() => {
    if (open) uploadSessionIdRef.current = crypto.randomUUID()
  }, [open])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
    } else if (el.open) {
      el.close()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      resetForm()
      setEpisodeInfo(null)
      setEpisodeError(null)
      setEpisodeLoading(false)
      setEpisodeNumber(null)
    }
  }, [open, resetForm])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setEpisodeLoading(true)
    setEpisodeError(null)
    Promise.all([fetchActiveEpisodeInfo(), fetchCurrentEpisodeNumber()])
      .then(([info, ep]) => {
        if (!cancelled) {
          setEpisodeInfo(info)
          setEpisodeNumber(ep)
        }
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setEpisodeError(describeEpisodeLoadError(e))
      })
      .finally(() => {
        if (!cancelled) setEpisodeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || step !== 'pending' || !rsvpCode) return
    const poll = async () => {
      try {
        const status = await fetchSignupApprovalStatus(rsvpCode)
        if (status === 'approved') {
          const row = await fetchSignupByRsvpCode(rsvpCode)
          if (row) {
            loadSignupIntoState(row)
            setStep('profile')
          }
        } else if (status === 'rejected') {
          setError('Your RSVP was not approved. Reach out if you think this is a mistake.')
        }
      } catch (e) {
        console.error(e)
      }
    }
    const id = setInterval(() => void poll(), 8000)
    void poll()
    return () => clearInterval(id)
  }, [open, step, rsvpCode, loadSignupIntoState])

  const goToProfileOrPending = (row) => {
    if (row.approval_status === 'approved') {
      setStep('profile')
    } else if (row.approval_status === 'pending') {
      setStep('pending')
    } else {
      setError('This RSVP was not approved.')
    }
  }

  const handleLookupCode = async () => {
    setError(null)
    const c = sanitizeRsvpCodeInput(codeInput)
    if (c.length !== 4) {
      setError('Enter your 4-digit code.')
      return
    }
    setBusy(true)
    try {
      const row = await fetchSignupByRsvpCode(c)
      if (!row) {
        setError('No RSVP matches that code.')
        return
      }
      if (episodeNumber != null) await touchSignupLastRsvp(c, episodeNumber)
      loadSignupIntoState(row)
      goToProfileOrPending(row)
    } catch (e) {
      setError(e?.message ?? 'Could not look up that code.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmitNewRsvp =
    fullName.trim().length > 0 &&
    validEmail(email) &&
    phoneDigitsOk(phone) &&
    heardAbout.trim().length > 0 &&
    (primaryContact === 'email' || primaryContact === 'phone')

  const handleSubmitNewRsvp = async () => {
    if (!canSubmitNewRsvp || episodeNumber == null) return
    setError(null)
    setBusy(true)
    try {
      const created = await createSunsetSignup({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        heard_about: heardAbout.trim(),
        primary_contact: primaryContact,
        last_rsvp: episodeNumber,
      })
      const row = await fetchSignupByRsvpCode(created.code)
      if (row) loadSignupIntoState(row)
      else setRsvpCode(created.code)
      void notifyAdminOfRsvp(created.id)
      setStep('pending')
      onSaved?.()
    } catch (e) {
      setError(e?.message ?? 'Could not submit RSVP.')
    } finally {
      setBusy(false)
    }
  }

  const onImageFileChosen = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    setError(null)
    if (!f) return
    try {
      validateRsvpImageFile(f)
    } catch (err) {
      setError(err?.message ?? 'Invalid image.')
      return
    }
    setBlobPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(f)
    })
    setLocalImageFile(f)
  }

  const handleSaveProfile = async () => {
    if (!rsvpCode) return
    setError(null)
    setBusy(true)
    try {
      let path = imageObjectPath
      if (localImageFile) {
        path = await uploadRsvpImageFile(localImageFile, uploadSessionIdRef.current)
        revokeBlobPreview()
        setLocalImageFile(null)
        setImageObjectPath(path)
      }
      await updateSignupProfileByCode(rsvpCode, {
        profile_message: profileMessage,
        image_object_path: path,
      })
      const row = await fetchSignupByRsvpCode(rsvpCode)
      if (row) loadSignupIntoState(row)
      onSaved?.()
    } catch (e) {
      setError(e?.message ?? 'Could not save profile.')
    } finally {
      setBusy(false)
    }
  }

  const openAuraFarm = async () => {
    if (episodeNumber == null) return
    setError(null)
    setBusy(true)
    try {
      const rows = await listAuraFarmSignups(episodeNumber)
      setAuraFarmItems(rows)
      setStep('aura-farm')
    } catch (e) {
      setError(e?.message ?? 'Could not load aura farm.')
    } finally {
      setBusy(false)
    }
  }

  const thumb =
    blobPreviewUrl ?? (imageObjectPath ? getRsvpImagePublicUrl(imageObjectPath) : null)

  const wide = step === 'aura-farm'

  return (
    <dialog
      ref={dialogRef}
      className={`rsvp-dialog${wide ? ' rsvp-dialog--wide' : ''}`}
      aria-labelledby={titleId}
      onClose={onRequestClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close()
      }}
    >
      <div className="rsvp-dialog-panel" onClick={(e) => e.stopPropagation()}>
        <header className="rsvp-dialog-header">
          <h2 id={titleId} className="rsvp-dialog-title">
            {stepTitle(step)}
          </h2>
          <button
            type="button"
            className="rsvp-close-btn"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {error ? <p className="rsvp-error">{error}</p> : null}

        {step === 'intro' ? (
          <div className="rsvp-step episode-intro-step">
            {episodeLoading ? (
              <p className="episode-intro-loading gradient-rainbow-text event-hero-tagline">
                Loading…
              </p>
            ) : null}
            {episodeError ? <p className="rsvp-error">{episodeError}</p> : null}
            {episodeInfo && !episodeLoading ? (
              <>
                <div className="episode-intro">
                  {episodeInfo.title ? (
                    <h3 className="episode-intro-title gradient-rainbow-text event-hero-tagline">
                      {episodeInfo.title}
                    </h3>
                  ) : null}
                  {episodeInfo.subtitle ? (
                    <p className="episode-intro-subtitle gradient-rainbow-text">
                      {episodeInfo.subtitle}
                    </p>
                  ) : null}
                  {episodeInfo.time ? (
                    <p className="episode-intro-time">{episodeInfo.time}</p>
                  ) : null}
                  {episodeInfo.description ? (
                    <p className="episode-intro-description">{episodeInfo.description}</p>
                  ) : null}
                </div>
                <div className="rsvp-actions">
                  <button type="button" className="episode-rsvp-btn" onClick={() => setStep('gate')}>
                    RSVP for address
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {step === 'gate' ? (
          <div className="rsvp-step">
            <p className="rsvp-lede">RSVPed before? Enter your unique code.</p>
            <input
              className="rsvp-input rsvp-code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="0000"
              value={codeInput}
              onChange={(e) => setCodeInput(sanitizeRsvpCodeInput(e.target.value))}
            />
            <div className="rsvp-actions">
              <button
                type="button"
                className="episode-rsvp-btn"
                onClick={() => void handleLookupCode()}
                disabled={busy || codeInput.length !== 4}
              >
                {busy ? 'Looking up…' : 'Continue'}
              </button>
            </div>
            <div className="rsvp-actions">
              <button type="button" className="rsvp-secondary" onClick={() => setStep('new-rsvp')}>
                New RSVP
              </button>
            </div>
          </div>
        ) : null}

        {step === 'new-rsvp' ? (
          <div className="rsvp-step">
            <label className="rsvp-label" htmlFor="full-name">
              Name
            </label>
            <input
              id="full-name"
              className="rsvp-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            <label className="rsvp-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="rsvp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label className="rsvp-check">
              <input
                type="checkbox"
                checked={primaryContact === 'email'}
                onChange={() => setPrimaryContact('email')}
              />
              Primary contact to receive address details
            </label>
            <label className="rsvp-label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="rsvp-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
            <label className="rsvp-check">
              <input
                type="checkbox"
                checked={primaryContact === 'phone'}
                onChange={() => setPrimaryContact('phone')}
              />
              Primary contact to receive address details
            </label>
            <label className="rsvp-label" htmlFor="heard-about">
              How did you hear about Sunday Sunset Sessions?
            </label>
            <input
              id="heard-about"
              className="rsvp-input"
              value={heardAbout}
              onChange={(e) => setHeardAbout(e.target.value)}
            />
            <div className="rsvp-actions split">
              <button type="button" className="rsvp-secondary" onClick={() => setStep('gate')}>
                Back
              </button>
              <button
                type="button"
                className="episode-rsvp-btn"
                onClick={() => void handleSubmitNewRsvp()}
                disabled={!canSubmitNewRsvp || busy}
              >
                {busy ? 'Submitting…' : 'Submit RSVP'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 'pending' ? (
          <div className="rsvp-step">
            <p className="rsvp-lede">
              Thanks{fullName ? `, ${fullName}` : ''}! Your RSVP is pending approval. We will text or
              email you at your primary contact once confirmed.
            </p>
            {rsvpCode ? (
              <p className="rsvp-hint">
                Your code: <strong className="rsvp-code">{rsvpCode}</strong>
              </p>
            ) : null}
            <p className="rsvp-body muted">This page checks for approval every few seconds.</p>
          </div>
        ) : null}

        {step === 'profile' ? (
          <div className="rsvp-step">
            <p className="rsvp-lede">
              Welcome back{fullName ? `, ${fullName}` : ''}!
              {rsvpCode ? (
                <>
                  {' '}
                  Code: <strong className="rsvp-code">{rsvpCode}</strong>
                </>
              ) : null}
            </p>
            <p className="rsvp-body muted">Add a photo and a short message (not an offering).</p>
            {thumb ? (
              <div className="rsvp-image-preview-wrap">
                <img src={thumb} alt="" className="rsvp-image-preview" />
              </div>
            ) : (
              <div className="rsvp-image-placeholder">No photo yet</div>
            )}
            <input
              ref={fileInputRef}
              id={`${titleId}-profile-file`}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onImageFileChosen}
            />
            <label htmlFor={`${titleId}-profile-file`} className="rsvp-file-pill">
              {thumb ? 'Change photo' : 'Upload photo'}
            </label>
            <label className="rsvp-label" htmlFor="profile-message">
              Message
            </label>
            <textarea
              id="profile-message"
              className="rsvp-textarea"
              rows={3}
              value={profileMessage}
              onChange={(e) => setProfileMessage(e.target.value)}
              placeholder="Say hi to the group…"
            />
            <div className="rsvp-actions split">
              <button
                type="button"
                className="rsvp-secondary"
                onClick={() => void handleSaveProfile()}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="episode-rsvp-btn" onClick={() => void openAuraFarm()}>
                Aura Farm
              </button>
            </div>
          </div>
        ) : null}

        {step === 'aura-farm' ? (
          <div className="rsvp-step">
            <AuraFarmView items={auraFarmItems} />
            <div className="rsvp-actions">
              <button type="button" className="rsvp-secondary" onClick={() => setStep('profile')}>
                Back to profile
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  )
}
