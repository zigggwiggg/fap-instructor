import { useEffect, useRef, useCallback, useState } from 'react'
import { useVideoStore } from '../stores/videoStore'
import { useConfigStore } from '../stores/configStore'

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

    const videoRefs = useRef<(HTMLVideoElement | null)[]>([null, null, null])
    const [activeSlot, setActiveSlot] = useState(0)
    const [transitioning, setTransitioning] = useState(false)
    const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // The 3 videos we want mounted at any time
    const slots = [
        queue[currentIndex],
        queue[currentIndex + 1],
        queue[currentIndex + 2],
    ]

    // ── Always reset and fetch fresh on mount ──
    useEffect(() => {
        const store = useVideoStore.getState()
        store.reset()
        // Small delay to ensure state is cleared before fetching
        setTimeout(() => {
            useVideoStore.getState().fetchMore()
        }, 50)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Helper: attempt to play a specific video element
    const tryPlay = useCallback((vid: HTMLVideoElement | null) => {
        if (!vid) return
        vid.muted = muted
        vid.volume = muted ? 0 : volume
        const p = vid.play()
        if (p) p.catch(() => {
            // Retry once after a short delay (handles mobile browser timing quirks)
            setTimeout(() => vid.play().catch(() => { }), 200)
        })
    }, [muted, volume])

    // ── Auto-play current slot when it changes ──
    useEffect(() => {
        videoRefs.current.forEach((vid, idx) => {
            if (!vid) return
            if (idx === activeSlot) {
                vid.muted = muted
                vid.volume = muted ? 0 : volume
                if (isPlaying) tryPlay(vid)
            } else {
                vid.muted = true
                vid.pause()
            }
        })
    }, [currentIndex, activeSlot, isPlaying, muted, volume, tryPlay])

    // Sync play/pause state globally
    useEffect(() => {
        const currentVideo = videoRefs.current[activeSlot]
        if (!currentVideo) return
        if (isPlaying) {
            tryPlay(currentVideo)
        } else {
            currentVideo.pause()
        }
    }, [isPlaying, activeSlot, muted, tryPlay])

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
        const nextSlot = (activeSlot + 1) % 3
        setActiveSlot(nextSlot)
        advance()
        setTimeout(() => setTransitioning(false), 150)
    }, [activeSlot, advance])

    // Ref to keep handleEnded fresh for the timer
    const handleEndedRef = useRef(handleEnded)
    handleEndedRef.current = handleEnded

    // ── Handle preload complete ──
    const handleCanPlay = useCallback(
        (id: string, slotIndex: number) => {
            markLoaded(id)
            // If this is the active slot and we should be playing, play now.
            // This is crucial for mobile where play() must be called when media is ready.
            if (slotIndex === activeSlot && useVideoStore.getState().isPlaying) {
                tryPlay(videoRefs.current[slotIndex])
            }
        },
        [markLoaded, activeSlot, tryPlay]
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

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'black', zIndex: 0, overflow: 'hidden' }}>
            {slots.map((video, slotIndex) => {
                if (!video) return null
                const isCurrent = slotIndex === activeSlot
                return (
                    <video
                        key={`${video.id}-${slotIndex}`}
                        ref={(el) => {
                            videoRefs.current[slotIndex] = el
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
                        onCanPlay={() => handleCanPlay(video.id, slotIndex)}
                        onLoadedData={() => {
                            // Second attempt trigger on mobile when data is fully available
                            if (slotIndex === activeSlot && useVideoStore.getState().isPlaying) {
                                tryPlay(videoRefs.current[slotIndex])
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
                            transition: transitioning ? 'opacity 0.15s ease' : 'none',
                            pointerEvents: 'none',
                        }}
                    />
                )
            })}
        </div>
    )
}
