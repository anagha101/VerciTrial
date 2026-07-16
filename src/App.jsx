import { useState } from 'react'
import { RsvpModal } from './components/RsvpModal.jsx'
import { SparkleCursor } from './components/SparkleCursor.jsx'
import { TimelapseNav } from './components/TimelapseNav.jsx'
import { TimelapseFooter } from './components/TimelapseFooter.jsx'
import { YouTubePlaylistPlayer } from './components/YouTubePlaylistPlayer.jsx'
import { PublicEpisodeSection } from './components/PublicEpisodeSection.jsx'
import { isSupabaseConfigured } from './lib/supabaseClient.js'
import { getYoutubePlaylistId } from './lib/youtubePlaylist.js'
import './App.css'
import './Timelapse.css'

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)
  const [episodeRefreshKey, setEpisodeRefreshKey] = useState(0)

  const configured = isSupabaseConfigured()
  const showSparkles = !modalOpen
  const playlistId = getYoutubePlaylistId()

  if (!configured) {
    return (
      <div className="sunset-app">
        <p className="sunset-error">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env</code>, then restart the dev server.
        </p>
      </div>
    )
  }

  return (
    <div className={`sunset-app${showSparkles ? ' sunset-app--sparkles' : ''}`}>
      <div className="sunset-bg" aria-hidden="true">
        <span className="sunset-bg-blob sunset-bg-blob--1" />
        <span className="sunset-bg-blob sunset-bg-blob--2" />
        <span className="sunset-bg-blob sunset-bg-blob--3" />
      </div>

      <TimelapseNav />

      <main className="sunset-main">
        <h1 className="sunset-title">
          <span className="sunset-title-main">Sunday Sunset Sessions</span>
          <span className="sunset-title-sub">with Anagha</span>
        </h1>

        <div className="sunset-video-card">
          {playlistId ? (
            <YouTubePlaylistPlayer playlistId={playlistId} />
          ) : (
            <p className="sunset-video-placeholder">
              Set <code>VITE_YOUTUBE_PLAYLIST</code> in <code>.env</code> to play the latest
              episode here.
            </p>
          )}
        </div>

        <PublicEpisodeSection
          refreshKey={episodeRefreshKey}
          onRsvpClick={() => setModalOpen(true)}
        />
      </main>

      <TimelapseFooter />

      {showSparkles ? <SparkleCursor active /> : null}

      <RsvpModal
        open={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        onSaved={() => setEpisodeRefreshKey((current) => current + 1)}
      />
    </div>
  )
}
