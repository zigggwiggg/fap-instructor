/* ── Beat Meter Component (Enhanced) ── */

import { useEffect, useRef, useCallback } from 'react'
import { useStrokeStore } from '../stores/strokeStore'

export type BeatStyle = 'dot' | 'eggplant' | 'pulse' | 'wave'

interface BeatMeterProps {
    enabled: boolean
    metronomeEnabled: boolean
    style?: BeatStyle
}

export default function BeatMeter({ enabled, metronomeEnabled, style = 'dot' }: BeatMeterProps) {
    const { strokeSpeed, phase, isPaused } = useStrokeStore()
    const dotRef = useRef<HTMLDivElement>(null)
    const emojiRef = useRef<HTMLDivElement>(null)
    const animRef = useRef<number>(0)
    const lastTimeRef = useRef<number>(0)
    const posRef = useRef<number>(0.5)
    const dirRef = useRef<number>(1)
    const pulseRef = useRef<number>(0)

    // Main animation loop
    const animate = useCallback((timestamp: number) => {
        if (lastTimeRef.current === 0) lastTimeRef.current = timestamp
        const delta = timestamp - lastTimeRef.current
        lastTimeRef.current = timestamp

        const paused = useStrokeStore.getState().isPaused

        // Drive the stroke tick engine
        if (metronomeEnabled && strokeSpeed > 0 && !paused) {
            useStrokeStore.getState().tick(delta)
        }

        if (strokeSpeed > 0 && enabled && !paused) {
            // ── Bouncing dot style ──
            if (style === 'dot' && dotRef.current) {
                const speed = strokeSpeed * 2
                const step = (speed * delta) / 1000
                posRef.current += step * dirRef.current

                if (posRef.current >= 1) { posRef.current = 1; dirRef.current = -1 }
                else if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1 }

                dotRef.current.style.left = `${posRef.current * 100}%`
                const intensity = Math.min(strokeSpeed / 4, 1)
                dotRef.current.style.boxShadow = `0 0 ${8 + intensity * 20}px ${4 + intensity * 8}px rgba(52, 211, 153, ${0.3 + intensity * 0.5})`
            }

            // ── Eggplant / Pulse Ring / Wave styles ──
            if ((style === 'eggplant' || style === 'pulse' || style === 'wave') && emojiRef.current) {
                const cycleSpeed = strokeSpeed * 2 * Math.PI
                pulseRef.current += (cycleSpeed * delta) / 1000
                const pulse = (Math.sin(pulseRef.current) + 1) / 2

                if (style === 'eggplant') {
                    const scale = 1 + pulse * 0.5
                    const glow = pulse * 30
                    emojiRef.current.style.transform = `scale(${scale})`
                    emojiRef.current.style.filter = `drop-shadow(0 0 ${glow}px rgba(128, 90, 213, 0.8))`
                } else if (style === 'pulse') {
                    const scale = 0.8 + pulse * 0.6
                    const opacity = 0.4 + pulse * 0.6
                    emojiRef.current.style.transform = `scale(${scale})`
                    emojiRef.current.style.opacity = `${opacity}`
                } else if (style === 'wave') {
                    const y = Math.sin(pulseRef.current) * 8
                    const x = Math.cos(pulseRef.current * 0.5) * 20
                    emojiRef.current.style.transform = `translate(${x}px, ${y}px)`
                }
            }
        }

        animRef.current = requestAnimationFrame(animate)
    }, [strokeSpeed, enabled, metronomeEnabled, isPaused, style])

    useEffect(() => {
        lastTimeRef.current = 0
        animRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(animRef.current)
    }, [animate])

    // Phase-based color
    const getBarColor = () => {
        switch (phase) {
            case 'edge_buildup': case 'riding_edge': return 'rgba(251, 191, 36, 0.6)'
            case 'ruin_buildup': case 'ruined': return 'rgba(239, 68, 68, 0.6)'
            case 'edge_cooldown': case 'ruin_cooldown': return 'rgba(107, 114, 128, 0.4)'
            default: return 'rgba(244, 114, 182, 0.5)'
        }
    }

    const getDotColor = () => {
        switch (phase) {
            case 'edge_buildup': case 'riding_edge': return '#fbbf24'
            case 'ruin_buildup': case 'ruined': return '#ef4444'
            case 'edge_cooldown': case 'ruin_cooldown': return '#6b7280'
            default: return '#f472b6'
        }
    }

    const getGlowColor = () => {
        switch (phase) {
            case 'edge_buildup': case 'riding_edge': return 'rgba(251, 191, 36, 0.4)'
            case 'ruin_buildup': case 'ruined': return 'rgba(239, 68, 68, 0.4)'
            case 'edge_cooldown': case 'ruin_cooldown': return 'rgba(107, 114, 128, 0.2)'
            default: return 'rgba(244, 114, 182, 0.4)'
        }
    }

    if (!enabled) return null

    return (
        <div style={{
            position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
        }}>

            <div style={{
                width: '90%', maxWidth: '600px', position: 'relative', height: '24px',
                marginBottom: '20px',
            }}>
                {/* Timeline track */}
                <div style={{
                    position: 'absolute', top: '50%', left: '0', right: '0', height: '2px',
                    background: `linear-gradient(90deg, transparent 0%, ${getBarColor()} 20%, ${getBarColor()} 80%, transparent 100%)`,
                    transform: 'translateY(-50%)',
                }} />

                {/* ── Bouncing dot overlaid ── */}
                {style === 'dot' && (
                    <>
                        <div style={{
                            position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)',
                            width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)'
                        }} />
                        <div ref={dotRef} style={{
                            position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                            left: '50%', width: '14px', height: '14px', borderRadius: '50%',
                            background: getDotColor(),
                            boxShadow: `0 0 12px 6px ${getGlowColor()}`,
                            transition: strokeSpeed <= 0 ? 'all 0.3s' : 'none',
                            zIndex: 2,
                        }} />
                        <div style={{
                            position: 'absolute', right: '0', top: '50%', transform: 'translateY(-50%)',
                            width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)'
                        }} />
                    </>
                )}
            </div>

            {/* ── Alternative visualizations below timeline ── */}
            {style === 'eggplant' && (
                <div ref={emojiRef} style={{
                    fontSize: '2.5rem', marginBottom: '16px',
                    transition: strokeSpeed <= 0 ? 'all 0.3s' : 'none',
                    willChange: 'transform, filter',
                }}>
                    🍆
                </div>
            )}

            {style === 'pulse' && (
                <div ref={emojiRef} style={{
                    width: '30px', height: '30px', borderRadius: '50%', marginBottom: '16px',
                    border: `2px solid ${getDotColor()}`,
                    boxShadow: `0 0 15px 5px ${getBarColor()}, inset 0 0 8px ${getBarColor()}`,
                    transition: strokeSpeed <= 0 ? 'all 0.3s' : 'none',
                    willChange: 'transform, opacity',
                }} />
            )}

            {style === 'wave' && (
                <div style={{ position: 'relative', width: '60px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <div ref={emojiRef} style={{
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: getDotColor(),
                        boxShadow: `0 0 12px 4px ${getBarColor()}`,
                        transition: strokeSpeed <= 0 ? 'all 0.3s' : 'none',
                        willChange: 'transform',
                    }} />
                </div>
            )}
        </div>
    )
}
