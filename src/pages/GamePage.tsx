import { useEffect, useState } from 'react'
// import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '../stores/taskStore'
import { useVideoStore } from '../stores/videoStore'
import { useConfigStore } from '../stores/configStore'
import { useStrokeStore } from '../stores/strokeStore'
import VideoPlayer from '../components/VideoPlayer'
import TaskDisplay from '../components/TaskDisplay'
import BeatMeter, { type BeatStyle } from '../components/BeatMeter'
import type { Action } from '../types'
import { triggerVideoPlay } from '../videoControl'

const DEMO_ACTIONS: Action[] = [
    {
        id: 'speed-slow',
        label: 'Slow Down',
        description: 'Reduce your pace to a crawl. Take it easy for the next 30 seconds.',
        category: 'speed',
        tags: ['speed', 'slow'],
        genderFilter: [],
        weight: 15,
        minIntensity: 'light',
        execute: async () => ({ completed: true, skipped: false, duration: 30 }),
    },
    // Adding more just so something triggers
    {
        id: 'speed-fast',
        label: 'Speed Up',
        description: 'Double your pace! Go fast for the next interval.',
        category: 'speed',
        tags: ['speed', 'fast'],
        genderFilter: [],
        weight: 20,
        minIntensity: 'moderate',
        execute: async () => ({ completed: true, skipped: false, duration: 30 }),
    },
]

