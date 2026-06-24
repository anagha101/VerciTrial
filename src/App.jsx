import { useEffect, useRef, useState } from 'react'
import { RsvpModal } from './components/RsvpModal.jsx'
import { SparkleCursor } from './components/SparkleCursor.jsx'
import { TimelapseNav } from './components/TimelapseNav.jsx'
import { TimelapseFooter } from './components/TimelapseFooter.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import { getTimelapseVideoUrl } from './lib/timelapseVideo.js'
import './App.css'
import './Timelapse.css'

// import AppEvent from './AppEvent.jsx'

export default function App() {
  const videoRef = useRef(null)
  const [volume, setVolume] = useState(1)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const configured = isSupabaseConfigured()
  const videoUrl = configured ? getTimelapseVideoUrl() : null
  const showSparkles = !modalOpen
  const videoMuted = !audioUnlocked || volume === 0

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return

    const play = () => {
      if (modalOpen) return
      void video.play().catch(() => {
        video.muted = true
        void video.play().catch(() => {})
      })
    }

    play()
    video.addEventListener('canplay', play)
    return () => video.removeEventListener('canplay', play)
  }, [videoUrl, modalOpen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (modalOpen) {
      video.pause()
      return
    }

    void video.play().catch(() => {
      video.muted = true
      void video.play().catch(() => {})
    })
  }, [modalOpen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = videoMuted
  }, [volume, videoMuted])

  const unlockAudio = () => {
    if (volume > 0) setAudioUnlocked(true)
  }

  const handleVolumeChange = (e) => {
    const next = Number(e.target.value)
    setVolume(next)
    if (next > 0) setAudioUnlocked(true)
    const video = videoRef.current
    if (!video) return
    video.volume = next
    video.muted = next === 0
    if (next > 0 && !modalOpen) void video.play().catch(() => {})
  }

  const handleBackgroundClick = () => {
    unlockAudio()
  }

  const openRsvp = () => {
    unlockAudio()
    setModalOpen(true)
  }

  if (!configured) {
    return (
      <div className="timelapse-app">
        <p className="timelapse-error">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env</code>, then restart the dev server.
        </p>
      </div>
    )
  }

  if (!videoUrl) {
    return (
      <div className="timelapse-app">
        <p className="timelapse-error">Could not resolve timelapse video URL.</p>
      </div>
    )
  }

  return (
    <div className={`timelapse-app${showSparkles ? ' timelapse-app--sparkles' : ''}`}>
      <video
        ref={videoRef}
        className="timelapse-video"
        src={videoUrl}
        autoPlay
        loop
        playsInline
        preload="auto"
        muted
        onError={() => setLoadError('Video failed to load. Check the videos bucket and file path.')}
      />

      {!modalOpen ? (
        <button
          type="button"
          className="timelapse-audio-layer"
          onClick={handleBackgroundClick}
          aria-label="Enable audio"
        />
      ) : null}

      <TimelapseNav onRsvpClick={openRsvp} />
      <TimelapseFooter />

      {!modalOpen ? <SparkleCursor active /> : null}

      {loadError ? <p className="timelapse-error">{loadError}</p> : null}

      <label className="timelapse-volume">
        <span className="timelapse-volume-label" aria-hidden="true">
          🔊
        </span>
        <span className="visually-hidden">Volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
        />
      </label>

      <RsvpModal open={modalOpen} onRequestClose={() => setModalOpen(false)} />
    </div>
  )
}
