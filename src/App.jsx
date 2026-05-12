import { useCallback, useEffect, useState } from 'react'
import { EditCodeBar } from './components/EditCodeBar.jsx'
import { FloatingRsvps } from './components/FloatingRsvps.jsx'
import { RsvpModal } from './components/RsvpModal.jsx'
import {
  getSupabaseAnonKeyWarning,
  isSupabaseConfigured,
} from './lib/supabaseClient.js'
import { describeBackdropLoadError, listBackdropSignups } from './lib/signupApi.js'
import verciLogo from './assets/verci-logo.png'
import './App.css'

export default function App() {
  const configured = isSupabaseConfigured()
  const anonKeyWarning = configured ? getSupabaseAnonKeyWarning() : null
  const [rsvps, setRsvps] = useState([])
  const [backdropError, setBackdropError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [editRecord, setEditRecord] = useState(null)

  const refreshBackdrop = useCallback(async () => {
    if (!configured) return
    try {
      const rows = await listBackdropSignups()
      setRsvps(rows)
      setBackdropError(null)
    } catch (e) {
      console.error(e)
      setBackdropError(describeBackdropLoadError(e))
    }
  }, [configured])

  useEffect(() => {
    void refreshBackdrop()
  }, [refreshBackdrop])

  useEffect(() => {
    if (!configured) return
    const id = setInterval(() => void refreshBackdrop(), 28_000)
    return () => clearInterval(id)
  }, [configured, refreshBackdrop])

  const openCreate = () => {
    setModalMode('create')
    setEditRecord(null)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setModalMode('edit')
    setEditRecord(row)
    setModalOpen(true)
  }

  const handleAuraUpdated = useCallback((id, newAuraCount) => {
    setRsvps((prev) =>
      prev.map((r) => (r.id === id ? { ...r, aura_count: newAuraCount } : r)),
    )
  }, [])

  return (
    <div className="event-app">
      {configured ? <FloatingRsvps items={rsvps} onAuraUpdated={handleAuraUpdated} /> : null}

      {configured ? <EditCodeBar onOpenEdit={openEdit} /> : null}

      {!configured ? (
        <div className="config-banner" role="status">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env</code> (see <code>.env.example</code>), then restart the dev server.
        </div>
      ) : null}

      {anonKeyWarning ? (
        <div className="config-banner config-banner-warn" role="alert">
          {anonKeyWarning}
        </div>
      ) : null}

      <main className="event-hero">
        <div className="event-hero-copy">
          <p className="event-welcome">Hot Verci Summer Loading…</p>
          <p className="event-when">
            Tuesday, May 19 · 5:30pm–8:00pm <span className="event-tz">EST</span>
          </p>
          <p className="event-where">Verci Flatiron</p>
          {backdropError ? <p className="event-backdrop-err">{backdropError}</p> : null}
        </div>
        <button
          type="button"
          className="event-rsvp-btn"
          onClick={openCreate}
          disabled={!configured}
        >
          RSVP
        </button>
      </main>

      <RsvpModal
        open={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        mode={modalMode}
        initialRecord={editRecord}
        onSaved={refreshBackdrop}
      />

      <img src={verciLogo} alt="Verci" className="verci-mark" decoding="async" />
    </div>
  )
}
