import { useEffect, useRef, useCallback, useState } from 'react'
import { useVideoStore } from '../stores/videoStore'
import { useConfigStore } from '../stores/configStore'
import { registerVideoPlay } from '../videoControl'

export default function VideoPlayer({ muted = false, volume = 1.0 }: { muted?: boolean; volume?: number }) {
    const {
        queue,
        currentIndex,
        isPlaying,
        isLoading,
        error,
        advance,
        markLoaded,
    } = useVideoStore()
    const { config } = useConfigStore()

    const [transitioning, setTransitioning] = useState(false)
    const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // The 3 videos we want mounted at any time
    const currentVideo = queue[currentIndex]
    const nextVideo = queue[currentIndex + 1]
    const nextNextVideo = queue[currentIndex + 2]

    // We filter nulls, but React keys keep the elements perfectly alive as they shift positions!
    const slots = [currentVideo, nextVideo, nextNextVideo].filter(Boolean)

    // ── Always reset and fetch fresh on mount ──
    useEffect(() => {
        const store = useVideoStore.getState()
        store.reset()
        // Small delay to ensure state is cleared before fetching
        setTimeout(() => {
            useVideoStore.getState().fetchMore()
        }, 50)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const tryPlay = useCallback((vid: HTMLVideoElement | null) => {
        if (!vid) return
        vid.muted = muted
        vid.volume = muted ? 0 : volume
        console.log(`[VideoPlayer] Attempting to play video:`, vid.src)
        const p = vid.play()
        if (p !== undefined) {
            p.catch((err) => {
                // Ignore AbortError caused by skipping videos very quickly 
                if (err.name === 'AbortError') return;
                console.warn(`[VideoPlayer] Autoplay failed, falling back to muted...`, err)
                // Retry once muted (autoplay policy fallback)
                vid.muted = true
                vid.play().catch(e => {
                    if (e.name !== 'AbortError') console.error(`[VideoPlayer] Muted playback also failed:`, e)
                })
            })
        }
    }, [muted, volume])

    // Register a module-level trigger so GamePage can call play() directly
    // from within the user's click handler (bypasses autoplay restrictions)
    useEffect(() => {
        registerVideoPlay(() => {
            // Find the current video element in the DOM
            if (!currentVideo) return;
            const el = document.getElementById(`vid-${currentVideo.id}`) as HTMLVideoElement;
            if (el) tryPlay(el);
        })
    }, [tryPlay, currentVideo])

    // ── Auto-play current slot when it changes ──
    useEffect(() => {
        slots.forEach((vid) => {
            if (!vid) return
            const el = document.getElementById(`vid-${vid.id}`) as HTMLVideoElement
            if (!el) return

            const isCurrent = vid.id === currentVideo?.id

            if (isCurrent) {
                el.muted = muted
                el.volume = muted ? 0 : volume
                if (isPlaying) tryPlay(el)
            } else {
                el.muted = true
                el.pause()
            }
        })
    }, [currentIndex, isPlaying, muted, volume, tryPlay, slots, currentVideo])

    // Sync play/pause state globally
    useEffect(() => {
        if (!currentVideo) return
        const currentEl = document.getElementById(`vid-${currentVideo.id}`) as HTMLVideoElement
        if (!currentEl) return
        if (isPlaying) {
            tryPlay(currentEl)
        } else {
            currentEl.pause()
        }
    }, [isPlaying, muted, tryPlay, currentVideo])

    // ── Slide Duration Timer → auto-advance after configured seconds ──
    useEffect(() => {
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
        if (!isPlaying || queue.length === 0) return

        const durationMs = (config.slideDuration || 10) * 1000
        slideTimerRef.current = setTimeout(() => {
            handleEndedRef.current()
        }, durationMs)

        return () => {
            if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
        }
    }, [currentIndex, isPlaying, config.slideDuration, queue.length]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── Handle video end → advance to next ──
    const handleEnded = useCallback(() => {
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
        setTransitioning(true)
        advance()
        setTimeout(() => setTransitioning(false), 150)
    }, [advance])

    // Ref to keep handleEnded fresh for the timer
    const handleEndedRef = useRef(handleEnded)
    handleEndedRef.current = handleEnded

    // ── Handle preload complete ──
    const handleCanPlay = useCallback(
        (id: string) => {
            markLoaded(id)
            // If this is the active slot and we should be playing, play now.
            // This is crucial for mobile where play() must be called when media is ready.
            if (id === currentVideo?.id && useVideoStore.getState().isPlaying) {
                const el = document.getElementById(`vid-${id}`) as HTMLVideoElement
                if (el) tryPlay(el)
            }
        },
        [markLoaded, currentVideo, tryPlay]
    )

    if (error) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black' }}>
                <p style={{ color: 'var(--color-danger)' }}>Failed to load videos</p>
            </div>
        )
    }

    if (isLoading && queue.length === 0) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black', gap: '12px' }}>
                <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Loading videos...</p>
            </div>
        )
    }

    if (!isLoading && queue.length === 0) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black', gap: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>⚠️ No videos found</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center', maxWidth: '260px' }}>Try selecting different categories on the home screen, or check your internet connection.</p>
                <button
                    onClick={() => useVideoStore.getState().fetchMore()}
                    style={{ marginTop: '8px', padding: '8px 24px', background: 'rgba(139, 92, 246, 0.3)', border: '1px solid rgba(139, 92, 246, 0.5)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    Retry
                </button>
            </div>
        )
    }

    // Force rendering in reverse order so the current video is on top in DOM layering unless we use zIndex
    // We use zIndex to ensure correct stacking without unmounting
    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', zIndex: 0, overflow: 'hidden' }}>
            {slots.map((video) => {
                const isCurrent = video.id === currentVideo?.id
                // Current = zIndex 10, Next = zIndex 9, NextNext = zIndex 8
                const zIndex = isCurrent ? 10 : (video.id === nextVideo?.id ? 9 : 8);

                return (
                    <video
                        id={`vid-${video.id}`}
                        key={video.id} // Important: keep key pure to ID so element persists across slides!
                        ref={(el) => {
                            // When the element first mounts and we're already playing, try to play immediately
                            if (el && isCurrent && useVideoStore.getState().isPlaying) {
                                tryPlay(el)
                            }
                        }}
                        src={video.url}
                        preload="auto"
                        loop={false}
                        muted={!isCurrent || muted}
                        playsInline
                        onEnded={isCurrent ? handleEnded : undefined}
                        onCanPlay={() => handleCanPlay(video.id)}
                        onError={(e) => {
                            if (isCurrent) {
                                console.warn(`[VideoPlayer] Video failed to load, automatically skipping...`, e)
                                setTimeout(handleEnded, 500) // Skip to the next video
                            }
                        }}
                        onLoadedData={(e) => {
                            // Second attempt trigger on mobile when data is fully available
                            if (isCurrent && useVideoStore.getState().isPlaying) {
                                tryPlay(e.currentTarget as HTMLVideoElement)
                            }
                        }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            objectFit: 'contain',
                            opacity: isCurrent ? 1 : 0,
                            zIndex: zIndex,
                            transition: transitioning && isCurrent ? 'opacity 0.15s ease' : 'none',
                            pointerEvents: 'none',
                        }}
                    />
                )
            })}
        </div>
    )
}
