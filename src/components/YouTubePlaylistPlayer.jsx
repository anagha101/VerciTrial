import { useEffect, useRef, useState } from 'react'

let apiPromise = null

/** Loads the YouTube IFrame API once and resolves with the global YT object. */
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        resolve(window.YT)
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return apiPromise
}

/**
 * Autoplaying playlist player. Tries unmuted autoplay first; if the browser
 * blocks it, falls back to muted autoplay with a "tap for sound" button.
 * @param {{ playlistId: string }} props
 */
export function YouTubePlaylistPlayer({ playlistId }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const [needsUnmute, setNeedsUnmute] = useState(false)

  useEffect(() => {
    let cancelled = false
    let checkTimer = 0

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        playerVars: {
          listType: 'playlist',
          list: playlistId,
          autoplay: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: (e) => {
            const player = e.target
            player.unMute()
            player.setVolume(100)
            player.playVideo()
            // Browsers that block unmuted autoplay leave the player paused —
            // detect that and retry muted so at least the video runs.
            checkTimer = window.setTimeout(() => {
              const state = player.getPlayerState()
              const playing =
                state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING
              if (!playing) {
                player.mute()
                player.playVideo()
                setNeedsUnmute(true)
              }
            }, 1200)
          },
        },
      })
    })

    return () => {
      cancelled = true
      window.clearTimeout(checkTimer)
      playerRef.current?.destroy?.()
      playerRef.current = null
    }
  }, [playlistId])

  const unmute = () => {
    const player = playerRef.current
    if (player) {
      player.unMute()
      player.setVolume(100)
      player.playVideo()
    }
    setNeedsUnmute(false)
  }

  return (
    <div className="sunset-player">
      <div ref={hostRef} className="sunset-player-host" />
      {needsUnmute ? (
        <button type="button" className="glass-btn sunset-unmute-btn" onClick={unmute}>
          🔊 Tap for sound
        </button>
      ) : null}
    </div>
  )
}
