import { useCallback, useEffect, useState } from 'react'
import { AuraFarmView } from './AuraFarmView.jsx'
import { fetchActiveEpisodeInfo, fetchCurrentEpisodeNumber } from '../lib/episodeApi.js'
import { getEpisodePhotoUrl } from '../lib/episodePhoto.js'
import { describeSignupError, listEpisodeSignups } from '../lib/signupApi.js'

/** @param {{ refreshKey?: number, onRsvpClick: () => void }} props */
export function PublicEpisodeSection({ refreshKey = 0, onRsvpClick }) {
  const [episode, setEpisode] = useState(null)
  const [episodeNumber, setEpisodeNumber] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [info, number] = await Promise.all([
        fetchActiveEpisodeInfo(),
        fetchCurrentEpisodeNumber(),
      ])
      const rows = await listEpisodeSignups(number)
      setEpisode(info)
      setEpisodeNumber(number)
      setAttendees(rows)
    } catch (err) {
      console.error(err)
      setError(describeSignupError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (loading) {
    return <p className="public-episode-status">Loading this session…</p>
  }

  if (error || !episode || episodeNumber == null) {
    return (
      <div className="public-episode-status">
        <p>{error ?? 'This session is not available yet.'}</p>
        <button type="button" className="glass-btn" onClick={() => void load()}>
          Try again
        </button>
        <button type="button" className="sunset-rsvp-btn" onClick={onRsvpClick}>
          <span className="gradient-rainbow-text">RSVP</span>
        </button>
      </div>
    )
  }

  return (
    <section className="public-episode" aria-label="Current event">
      <article className="public-flyer-card">
        <img
          src={getEpisodePhotoUrl(episodeNumber)}
          alt={`Flyer for ${episode.title || 'the current Sunday Sunset Session'}`}
          className="public-flyer"
        />
        <div className="public-episode-copy">
          {episode.title ? <h2>{episode.title}</h2> : null}
          {episode.subtitle ? <p className="public-episode-subtitle">{episode.subtitle}</p> : null}
          {episode.time ? <p className="public-episode-time">{episode.time}</p> : null}
          {episode.description ? <p>{episode.description}</p> : null}
        </div>
      </article>

      <div className="public-aura-farm" aria-label="Who's going">
        <AuraFarmView items={attendees} />
        <button type="button" className="sunset-rsvp-btn public-aura-rsvp" onClick={onRsvpClick}>
          <span className="gradient-rainbow-text">RSVP</span>
        </button>
      </div>
    </section>
  )
}
