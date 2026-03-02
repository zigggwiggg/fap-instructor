import { useEffect, useRef, useCallback, useState } from 'react'
import { useVideoStore } from '../stores/videoStore'
import { registerVideoPlay } from '../videoControl'
import { isMobile, getPreloadCount, getConnectionQuality } from '../utils/network'

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

    const [transitioning, setTransitioning] = useState(false)
    const [progress, setProgress] = useState(0)
    const rafRef = useRef<number | null>(null)
    const mobile = isMobile()

    // Adaptive: mount fewer videos on mobile/slow connections
    const preloadCount = getPreloadCount()

    const currentVideo = queue[currentIndex]
    const nextVideo = queue[currentIndex + 1]
    const nextNextVideo = queue[currentIndex + 2]

    const allSlots = [currentVideo, nextVideo, nextNextVideo].filter(Boolean)
    const slots = allSlots.slice(0, Math.min(allSlots.length, preloadCount))

    // ── Always reset and fetch fresh on mount ──
    useEffect(() => {
        const store = useVideoStore.getState()
        store.reset()
        setTimeout(() => {
            useVideoStore.getState().fetchMore()
        }, 50)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const tryPlay = useCallback((vid: HTMLVideoElement | null) => {
        if (!vid) return
        vid.muted = muted
        vid.volume = muted ? 0 : volume
        console.log(`[VideoPlayer] Attempting to play video:`, vid.src?.slice(-30))
        const p = vid.play()
        if (p !== undefined) {
            p.catch((err) => {
                if (err.name === 'AbortError') return;
                console.warn(`[VideoPlayer] Autoplay failed, falling back to muted...`, err)
                vid.muted = true
                vid.play().catch(e => {
                    if (e.name !== 'AbortError') console.error(`[VideoPlayer] Muted playback also failed:`, e)
                })
            })
        }
    }, [muted, volume])

    // Register play trigger for GamePage's click handler
    useEffect(() => {
        registerVideoPlay(() => {
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

    // ── Track video progress via rAF for smooth updates ──
    useEffect(() => {
        const tick = () => {
            if (currentVideo) {
                const el = document.getElementById(`vid-${currentVideo.id}`) as HTMLVideoElement
                if (el && el.duration && isFinite(el.duration)) {
                    setProgress(el.currentTime / el.duration)
                }
            }
            rafRef.current = requestAnimationFrame(tick)
        }
        if (isPlaying) {
            rafRef.current = requestAnimationFrame(tick)
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [isPlaying, currentVideo])

    // ── Instantly reset progress bar when video changes ──
    useEffect(() => {
        setProgress(0);
    }, [currentVideo?.id])

    // ── Handle video end → advance to next video ──
    const handleEnded = useCallback(() => {
        setTransitioning(true)
        advance()
        setTimeout(() => setTransitioning(false), 150)
    }, [advance])

    const handleEndedRef = useRef(handleEnded)
    handleEndedRef.current = handleEnded

    // ── Handle Progress Bar Click (Seeking) ──
    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!currentVideo) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;

        const el = document.getElementById(`vid-${currentVideo.id}`) as HTMLVideoElement;
        if (el && isFinite(el.duration)) {
            el.currentTime = percentage * el.duration;
            setProgress(percentage);
        }
    }, [currentVideo]);

    // ── Handle preload complete ──
    const handleCanPlay = useCallback(
        (id: string) => {
            markLoaded(id)
            if (id === currentVideo?.id && useVideoStore.getState().isPlaying) {
                const el = document.getElementById(`vid-${id}`) as HTMLVideoElement
                if (el) tryPlay(el)
            }
        },
        [markLoaded, currentVideo, tryPlay]
    )

    // Determine preload strategy based on connection
    const getPreloadStrategy = useCallback((isCurrent: boolean): string => {
        if (isCurrent) return 'auto'
        const quality = getConnectionQuality()
        if (quality === 'slow') return 'none'
        if (quality === 'medium' || mobile) return 'metadata'
        return 'auto'
    }, [mobile])

    if (error) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black', padding: '1rem' }}>
                <p style={{ color: 'var(--color-danger)', fontSize: mobile ? '0.9rem' : '1rem', textAlign: 'center' }}>Failed to load videos</p>
                <button
                    onClick={() => useVideoStore.getState().fetchMore()}
                    style={{ marginTop: '12px', padding: '10px 24px', background: 'rgba(139, 92, 246, 0.3)', border: '1px solid rgba(139, 92, 246, 0.5)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    Retry
                </button>
            </div>
        )
    }

    if (isLoading && queue.length === 0) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black', gap: '12px', padding: '1rem' }}>
                <div style={{ width: '2rem', height: '2rem', border: '2px solid var(--color-accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textAlign: 'center' }}>Loading videos...</p>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', textAlign: 'center' }}>
                    {getConnectionQuality() === 'slow' ? '📶 Slow connection detected — using lower quality' : ''}
                </p>
            </div>
        )
    }

    if (!isLoading && queue.length === 0) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black', gap: '16px', padding: '1rem' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>⚠️ No videos found</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', textAlign: 'center', maxWidth: '260px' }}>Try selecting different categories on the home screen, or check your internet connection.</p>
                <button
                    onClick={() => useVideoStore.getState().fetchMore()}
                    style={{ marginTop: '8px', padding: '10px 24px', background: 'rgba(139, 92, 246, 0.3)', border: '1px solid rgba(139, 92, 246, 0.5)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', zIndex: 0, overflow: 'hidden' }}>
            {slots.map((video) => {
                const isCurrent = video.id === currentVideo?.id
                const zIndex = isCurrent ? 10 : (video.id === nextVideo?.id ? 9 : 8);

                return (
                    <video
                        id={`vid-${video.id}`}
                        key={video.id}
                        ref={(el) => {
                            if (el && isCurrent && useVideoStore.getState().isPlaying) {
                                tryPlay(el)
                            }
                        }}
                        src={video.url}
                        preload={getPreloadStrategy(isCurrent)}
                        loop={false}
                        muted={!isCurrent || muted}
                        playsInline
                        onEnded={isCurrent ? handleEnded : undefined}
                        onCanPlay={() => handleCanPlay(video.id)}
                        onError={(e) => {
                            if (isCurrent) {
                                console.warn(`[VideoPlayer] Video failed to load, skipping...`, e)
                                setTimeout(handleEnded, 500)
                            }
                        }}
                        onLoadedData={(e) => {
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

            {/* ── Video Tag Display ── */}
            {currentVideo && (currentVideo.searchTag || (currentVideo.tags && currentVideo.tags.length > 0)) && (
                <div style={{
                    position: 'absolute',
                    left: '16px',
                    bottom: '24px',
                    zIndex: 20,
                    background: 'rgba(0,0,0,0.5)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', gap: '6px', alignItems: 'center',
                }}>
                    <span style={{ color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        #{currentVideo.searchTag || currentVideo.tags[0]}
                    </span>
                </div>
            )}

            {/* ── Video Progress Bar (Clickable) ── */}
            <div
                onClick={handleProgressClick}
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '24px', // Larger hit area for easier clicking/tapping
                    display: 'flex',
                    alignItems: 'flex-end',
                    zIndex: 50,
                    cursor: 'pointer',
                }}
            >
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)' }}>
                    <div style={{
                        height: '100%',
                        width: `${progress * 100}%`,
                        background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-secondary))',
                        transition: progress < 0.01 ? 'none' : 'width 0.1s linear',
                        position: 'relative',
                    }}>
                        {/* Red dot indicator */}
                        <div style={{
                            position: 'absolute',
                            right: '-6px',
                            top: '-4px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            boxShadow: '0 0 8px rgba(239,68,68,0.8)',
                        }} />
                    </div>
                </div>
            </div>
        </div>
    )
}