// Little UI helper for Custom Switch
const CustomToggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onChange(!checked)}>
        <div style={{
            width: '36px', height: '20px', borderRadius: '10px',
            background: checked ? 'var(--color-accent-secondary)' : '#333',
            position: 'relative', transition: 'background 0.2s'
        }}>
            <div style={{
                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '1px', left: checked ? '17px' : '1px',
                transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
        </div>
        <span style={{ fontSize: '0.9rem', color: 'white', fontWeight: 500 }}>{label}</span>
    </div>
)

export default function GamePage() {
    const { registerActions, start, stop } = useTaskStore()
    const { isPlaying, resume, pause, advance, goBack } = useVideoStore()
    const { config } = useConfigStore()
    const { strokeSpeed, phase, edges, ruins, notification, triggerEdge, triggerRuin, setStrokeSpeed, pauseStrokes, resumeStrokes, reset: resetStrokes } = useStrokeStore()
    const [sessionTime, setSessionTime] = useState(0)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [hasStarted, setHasStarted] = useState(false)
    const [volume, setVolume] = useState(0.8)
    const [beatStyle, setBeatStyle] = useState<BeatStyle>('dot')

    // Local toggles UI state
    const [toggles, setToggles] = useState({
        voice: true, moans: true, muteVideos: false, metronome: true, beatMeter: true
    })

    const [gamePlan, setGamePlan] = useState<{
        durationSeconds: number;
        warmUpEnd: number;
        middleEnd: number;
        taperDuration: number;
        events: { type: 'edge' | 'ruin'; time: number }[];
        nextEventIndex: number;
        finaleType: 'orgasm' | 'denied' | 'ruined';
        finaleTriggered: boolean;
        showAnotherGame: boolean;
    } | null>(null)

    // Is an edge/ruin in progress?
    const isActionInProgress = phase === 'edge_buildup' || phase === 'riding_edge' || phase === 'edge_cooldown'
        || phase === 'ruin_buildup' || phase === 'ruined' || phase === 'ruin_cooldown'

    // Game duration tracking
    const durationToUse = gamePlan ? (gamePlan.durationSeconds + gamePlan.taperDuration) : config.gameDurationMin * 60
    const gameTimeRemaining = Math.max(0, Math.floor(durationToUse - sessionTime))

    useEffect(() => {
        registerActions(DEMO_ACTIONS)
        start()
        return () => {
            stop()
            useVideoStore.getState().reset()
            resetStrokes()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Session timer (pauses when game is paused)
    useEffect(() => {
        if (!hasStarted) return
        const timer = setInterval(() => {
            if (!useVideoStore.getState().isPlaying) return  // don't tick while paused
            setSessionTime((t) => {
                const newTime = t + 1
                // Progressively unlock more categories every 90 seconds
                if (newTime % 90 === 0) {
                    useVideoStore.getState().unlockMoreTags()
                }
                return newTime
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [hasStarted])

    // ── Pre-Calculated Pacing Engine ──
    useEffect(() => {
        if (!hasStarted || !gamePlan) return

        const playing = useVideoStore.getState().isPlaying
        const stroke = useStrokeStore.getState()
        if (!playing || stroke.isPaused || stroke.phase !== 'stroking') return

        // Phase 1: WARM UP (first 10% of total time) - start slow, ramp up to normal
        if (sessionTime < gamePlan.warmUpEnd) {
            const progress = sessionTime / gamePlan.warmUpEnd
            const targetSpeed = config.strokeSpeedMin + ((config.strokeSpeedMax - config.strokeSpeedMin) * 0.5) * progress
            stroke.setStrokeSpeed(Math.max(config.strokeSpeedMin, targetSpeed))
        }
        // Phase 2: MIDDLE EVENT PHASE (10% to 90% of total time) - handle scheduled events
        else if (sessionTime >= gamePlan.warmUpEnd && sessionTime < gamePlan.middleEnd) {
            const nextEvent = gamePlan.events[gamePlan.nextEventIndex]
            if (nextEvent && sessionTime >= nextEvent.time) {
                if (nextEvent.type === 'edge') stroke.triggerEdge()
                if (nextEvent.type === 'ruin') stroke.triggerRuin()

                setGamePlan(prev => prev ? { ...prev, nextEventIndex: prev.nextEventIndex + 1 } : null)
            }
        }
        // Phase 3: FINALE PHASE (Last 10% of total time) - ramp to max speed
        else if (sessionTime >= gamePlan.middleEnd && sessionTime < gamePlan.durationSeconds) {
            const finaleDuration = gamePlan.durationSeconds - gamePlan.middleEnd
            const progressInFinale = (sessionTime - gamePlan.middleEnd) / finaleDuration

            // Linear ramp from whatever speed it settled on up to Max speed
            const currentSpeed = stroke.strokeSpeed
            const targetSpeed = currentSpeed + (config.strokeSpeedMax - currentSpeed) * progressInFinale
            stroke.setStrokeSpeed(Math.min(config.strokeSpeedMax, Math.max(config.strokeSpeedMin, targetSpeed)))
        }

        // EXACT moment of finale
        if (sessionTime === gamePlan.durationSeconds && !gamePlan.finaleTriggered) {
            setGamePlan(prev => prev ? { ...prev, finaleTriggered: true } : null)
            if (gamePlan.finaleType === 'orgasm') {
                stroke.setPhase('orgasm')
                stroke.setNotification('💥 CUM NOW!')
            } else if (gamePlan.finaleType === 'denied') {
                stroke.setNotification('⛔ DENIED! Hands off.')
                stroke.setStrokeSpeed(0)
            } else if (gamePlan.finaleType === 'ruined') {
                stroke.triggerRuin() // Uses the ruin mechanic
                setTimeout(() => {
                    stroke.setNotification('💀 RUINED.')
                }, 15000)
            }
        }

        // Phase 4: POST-FINALE TAPER (Next 1/3 of total time)
        if (gamePlan.finaleTriggered && sessionTime > gamePlan.durationSeconds && sessionTime < gamePlan.durationSeconds + gamePlan.taperDuration) {
            const timeInTaper = sessionTime - gamePlan.durationSeconds
            const taperProgress = timeInTaper / gamePlan.taperDuration

            // Wait 15s to let the orgasm/ruin/denied notification process
            if (timeInTaper > 15) {
                const midSpeed = config.strokeSpeedMin + ((config.strokeSpeedMax - config.strokeSpeedMin) * 0.5)

                if (gamePlan.finaleType === 'orgasm') {
                    // Start from max speed and slowly taper down to mid speed
                    const speed = config.strokeSpeedMax - ((config.strokeSpeedMax - midSpeed) * taperProgress)
                    stroke.setStrokeSpeed(speed)
                } else if (!stroke.isPaused && stroke.strokeSpeed === 0) {
                    // For denied/ruined, resume stroking slowly to mid speed
                    stroke.setPhase('stroking')
                    stroke.setStrokeSpeed(midSpeed)
                } else {
                    // Keep stroker going
                    stroke.setStrokeSpeed(midSpeed)
                    if (stroke.phase !== 'stroking') stroke.setPhase('stroking')
                }
            }
        }

        // Game fully ends, show Another Game button
        if (gamePlan.finaleTriggered && sessionTime >= gamePlan.durationSeconds + gamePlan.taperDuration && !gamePlan.showAnotherGame) {
            setGamePlan(prev => prev ? { ...prev, showAnotherGame: true } : null)
            stroke.setNotification('🎉 Session Complete')
            // Don't pause! Let video and strokes keep going at mid speed!
        }
    }, [sessionTime, hasStarted, gamePlan, config])

    const togglePlay = () => {
        if (isPlaying) {
            pause()
            pauseStrokes()
        } else {
            resume()
            resumeStrokes()
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'black', overflow: 'hidden', fontFamily: 'sans-serif'
        }}>
            {/* The Background Video Layer */}
            <VideoPlayer muted={toggles.muteVideos} volume={volume} />

            {/* Blurred overlay until user clicks PLAY */}
            {!hasStarted && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: '16px'
                }}>
                    <button className="btn-glow animate-pulse-glow" onClick={() => {
                        setHasStarted(true)
                        resume()
                        // Call play() directly here — inside the user gesture context —
                        // to bypass browser autoplay restrictions on all platforms
                        triggerVideoPlay?.()

                        // GENERATE GAME PLAN
                        const durationMins = config.gameDurationMin + (Math.random() * (config.gameDurationMax - config.gameDurationMin))
                        const durationSec = durationMins * 60
                        const warmUpPhaseEnd = Math.floor(durationSec * 0.1)
                        const middlePhaseEnd = Math.floor(durationSec * 0.9)
                        const taperD = Math.floor(durationSec / 3)

                        const numEdges = Math.floor(config.edgesMin + Math.random() * (config.edgesMax - config.edgesMin + 1))
                        const numRuins = Math.floor(config.ruinedOrgasmsMin + Math.random() * (config.ruinedOrgasmsMax - config.ruinedOrgasmsMin + 1))

                        const events: { type: 'edge' | 'ruin'; time: number }[] = []
                        for (let i = 0; i < numEdges; i++) {
                            events.push({ type: 'edge', time: warmUpPhaseEnd + Math.random() * (middlePhaseEnd - warmUpPhaseEnd) })
                        }
                        for (let i = 0; i < numRuins; i++) {
                            events.push({ type: 'ruin', time: warmUpPhaseEnd + Math.random() * (middlePhaseEnd - warmUpPhaseEnd) })
                        }
                        events.sort((a, b) => a.time - b.time) // Chronological order

                        const rn = Math.random() * 100
                        const pO = config.finaleOrgasmProb
                        const pD = config.finaleDeniedProb
                        let fType: 'orgasm' | 'denied' | 'ruined' = 'orgasm'
                        if (rn > pO && rn <= pO + pD) {
                            fType = 'denied'
                        } else if (rn > pO + pD) {
                            fType = 'ruined'
                        }

                        setGamePlan({
                            durationSeconds: durationSec,
                            warmUpEnd: warmUpPhaseEnd,
                            middleEnd: middlePhaseEnd,
                            taperDuration: taperD,
                            events,
                            nextEventIndex: 0,
                            finaleType: fType,
                            finaleTriggered: false,
                            showAnotherGame: false
                        })

                        // Start the stroke engine at the configured minimum speed
                        setStrokeSpeed(config.strokeSpeedMin)
                        useStrokeStore.getState().setPhase('stroking')
                    }} style={{ fontSize: '1.25rem', padding: '16px 48px' }}>
                        ▶ PLAY
                    </button>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Click to start the session</p>
                </div>
            )}

            {/* Top Left Status & Controls Layer */}
            <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Header Icon/Nav */}
                <div
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', color: 'white', fontSize: '1rem', fontWeight: 600,
                        marginBottom: '1rem', cursor: 'pointer', alignSelf: 'center', marginLeft: '6rem'
                    }}
                >
                    🚀 Fap Instructor <span style={{ fontSize: '0.7rem' }}>{isSidebarOpen ? '▼' : '▶'}</span>
                </div>

                {isSidebarOpen && (
                    <>
                        {/* Stats */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ color: '#e11d48', width: '100px' }}>Elapsed:</span>
                                <span style={{ color: '#e11d48' }}>{Math.floor(sessionTime / 60)}m {sessionTime % 60}s</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ color: 'var(--color-text-muted)', width: '100px', fontSize: '0.75rem' }}>Remaining:</span>
                                <span style={{ color: gameTimeRemaining < 60 ? '#ef4444' : 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                                    {Math.floor(gameTimeRemaining / 60)}m {gameTimeRemaining % 60}s
                                </span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Stroke Grip: <span style={{ color: 'var(--color-accent-secondary)' }}>{config.startingGripStrength}</span></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Stroke Style: <span style={{ color: 'var(--color-accent-secondary)' }}>Dominant</span></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Speed: <span style={{ color: 'var(--color-accent-secondary)' }}>{strokeSpeed > 0 ? `${strokeSpeed.toFixed(1)}/s` : 'Stopped'}</span></p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Edges: <span style={{ color: '#fbbf24' }}>{edges}</span> | Ruins: <span style={{ color: '#ef4444' }}>{ruins}</span></p>
                        </div>

                        {/* Toggles Row 1 */}
                        <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
                            <CustomToggle label="Voice" checked={toggles.voice} onChange={(v) => setToggles({ ...toggles, voice: v })} />
                            <CustomToggle label="Moans" checked={toggles.moans} onChange={(v) => setToggles({ ...toggles, moans: v })} />
                            <CustomToggle label="Mute Videos" checked={toggles.muteVideos} onChange={(v) => setToggles({ ...toggles, muteVideos: v })} />
                        </div>

                        {/* Volume Slider */}
                        {!toggles.muteVideos && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', paddingLeft: '2px' }}>
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>🔈</span>
                                <input
                                    type="range"
                                    min="0" max="1" step="0.05"
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    style={{
                                        width: '100px', height: '4px', cursor: 'pointer',
                                        accentColor: 'var(--color-accent-secondary)',
                                    }}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>🔊</span>
                            </div>
                        )}

                        {/* Toggles Row 2 */}
                        <div style={{ display: 'flex', gap: '24px' }}>
                            <CustomToggle label="Metronome" checked={toggles.metronome} onChange={(v) => setToggles({ ...toggles, metronome: v })} />
                            <CustomToggle label="Beat Meter" checked={toggles.beatMeter} onChange={(v) => setToggles({ ...toggles, beatMeter: v })} />
                        </div>

                        {/* Beat Style Picker */}
                        {toggles.beatMeter && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginRight: '4px' }}>Style:</span>
                                {[
                                    { id: 'dot' as BeatStyle, icon: '⚪', tip: 'Bouncing Dot' },
                                    { id: 'eggplant' as BeatStyle, icon: '🍆', tip: 'Eggplant' },
                                    { id: 'pulse' as BeatStyle, icon: '💫', tip: 'Pulse Ring' },
                                    { id: 'wave' as BeatStyle, icon: '🌊', tip: 'Wave' },
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setBeatStyle(s.id)}
                                        title={s.tip}
                                        style={{
                                            background: beatStyle === s.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                                            border: beatStyle === s.id ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                                            borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                                            fontSize: '1rem', lineHeight: 1,
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {s.icon}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                            <button
                                onClick={triggerRuin}
                                disabled={isActionInProgress}
                                style={{
                                    background: phase === 'ruin_buildup' || phase === 'ruined' ? '#dc2626' : '#3730a3',
                                    color: 'white', border: 'none', borderRadius: '4px',
                                    padding: '8px 24px', fontSize: '0.85rem', fontWeight: 'bold',
                                    cursor: isActionInProgress ? 'not-allowed' : 'pointer',
                                    opacity: isActionInProgress ? 0.5 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                RUIN {ruins > 0 && `(${ruins})`}
                            </button>
                            <button
                                onClick={triggerEdge}
                                disabled={isActionInProgress}
                                style={{
                                    background: phase === 'edge_buildup' || phase === 'riding_edge' ? '#d97706' : '#9ca3af',
                                    color: phase === 'edge_buildup' || phase === 'riding_edge' ? 'white' : 'black',
                                    border: 'none', borderRadius: '4px',
                                    padding: '8px 24px', fontSize: '0.85rem', fontWeight: 'bold',
                                    cursor: isActionInProgress ? 'not-allowed' : 'pointer',
                                    opacity: isActionInProgress ? 0.5 : 1,
                                    transition: 'all 0.2s',
                                }}
                            >
                                EDGE {edges > 0 && `(${edges})`}
                            </button>
                        </div>

                        {/* Media Control Icons */}
                        <div style={{ display: 'flex', gap: '24px', marginTop: '24px', paddingLeft: '24px' }}>
                            <span onClick={goBack} style={{ color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} title="Previous video">⏮</span>
                            <span onClick={togglePlay} style={{ color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? '⏸' : '▶'}</span>
                            <span onClick={advance} style={{ color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} title="Next video">⏭</span>
                            <span onClick={() => {
                                if (document.fullscreenElement) {
                                    document.exitFullscreen()
                                } else {
                                    document.documentElement.requestFullscreen()
                                }
                            }} style={{ color: 'white', fontSize: '1.25rem', cursor: 'pointer' }} title="Fullscreen">⛶</span>
                        </div>
                    </>
                )}
            </div>

            {/* Top Right Area: Task Display */}
            <div style={{
                position: 'absolute', top: '24px', right: '24px',
                zIndex: 10, pointerEvents: 'none', width: '200px', display: 'flex', justifyContent: 'flex-end'
            }}>
                <div style={{ pointerEvents: 'auto', width: '100%' }}>
                    <TaskDisplay />
                </div>
            </div>

            {/* Stroke notification overlay */}
            {notification && hasStarted && (
                <div style={{
                    position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 15, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    padding: '12px 32px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    pointerEvents: 'none',
                }}>
                    <p style={{
                        color: phase.includes('ruin') ? '#ef4444' : phase.includes('edge') ? '#fbbf24' : 'white',
                        fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center', margin: 0,
                        textShadow: '0 0 20px currentColor'
                    }}>
                        {notification}
                    </p>
                </div>
            )}

            {/* End Game Overlay */}
            {gamePlan?.showAnotherGame && (
                <div style={{
                    position: 'absolute', bottom: '32px', right: '32px', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <button className="btn-glow animate-pulse-glow" onClick={() => {
                        window.location.href = '/' // Quick way to wipe state and return home
                    }} style={{ fontSize: '1.25rem', padding: '16px 48px' }}>
                        Another Game
                    </button>
                </div>
            )}

            {/* Beat Meter */}
            <BeatMeter enabled={toggles.beatMeter && hasStarted} metronomeEnabled={toggles.metronome && hasStarted} style={beatStyle} />
        </div>
    )
}
