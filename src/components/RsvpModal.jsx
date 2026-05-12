import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  getRsvpImagePublicUrl,
  uploadRsvpImageFile,
  validateRsvpImageFile,
} from '../lib/rsvpImages.js'
import {
  generateEditCode,
  insertSignup,
  sanitizeEditCodeInput,
  updateSignupByCode,
} from '../lib/signupApi.js'

const STEPS = ['intro', 'item', 'contact', 'image', 'extras', 'success']

const INTRO_COPY = (
  <>
    <p className="rsvp-lede">
      For this gathering, we are asking everyone to bring <strong>one physical item</strong>{' '}
      that represents what you want to get out of your <strong>Hot Verci Summer</strong>.
    </p>
    <p className="rsvp-body">
      That might connect to a story you want to tell, a person you are thinking about, a goal
      you are chasing, or anything that feels important to you right now. We will make space
      to share what these objects mean — no performance, just sincerity.
    </p>
    <p className="rsvp-body muted">
      On the next screens you will tell us what you are bringing, how to reach you, and optional
      fun facts. You can change your answers later with the private code we give you at the end.
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
  const [step, setStep] = useState('intro')
  const [busy, setBusy] = useState(false)
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
    setStep('intro')
    setBusy(false)
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

  const goNext = () => {
    setError(null)
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
  }

  const goBack = () => {
    setError(null)
    const i = STEPS.indexOf(step)
    if (i > 0) setStep(STEPS[i - 1])
  }

  const canNext = (() => {
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

  const handleDialogClick = (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close()
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
      onClick={handleDialogClick}
    >
      <div className="rsvp-dialog-panel" onClick={(e) => e.stopPropagation()}>
        <header className="rsvp-dialog-header">
          <h2 id={titleId} className="rsvp-dialog-title">
            {step === 'success'
              ? mode === 'create'
                ? 'You are in'
                : 'Saved'
              : 'RSVP'}
          </h2>
          <button type="button" className="rsvp-text-btn" onClick={() => dialogRef.current?.close()}>
            Close
          </button>
        </header>

        {error ? <p className="rsvp-error">{error}</p> : null}

        {step === 'intro' ? (
          <div className="rsvp-step">
            {INTRO_COPY}
            <div className="rsvp-actions">
              <button type="button" className="rsvp-primary" onClick={goNext}>
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
              placeholder="A photo, a book, a small object — whatever fits the moment."
            />
            <p className="rsvp-hint">You can edit this later with your private code.</p>
            <div className="rsvp-actions split">
              <button type="button" className="rsvp-secondary" onClick={goBack}>
                Back
              </button>
              <button type="button" className="rsvp-primary" onClick={goNext} disabled={!canNext}>
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
            {!phoneDigitsOk(phone) ? (
              <p className="rsvp-hint rsvp-hint-warn">If you add a phone number, use at least 7 digits.</p>
            ) : (
              <p className="rsvp-hint">Optional — include area code if you add a number.</p>
            )}
            <div className="rsvp-actions split">
              <button type="button" className="rsvp-secondary" onClick={goBack}>
                Back
              </button>
              <button type="button" className="rsvp-primary" onClick={goNext} disabled={!canNext}>
                Next
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
            <div className="rsvp-actions split">
              <button type="button" className="rsvp-secondary" onClick={goBack}>
                Back
              </button>
              <button
                type="button"
                className="rsvp-primary"
                onClick={handleSave}
                disabled={!canNext || busy}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
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
