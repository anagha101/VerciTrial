import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  getRsvpImagePublicUrl,
  uploadRsvpImageFile,
  validateRsvpImageFile,
} from '../lib/rsvpImages.js'
import {
  checkSignupContactAvailable,
  deleteSignupByCode,
  generateEditCode,
  insertSignup,
  sanitizeEditCodeInput,
  updateSignupByCode,
} from '../lib/signupApi.js'

const STEPS = ['event', 'intro', 'item', 'contact', 'image', 'extras', 'success']

const EVENT_DESCRIPTION =
  'An introductory meeting for new members to connect and set intentions for a summer of creative and career growth with verci!'

const EVENT_DATE_LINE = 'Tuesday, May 19'
const EVENT_TIME_LINE = '5:30pm–8:00pm EST'
const EVENT_LOCATION_LINE = 'Verci Flatiron'

const INTRO_COPY = (
  <>
    <p className="rsvp-lede">
      For this gathering, we are asking everyone to bring an "offering" of <strong>one physical item</strong>{' '}
      that represents your intentions for a summer of growth and connection with Verci.
    </p>
    <p className="rsvp-body">
      That might connect to a story you want to tell, a goal you are chasing, a reflection
      you've been having, or anything else that feels important to you right now. The idea
      is to share your story and what you're looking to get out of the Verci experience.
    </p>
  </>
)

function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function phoneDigitsOk(phone) {
  const d = phone.replace(/\D/g, '')
  if (d.length === 0) return true
  return d.length >= 7
}

/**
 * @param {{
 *   open: boolean
 *   onRequestClose: () => void
 *   mode: 'create' | 'edit'
 *   initialRecord: object | null
 *   onSaved: () => void
 * }} props
 */
