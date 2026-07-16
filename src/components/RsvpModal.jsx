import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  getRsvpImagePublicUrl,
  uploadRsvpImageFile,
  validateRsvpImageFile,
} from '../lib/rsvpImages.js'
import {
  describeRsvpAccessError,
  normalizePhoneNumber,
  sanitizeEpisodeCode,
  unlockEpisodeRsvp,
} from '../lib/rsvpAccessApi.js'
import { describeSignupError, saveCodeBasedRsvp } from '../lib/signupApi.js'

function titleForStep(step) {
  if (step === 'phone') return 'RSVP'
  if (step === 'code') return 'Enter the event code'
  if (step === 'details') return 'You’re in'
  return 'RSVP confirmed'
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="rsvp-field-error" role="alert">
      {message}
    </p>
  )
}

/**
 * @param {{ open: boolean, onRequestClose: () => void, onSaved?: () => void }} props
 */
export function RsvpModal({ open, onRequestClose, onSaved }) {
  const dialogRef = useRef(null)
  const uploadIdRef = useRef('')
  const titleId = useId()
  const [step, setStep] = useState('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [episodeCode, setEpisodeCode] = useState('')
  const [privateDetails, setPrivateDetails] = useState(null)
  const [fullName, setFullName] = useState('')
  const [profileMessage, setProfileMessage] = useState('')
  const [imageObjectPath, setImageObjectPath] = useState(null)
  const [localImageFile, setLocalImageFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const clearPreview = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
  }, [])

  const reset = useCallback(() => {
    setStep('phone')
    setBusy(false)
    setError(null)
    setPhoneInput('')
    setPhone('')
    setEpisodeCode('')
    setPrivateDetails(null)
    setFullName('')
    setProfileMessage('')
    setImageObjectPath(null)
    setLocalImageFile(null)
    setFieldErrors({})
    clearPreview()
    uploadIdRef.current = crypto.randomUUID()
  }, [clearPreview])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      uploadIdRef.current = crypto.randomUUID()
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const clearFieldError = (field) => {
    setError(null)
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const continueWithPhone = () => {
    const normalized = normalizePhoneNumber(phoneInput)
    setError(null)
    if (!normalized) {
      setFieldErrors({ phone: 'Enter a valid mobile number.' })
      return
    }
    setPhone(normalized)
    setFieldErrors({})
    setStep('code')
  }

  const unlock = async () => {
    setError(null)
    if (!episodeCode) {
      setFieldErrors({ code: 'Enter this session’s RSVP code.' })
      return
    }
    setBusy(true)
    try {
      const result = await unlockEpisodeRsvp(phone, episodeCode)
      setPrivateDetails({
        address: result.address ?? '',
        instructions: result.instructions ?? '',
      })
      setFullName(result.full_name ?? '')
      setProfileMessage(result.profile_message ?? '')
      setImageObjectPath(result.image_object_path ?? null)
      setStep('details')
    } catch (err) {
      setError(describeRsvpAccessError(err))
    } finally {
      setBusy(false)
    }
  }

  const chooseImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      validateRsvpImageFile(file)
      clearFieldError('image')
      clearPreview()
      setLocalImageFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    } catch (err) {
      setFieldErrors((current) => ({ ...current, image: err.message }))
    }
  }

  const confirmRsvp = async () => {
    setError(null)
    if (!fullName.trim()) {
      setFieldErrors((current) => ({ ...current, fullName: 'Add your name to continue.' }))
      return
    }
    setBusy(true)
    try {
      let path = imageObjectPath
      if (localImageFile) {
        path = await uploadRsvpImageFile(localImageFile, uploadIdRef.current)
        setImageObjectPath(path)
      }
      await saveCodeBasedRsvp({
        phone,
        code: episodeCode,
        fullName,
        profileMessage,
        imageObjectPath: path,
      })
      onSaved?.()
      setStep('success')
    } catch (err) {
      setError(
        /invalid_rsvp_code/i.test(String(err?.message))
          ? 'That RSVP code is no longer valid.'
          : describeSignupError(err),
      )
    } finally {
      setBusy(false)
    }
  }

  const imageUrl = previewUrl ?? (imageObjectPath ? getRsvpImagePublicUrl(imageObjectPath) : null)

  return (
    <dialog
      ref={dialogRef}
      className="rsvp-dialog rsvp-dialog--phone"
      aria-labelledby={titleId}
      onClose={onRequestClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="rsvp-dialog-panel" onClick={(event) => event.stopPropagation()}>
        <header className="rsvp-dialog-header">
          <h2 id={titleId} className="rsvp-dialog-title">
            {titleForStep(step)}
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

        <div className="rsvp-progress" aria-label="RSVP progress">
          <span className={step === 'phone' ? 'active' : ''}>1</span>
          <i />
          <span className={step === 'code' ? 'active' : ''}>2</span>
          <i />
          <span className={step === 'details' || step === 'success' ? 'active' : ''}>3</span>
        </div>

        {error ? <p className="rsvp-error">{error}</p> : null}

        {step === 'phone' ? (
          <div className="rsvp-step">
            <p className="rsvp-lede">
              Enter your phone number. Returning guests will get their saved profile back.
            </p>
            <label className="rsvp-label" htmlFor="rsvp-phone">
              Mobile number
            </label>
            <input
              id="rsvp-phone"
              className={`rsvp-input rsvp-input--mobile${fieldErrors.phone ? ' rsvp-input--invalid' : ''}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              placeholder="(555) 555-5555"
              value={phoneInput}
              onChange={(event) => {
                setPhoneInput(event.target.value)
                clearFieldError('phone')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') continueWithPhone()
              }}
            />
            <FieldError id="phone-error" message={fieldErrors.phone} />
            <button
              type="button"
              className="episode-rsvp-btn rsvp-primary-mobile"
              onClick={continueWithPhone}
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 'code' ? (
          <div className="rsvp-step">
            <p className="rsvp-lede">
              Enter the code shared by the host to unlock the address.
            </p>
            <label className="rsvp-label" htmlFor="rsvp-code">
              Event code
            </label>
            <input
              id="rsvp-code"
              className={`rsvp-input rsvp-code-input${fieldErrors.code ? ' rsvp-input--invalid' : ''}`}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
              maxLength={12}
              placeholder="SUNSET"
              value={episodeCode}
              onChange={(event) => {
                setEpisodeCode(sanitizeEpisodeCode(event.target.value))
                clearFieldError('code')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void unlock()
              }}
            />
            <FieldError id="code-error" message={fieldErrors.code} />
            <button
              type="button"
              className="episode-rsvp-btn rsvp-primary-mobile"
              disabled={busy}
              onClick={() => void unlock()}
            >
              {busy ? 'Checking…' : 'Unlock details'}
            </button>
            <button type="button" className="rsvp-text-button" onClick={() => setStep('phone')}>
              Change phone number
            </button>
          </div>
        ) : null}

        {step === 'details' ? (
          <div className="rsvp-step">
            <section className="rsvp-private-details">
              <p className="rsvp-private-eyebrow">Private event details</p>
              {privateDetails?.address ? <h3>{privateDetails.address}</h3> : null}
              {privateDetails?.instructions ? <p>{privateDetails.instructions}</p> : null}
            </section>

            <label className="rsvp-label" htmlFor="rsvp-name">
              Your name
            </label>
            <input
              id="rsvp-name"
              className={`rsvp-input${fieldErrors.fullName ? ' rsvp-input--invalid' : ''}`}
              autoComplete="name"
              placeholder="What should we call you?"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value)
                clearFieldError('fullName')
              }}
            />
            <FieldError id="name-error" message={fieldErrors.fullName} />

            <div className="rsvp-profile-photo-row">
              {imageUrl ? (
                <img className="rsvp-profile-avatar" src={imageUrl} alt="Your profile" />
              ) : (
                <div className="rsvp-profile-avatar rsvp-profile-avatar--empty" aria-hidden="true">
                  {fullName.trim().charAt(0) || '♡'}
                </div>
              )}
              <div>
                <label className="rsvp-file-pill" htmlFor="rsvp-profile-photo">
                  {imageUrl ? 'Change photo' : 'Add a photo'}
                </label>
                <input
                  id="rsvp-profile-photo"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={chooseImage}
                />
                <FieldError id="image-error" message={fieldErrors.image} />
              </div>
            </div>

            <label className="rsvp-label" htmlFor="rsvp-message">
              Aura farm message <span className="rsvp-optional">(optional)</span>
            </label>
            <textarea
              id="rsvp-message"
              className="rsvp-textarea"
              rows={2}
              maxLength={160}
              placeholder="Say hi to everyone…"
              value={profileMessage}
              onChange={(event) => setProfileMessage(event.target.value)}
            />

            <button
              type="button"
              className="episode-rsvp-btn rsvp-primary-mobile"
              disabled={busy}
              onClick={() => void confirmRsvp()}
            >
              {busy ? 'Saving…' : 'Confirm RSVP'}
            </button>
          </div>
        ) : null}

        {step === 'success' ? (
          <div className="rsvp-step rsvp-success">
            <span className="rsvp-success-icon" aria-hidden="true">
              ✓
            </span>
            <p className="rsvp-lede">Your spot is saved for this session.</p>
            <button
              type="button"
              className="episode-rsvp-btn rsvp-primary-mobile"
              onClick={() => dialogRef.current?.close()}
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
    </dialog>
  )
}
