import { useState } from 'react'
import { loadSignupForEdit, sanitizeEditCodeInput } from '../lib/signupApi.js'

/**
 * @param {{ onOpenEdit: (row: object) => void }} props
 */
export function EditCodeBar({ onOpenEdit }) {
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const digits = sanitizeEditCodeInput(raw)

  const submit = async () => {
    setError(null)
    if (digits.length !== 5) {
      setError('Enter your 5-digit code.')
      return
    }
    setBusy(true)
    try {
      const res = await loadSignupForEdit(digits)
      if (res.error) {
        setError(res.error)
        return
      }
      onOpenEdit(res.row)
    } catch (e) {
      setError(e?.message ?? 'Could not look up that code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="edit-code-bar" role="search" aria-label="Edit your RSVP">
      <span className="edit-code-label">Edit your response</span>
      <input
        className="edit-code-input"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={5}
        placeholder="00000"
        value={raw}
        onChange={(e) => setRaw(sanitizeEditCodeInput(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'edit-code-err' : undefined}
      />
      <button type="button" className="edit-code-go" onClick={() => void submit()} disabled={busy}>
        {busy ? '…' : 'Go'}
      </button>
      {error ? (
        <p id="edit-code-err" className="edit-code-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
