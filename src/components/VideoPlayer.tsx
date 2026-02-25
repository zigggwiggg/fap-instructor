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

    // ── Auto-play current slot when it changes ──
    useEffect(() => {
        videoRefs.current.forEach((vid, idx) => {
            if (!vid) return
            if (idx === activeSlot) {
                vid.muted = muted
                vid.volume = muted ? 0 : volume
                if (isPlaying) vid.play().catch(() => { })
            } else {
                vid.muted = true
            }
        })
    }, [currentIndex, activeSlot, isPlaying, muted, volume])

    // Sync play/pause state globally
    useEffect(() => {
        const currentVideo = videoRefs.current[activeSlot]
        if (!currentVideo) return
        if (isPlaying) {
            currentVideo.muted = muted
            currentVideo.volume = muted ? 0 : volume
            currentVideo.play().catch(() => { })
        } else {
            currentVideo.pause()
        }
    }, [isPlaying, activeSlot, muted])

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
        (id: string) => {
            markLoaded(id)
        },
        [markLoaded]
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
            <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 0, backgroundColor: 'black' }}>
                <div className="inline-block w-8 h-8 border-2 border-t-[var(--color-accent)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
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
                        }}
                        src={video.url}
                        preload="auto"
                        loop={false}
                        muted={!isCurrent}
                        playsInline
                        onEnded={isCurrent ? handleEnded : undefined}
                        onCanPlay={() => handleCanPlay(video.id)}
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