export function RsvpModal({
  open,
  onRequestClose,
  mode,
  initialRecord,
  onSaved,
}) {
  const dialogRef = useRef(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const uploadSessionIdRef = useRef('')
  const titleId = useId()
  const [step, setStep] = useState('event')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)

  const [symbolicItem, setSymbolicItem] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [tenureResponse, setTenureResponse] = useState('')
  const [favoriteSnack, setFavoriteSnack] = useState('')
  const [savedEditCode, setSavedEditCode] = useState('')
  const [localImageFile, setLocalImageFile] = useState(null)
  const [blobPreviewUrl, setBlobPreviewUrl] = useState(null)
  const [imageObjectPath, setImageObjectPath] = useState(null)

  const revokeBlobPreview = useCallback(() => {
    setBlobPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const resetForm = useCallback(() => {
    setStep('event')
    setBusy(false)
    setRemoving(false)
    setError(null)
    setSymbolicItem('')
    setFullName('')
    setEmail('')
    setPhone('')
    setTenureResponse('')
    setFavoriteSnack('')
    setSavedEditCode('')
    setLocalImageFile(null)
    revokeBlobPreview()
    setImageObjectPath(null)
  }, [revokeBlobPreview])

  useEffect(() => {
    if (open) {
      uploadSessionIdRef.current = crypto.randomUUID()
    }
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
      return
    }
    if (mode === 'edit' && initialRecord) {
      setSymbolicItem(initialRecord.symbolic_item ?? '')
      setFullName(initialRecord.full_name ?? '')
      setEmail(initialRecord.email ?? '')
      setPhone(initialRecord.phone ?? '')
      setTenureResponse(initialRecord.tenure_response ?? '')
      setFavoriteSnack(initialRecord.favorite_snack ?? '')
      setSavedEditCode(initialRecord.edit_code ?? '')
      const imgPath = initialRecord.image_object_path ?? null
      setImageObjectPath(imgPath)
      setLocalImageFile(null)
      revokeBlobPreview()
      setStep('intro')
      setError(null)
    } else if (mode === 'create') {
      resetForm()
    }
  }, [open, mode, initialRecord, resetForm, revokeBlobPreview])

  const goNext = useCallback(async () => {
    setError(null)
    const i = STEPS.indexOf(step)
    if (i < 0 || i >= STEPS.length - 1) return

    if (step === 'contact') {
      if (!(fullName.trim().length > 0 && validEmail(email) && phoneDigitsOk(phone))) return
      setBusy(true)
      try {
        const excludeCode =
          mode === 'edit'
            ? sanitizeEditCodeInput(initialRecord?.edit_code ?? savedEditCode)
            : null
        const phoneTrim = phone.trim()
        const dup = await checkSignupContactAvailable(
          email.trim(),
          phoneTrim === '' ? null : phoneTrim,
          excludeCode && excludeCode.length === 5 ? excludeCode : null,
        )
        if (dup.email_taken) {
          setError('That email is already used for an RSVP.')
          return
        }
        if (dup.phone_taken) {
          setError('That phone number is already used for an RSVP.')
          return
        }
        setStep(STEPS[i + 1])
      } catch (e) {
        setError(e?.message ?? 'Could not verify contact. Try again.')
      } finally {
        setBusy(false)
      }
      return
    }

    setStep(STEPS[i + 1])
  }, [step, mode, email, phone, fullName, initialRecord, savedEditCode])

  const goBack = () => {
    setError(null)
    const i = STEPS.indexOf(step)
    if (i <= 0) return
    let j = i - 1
    while (j >= 0 && mode === 'edit' && STEPS[j] === 'event') j -= 1
    if (j < 0) return
    setStep(STEPS[j])
  }

  const canNext = (() => {
    if (step === 'event') return true
    if (step === 'intro') return true
    if (step === 'item') return symbolicItem.trim().length > 0
    if (step === 'contact') {
      return fullName.trim().length > 0 && validEmail(email) && phoneDigitsOk(phone)
    }
    if (step === 'image') return true
    if (step === 'extras') return true
    return false
  })()

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

  const clearChosenImage = () => {
    setLocalImageFile(null)
    revokeBlobPreview()
    setImageObjectPath(null)
  }

  const skipImageStep = () => {
    setError(null)
    setLocalImageFile(null)
    revokeBlobPreview()
    setStep('extras')
  }

  const nextFromImageStep = async () => {
    setError(null)
    if (!localImageFile) {
      setStep('extras')
      return
    }
    setBusy(true)
    try {
      const path = await uploadRsvpImageFile(localImageFile, uploadSessionIdRef.current)
      revokeBlobPreview()
      setLocalImageFile(null)
      setImageObjectPath(path)
      setStep('extras')
    } catch (e) {
      setError(e?.message ?? 'Upload failed. Try a smaller image or check Storage policies.')
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setBusy(true)
    try {
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        symbolic_item: symbolicItem.trim(),
        tenure_response: tenureResponse.trim() || null,
        favorite_snack: favoriteSnack.trim() || null,
        image_object_path: imageObjectPath || null,
      }
      const excludeCode =
        mode === 'edit'
          ? sanitizeEditCodeInput(initialRecord?.edit_code ?? savedEditCode)
          : null
      if (mode === 'edit' && (!excludeCode || excludeCode.length !== 5)) {
        throw new Error('Missing edit code.')
      }
      const dup = await checkSignupContactAvailable(
        payload.email,
        payload.phone,
        excludeCode && excludeCode.length === 5 ? excludeCode : null,
      )
      if (dup.email_taken) {
        throw new Error('That email is already used for an RSVP.')
      }
      if (dup.phone_taken) {
        throw new Error('That phone number is already used for an RSVP.')
      }
      if (mode === 'create') {
        const edit_code = generateEditCode()
        const row = await insertSignup({ edit_code, ...payload })
        setSavedEditCode(row.edit_code)
      } else {
        const code = sanitizeEditCodeInput(initialRecord?.edit_code ?? savedEditCode)
        if (code.length !== 5) throw new Error('Missing edit code.')
        await updateSignupByCode(code, payload)
        setSavedEditCode(code)
      }
      setStep('success')
      onSaved()
    } catch (e) {
      setError(e?.message ?? 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancelRsvp = async () => {
    setError(null)
    if (mode === 'create') {
      if (!window.confirm('Close without saving? Your RSVP will not be submitted.')) return
      onRequestClose()
      return
    }
    if (!window.confirm('Remove your RSVP entirely? This cannot be undone.')) return
    setRemoving(true)
    try {
      const code = sanitizeEditCodeInput(initialRecord?.edit_code ?? savedEditCode)
      if (code.length !== 5) throw new Error('Missing edit code.')
      const paths = [initialRecord?.image_object_path, imageObjectPath].filter(Boolean)
      await deleteSignupByCode(code, paths)
      onSaved()
      dialogRef.current?.close()
    } catch (e) {
      setError(e?.message ?? 'Could not cancel RSVP.')
    } finally {
      setRemoving(false)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(savedEditCode)
    } catch {
      setError('Could not copy automatically — select the code and copy it.')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="rsvp-dialog"
      aria-labelledby={titleId}
      onClose={onRequestClose}
      onCancel={(e) => e.preventDefault()}
    >
      <div className="rsvp-dialog-panel">
        <header className="rsvp-dialog-header">
          <h2 id={titleId} className="rsvp-dialog-title">
            {step === 'success'
              ? mode === 'create'
                ? 'You are in'
                : 'Saved'
              : step === 'event'
                ? 'Hot Verci Summer'
                : 'RSVP'}
          </h2>
          <button type="button" className="rsvp-text-btn" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </header>

        {error ? <p className="rsvp-error">{error}</p> : null}

        {step === 'event' ? (
          <div className="rsvp-step">
            <p className="rsvp-body rsvp-event-description">{EVENT_DESCRIPTION}</p>
            <ul className="rsvp-event-meta" aria-label="When and where">
              <li>{EVENT_DATE_LINE}</li>
              <li>{EVENT_TIME_LINE}</li>
              <li>{EVENT_LOCATION_LINE}</li>
            </ul>
            <div className="rsvp-actions">
              <button type="button" className="rsvp-primary" onClick={() => void goNext()}>
                RSVP
              </button>
            </div>
          </div>
        ) : null}

        {step === 'intro' ? (
          <div className="rsvp-step">
            {INTRO_COPY}
            <div className={mode === 'create' ? 'rsvp-actions split' : 'rsvp-actions'}>
              {mode === 'create' ? (
                <button type="button" className="rsvp-secondary" onClick={goBack}>
                  Back
                </button>
              ) : null}
              <button type="button" className="rsvp-primary" onClick={() => void goNext()}>
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 'item' ? (
          <div className="rsvp-step">
            <label className="rsvp-label" htmlFor="symbolic-item">
              What item are you bringing?
            </label>
            <textarea
              id="symbolic-item"
              className="rsvp-textarea"
              rows={4}
              value={symbolicItem}
              onChange={(e) => setSymbolicItem(e.target.value)}
              placeholder="A book, a drawing, a small object — whatever fits."
            />
            <p className="rsvp-hint">(You can edit this later with your private code)</p>
            <div className="rsvp-actions split">
              <button type="button" className="rsvp-secondary" onClick={goBack}>
                Back
              </button>
              <button type="button" className="rsvp-primary" onClick={() => void goNext()} disabled={!canNext}>
                Next
              </button>
            </div>
          </div>
        ) : null}

        {step === 'contact' ? (
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
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label className="rsvp-label" htmlFor="phone">
              Phone <span className="rsvp-optional">(optional)</span>
            </label>
            <input
              id="phone"
              className="rsvp-input"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="Skip or add a number we can reach you at"
            />
            <div className="rsvp-actions split">
              <button type="button" className="rsvp-secondary" onClick={goBack} disabled={busy}>
                Back
              </button>
              <button
                type="button"
                className="rsvp-primary"
                onClick={() => void goNext()}
                disabled={!canNext || busy}
              >
                {busy ? 'Checking…' : 'Next'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 'image' ? (
          <div className="rsvp-step">
            <p className="rsvp-body">
              Optionally add a photo — it will float on the event backdrop with your name and
              item. You can skip or change it when you edit your RSVP.
            </p>
            {(() => {
              const thumb =
                blobPreviewUrl ?? (imageObjectPath ? getRsvpImagePublicUrl(imageObjectPath) : null)
              return thumb ? (
                <div className="rsvp-image-preview-wrap">
                  <img src={thumb} alt="" className="rsvp-image-preview" />
                </div>
              ) : (
                <div className="rsvp-image-placeholder">No photo selected</div>
              )
            })()}
            <div className="rsvp-image-actions">
              <input
                ref={fileInputRef}
                id={`${titleId}-file`}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onImageFileChosen}
              />
              <label htmlFor={`${titleId}-file`} className="rsvp-file-pill">
                Library
              </label>
              <input
                ref={cameraInputRef}
                id={`${titleId}-cam`}
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onImageFileChosen}
              />
              <label htmlFor={`${titleId}-cam`} className="rsvp-file-pill">
                Camera
              </label>
              {(localImageFile || imageObjectPath) && (
                <button type="button" className="rsvp-text-btn rsvp-remove-photo" onClick={clearChosenImage}>
                  Remove photo
                </button>
              )}
            </div>
            <p className="rsvp-hint">JPEG, PNG, WebP, or GIF · max 5MB</p>
            <div className="rsvp-actions split rsvp-image-nav">
              <button type="button" className="rsvp-secondary" onClick={goBack}>
                Back
              </button>
              <div className="rsvp-image-nav-right">
                <button type="button" className="rsvp-secondary" onClick={skipImageStep}>
                  Skip
                </button>
                <button
                  type="button"
                  className="rsvp-primary"
                  onClick={() => void nextFromImageStep()}
                  disabled={busy}
                >
                  {busy ? 'Uploading…' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'extras' ? (
          <div className="rsvp-step">
            <label className="rsvp-label" htmlFor="tenure">
              How long have you been part of Verci?{' '}
              <span className="rsvp-optional">(optional)</span>
            </label>
            <input
              id="tenure"
              className="rsvp-input"
              value={tenureResponse}
              onChange={(e) => setTenureResponse(e.target.value)}
            />
            <label className="rsvp-label" htmlFor="snack">
              What is your favorite beverage or snack?{' '}
              <span className="rsvp-optional">(optional)</span>
            </label>
            <input
              id="snack"
              className="rsvp-input"
              value={favoriteSnack}
              onChange={(e) => setFavoriteSnack(e.target.value)}
            />
            <p className="rsvp-hint">You can leave these blank — we will still save your RSVP.</p>
            <div className="rsvp-actions split rsvp-extras-footer">
              <button type="button" className="rsvp-secondary" onClick={goBack}>
                Back
              </button>
              <div className="rsvp-extras-footer-actions">
                <button
                  type="button"
                  className="rsvp-secondary rsvp-cancel-rsvp"
                  onClick={() => void handleCancelRsvp()}
                  disabled={busy || removing}
                >
                  {removing ? 'Removing…' : 'Cancel RSVP'}
                </button>
                <button
                  type="button"
                  className="rsvp-primary"
                  onClick={() => void handleSave()}
                  disabled={!canNext || busy || removing}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'success' ? (
          <div className="rsvp-step success">
            {mode === 'create' ? (
              <p className="rsvp-success-lede">
                Thank you — we cannot wait to see what you bring. Copy this code and keep it
                somewhere safe.
              </p>
            ) : (
              <p className="rsvp-success-lede">Your RSVP is updated. Same code as before:</p>
            )}
            <div className="rsvp-code-row">
              <span className="rsvp-code" aria-label="Your five digit edit code">
                {savedEditCode}
              </span>
              <button type="button" className="rsvp-secondary" onClick={copyCode}>
                Copy code
              </button>
            </div>
            <p className="rsvp-hint strong">
              Copy this to edit your response later — use it in the box on the top right of the
              event page.
            </p>
            <div className="rsvp-actions">
              <button type="button" className="rsvp-primary" onClick={() => dialogRef.current?.close()}>
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </dialog>
  )
}
