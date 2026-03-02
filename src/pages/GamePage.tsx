import { useEffect, useState, useCallback, useRef } from 'react'
import { useTaskStore } from '../stores/taskStore'
import { useVideoStore } from '../stores/videoStore'
import { useConfigStore } from '../stores/configStore'
import { useStrokeStore } from '../stores/strokeStore'
import VideoPlayer from '../components/VideoPlayer'
import TaskDisplay from '../components/TaskDisplay'
import BeatMeter, { type BeatStyle } from '../components/BeatMeter'
import InstructionHistory, { type HistoryEntry } from '../components/InstructionHistory'
import type { Action } from '../types'
import { triggerVideoPlay } from '../videoControl'

// Responsive hook
function useIsMobile() {
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
    useEffect(() => {
        const handler = () => setMobile(window.innerWidth <= 768)
        window.addEventListener('resize', handler)
        return () => window.removeEventListener('resize', handler)
    }, [])
    return mobile
}



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

// Icon button for the top toolbar
const ToolbarBtn = ({ icon, label, onClick, active, hotkey, compact }: {
    icon: string, label: string, onClick: () => void, active?: boolean, hotkey?: string, compact?: boolean
}) => (
    <button
        onClick={onClick}
        title={`${label}${hotkey ? ` (${hotkey})` : ''}`}
        style={{
            background: active ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.08)',
            border: active ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: compact ? '8px' : '6px 10px',
            cursor: 'pointer',
            color: active ? '#a78bfa' : 'rgba(255,255,255,0.7)',
            fontSize: compact ? '1rem' : '0.85rem',
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'all 0.2s', whiteSpace: 'nowrap',
            minWidth: compact ? '40px' : 'auto',
            minHeight: compact ? '40px' : 'auto',
            justifyContent: 'center',
        }}
    >
        {icon}
        {!compact && hotkey && <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{hotkey}</span>}
    </button>
)

export default function GamePage() {
    const mobile = useIsMobile()
    const { registerActions, start, stop } = useTaskStore()
    const { isPlaying, resume, pause, advance, goBack } = useVideoStore()
    const { config } = useConfigStore()
    const { strokeSpeed, phase, edges, ruins, notification, triggerEdge, triggerRuin, setStrokeSpeed, pauseStrokes, resumeStrokes, reset: resetStrokes } = useStrokeStore()

    const [sessionTime, setSessionTime] = useState(0)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [hasStarted, setHasStarted] = useState(false)
    const [beatStyle, setBeatStyle] = useState<BeatStyle>('dot')
    const [discreetMode, setDiscreetMode] = useState(false)
    const [showHotkeys, setShowHotkeys] = useState(false)
    const [instructionHistory, setInstructionHistory] = useState<HistoryEntry[]>([])
    const [showHistory, setShowHistory] = useState(!mobile) // Hidden by default on mobile
    const historyIdRef = useRef(0)
    const [toggles, setToggles] = useState({ beatMeter: true, muteVideos: false })


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

    const currentAction = useTaskStore(s => s.currentAction)

    // Helper to add to instruction history
    const addToHistory = useCallback((text: string, type: HistoryEntry['type'] = 'notification') => {
        const now = new Date()
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        historyIdRef.current += 1
        setInstructionHistory(prev => [...prev.slice(-50), { // Keep last 50 entries
            id: historyIdRef.current,
            time: timeStr,
            text,
            type,
        }])
    }, [])

    // Track notifications in history
    useEffect(() => {
        if (notification && hasStarted) {
            const type = notification.includes('edge') || notification.includes('Edge') ? 'edge'
                : notification.includes('RUIN') || notification.includes('ruin') || notification.includes('Ruin') ? 'ruin'
                    : 'notification'
            addToHistory(notification, type)
        }
    }, [notification, hasStarted, addToHistory])

    // Track tasks in history
    useEffect(() => {
        if (currentAction && hasStarted) {
            addToHistory(`${currentAction.label}: ${currentAction.description}`, 'task')
        }
    }, [currentAction, hasStarted, addToHistory])

    useEffect(() => {
        registerActions(DEMO_ACTIONS)
        start()
        return () => {
            stop()
            useVideoStore.getState().reset()
            resetStrokes()
            if (window.speechSynthesis) window.speechSynthesis.cancel()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps




    // Session timer (pauses when game is paused)
    useEffect(() => {
        if (!hasStarted) return
        const timer = setInterval(() => {
            if (!useVideoStore.getState().isPlaying) return
            setSessionTime((t) => t + 1)
        }, 1000)
        return () => clearInterval(timer)
    }, [hasStarted])

    // ── Pre-Calculated Pacing Engine ──
    useEffect(() => {
        if (!hasStarted || !gamePlan) return

        const playing = useVideoStore.getState().isPlaying
        const stroke = useStrokeStore.getState()
        if (!playing || stroke.isPaused || stroke.phase !== 'stroking') return

        if (!config.spicyMode) {
            // Vanilla Mode: linear speed acceleration from min to max over the session duration
            const progress = Math.min(1, sessionTime / gamePlan.durationSeconds)
            // Use defaults: e.g. 0.5 to 3.5 strokes/sec
            const minSpeed = 0.5
            const maxSpeed = 3.5
            const targetSpeed = minSpeed + (maxSpeed - minSpeed) * progress
            stroke.setStrokeSpeed(targetSpeed)

            if (sessionTime === gamePlan.durationSeconds && !gamePlan.finaleTriggered) {
                setGamePlan(prev => prev ? { ...prev, finaleTriggered: true } : null)
                stroke.setPhase('orgasm')
                stroke.setNotification('💥 CLIMAX!')
            }

            if (gamePlan.finaleTriggered && sessionTime >= gamePlan.durationSeconds + 15 && !gamePlan.showAnotherGame) {
                setGamePlan(prev => prev ? { ...prev, showAnotherGame: true } : null)
                stroke.setNotification('🎉 Session Complete')
            }
            return
        }

        if (sessionTime < gamePlan.warmUpEnd) {
            const progress = sessionTime / gamePlan.warmUpEnd
            const targetSpeed = config.strokeSpeedMin + ((config.strokeSpeedMax - config.strokeSpeedMin) * 0.5) * progress
            stroke.setStrokeSpeed(Math.max(config.strokeSpeedMin, targetSpeed))
        }
        else if (sessionTime >= gamePlan.warmUpEnd && sessionTime < gamePlan.middleEnd) {
            const nextEvent = gamePlan.events[gamePlan.nextEventIndex]
            if (nextEvent && sessionTime >= nextEvent.time) {
                if (nextEvent.type === 'edge') stroke.triggerEdge()
                if (nextEvent.type === 'ruin') stroke.triggerRuin()
                setGamePlan(prev => prev ? { ...prev, nextEventIndex: prev.nextEventIndex + 1 } : null)
            }
        }
        else if (sessionTime >= gamePlan.middleEnd && sessionTime < gamePlan.durationSeconds) {
            const finaleDuration = gamePlan.durationSeconds - gamePlan.middleEnd
            const progressInFinale = (sessionTime - gamePlan.middleEnd) / finaleDuration
            const currentSpeed = stroke.strokeSpeed
            const targetSpeed = currentSpeed + (config.strokeSpeedMax - currentSpeed) * progressInFinale
            stroke.setStrokeSpeed(Math.min(config.strokeSpeedMax, Math.max(config.strokeSpeedMin, targetSpeed)))
        }

        if (sessionTime === gamePlan.durationSeconds && !gamePlan.finaleTriggered) {
            setGamePlan(prev => prev ? { ...prev, finaleTriggered: true } : null)
            if (gamePlan.finaleType === 'orgasm') {
                stroke.setPhase('orgasm')
                stroke.setNotification('💥 CUM NOW!')
            } else if (gamePlan.finaleType === 'denied') {
                stroke.setNotification('⛔ DENIED! Hands off.')
                stroke.setStrokeSpeed(0)
            } else if (gamePlan.finaleType === 'ruined') {
                stroke.triggerRuin()
                setTimeout(() => { stroke.setNotification('💀 RUINED.') }, 15000)
            }
        }

        if (gamePlan.finaleTriggered && sessionTime > gamePlan.durationSeconds && sessionTime < gamePlan.durationSeconds + gamePlan.taperDuration) {
            const timeInTaper = sessionTime - gamePlan.durationSeconds
            const taperProgress = timeInTaper / gamePlan.taperDuration
            if (timeInTaper > 15) {
                const midSpeed = config.strokeSpeedMin + ((config.strokeSpeedMax - config.strokeSpeedMin) * 0.5)
                if (gamePlan.finaleType === 'orgasm') {
                    const speed = config.strokeSpeedMax - ((config.strokeSpeedMax - midSpeed) * taperProgress)
                    stroke.setStrokeSpeed(speed)
                } else if (!stroke.isPaused && stroke.strokeSpeed === 0) {
                    stroke.setPhase('stroking')
                    stroke.setStrokeSpeed(midSpeed)
                } else {
                    stroke.setStrokeSpeed(midSpeed)
                    if (stroke.phase !== 'stroking') stroke.setPhase('stroking')
                }
            }
        }

        if (gamePlan.finaleTriggered && sessionTime >= gamePlan.durationSeconds + gamePlan.taperDuration && !gamePlan.showAnotherGame) {
            setGamePlan(prev => prev ? { ...prev, showAnotherGame: true } : null)
            stroke.setNotification('🎉 Session Complete')
        }
    }, [sessionTime, hasStarted, gamePlan, config])

    const togglePlay = useCallback(() => {
        if (isPlaying) {
            pause()
            pauseStrokes()
        } else {
            resume()
            resumeStrokes()
        }
    }, [isPlaying, pause, resume, pauseStrokes, resumeStrokes])

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen()
        } else {
            document.documentElement.requestFullscreen()
        }
    }, [])

    const toggleDiscreet = useCallback(() => {
        setDiscreetMode(prev => !prev)
    }, [])

    // ── KEYBOARD SHORTCUTS ──
    useEffect(() => {
        if (!hasStarted) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

            switch (e.key.toLowerCase()) {
                case 'p':
                case ' ': // Spacebar
                    e.preventDefault()
                    togglePlay()
                    break
                case 'e':
                    e.preventDefault()
                    if (!isActionInProgress) triggerEdge()
                    break
                case 'r':
                    e.preventDefault()
                    if (!isActionInProgress) triggerRuin()
                    break
                case 'arrowright':
                    e.preventDefault()
                    advance()
                    break
                case 'arrowleft':
                    e.preventDefault()
                    goBack()
                    break
                case 'f':
                    e.preventDefault()
                    toggleFullscreen()
                    break
                case 'd':
                    e.preventDefault()
                    toggleDiscreet()
                    break

                case 'h':
                    e.preventDefault()
                    setShowHistory(prev => !prev)
                    break
                case 's':
                    e.preventDefault()
                    setIsSidebarOpen(prev => !prev)
                    break
                case 'escape':
                    e.preventDefault()
                    setShowHotkeys(false)
                    setIsSidebarOpen(false)
                    break
                case '?':
                    e.preventDefault()
                    setShowHotkeys(prev => !prev)
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [hasStarted, togglePlay, isActionInProgress, triggerEdge, triggerRuin, advance, goBack, toggleFullscreen, toggleDiscreet])

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'black', overflow: 'hidden', fontFamily: 'sans-serif'
        }}>
            {/* The Background Video Layer */}
            <VideoPlayer muted={toggles.muteVideos} />

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
                        setIsSidebarOpen(false)
                        resume()

                        triggerVideoPlay?.()
                        addToHistory('Session started', 'system')

                        // GENERATE GAME PLAN
                        const durationMins = config.gameDurationMin + (Math.random() * (config.gameDurationMax - config.gameDurationMin))
                        const durationSec = durationMins * 60
                        const warmUpPhaseEnd = Math.floor(durationSec * 0.1)
                        const middlePhaseEnd = Math.floor(durationSec * 0.9)
                        const taperD = Math.floor(durationSec / 3)

                        const numEdges = config.spicyMode ? Math.floor(config.edgesMin + Math.random() * (config.edgesMax - config.edgesMin + 1)) : 0
                        const numRuins = config.spicyMode ? Math.floor(config.ruinedOrgasmsMin + Math.random() * (config.ruinedOrgasmsMax - config.ruinedOrgasmsMin + 1)) : 0

                        const events: { type: 'edge' | 'ruin'; time: number }[] = []
                        for (let i = 0; i < numEdges; i++) {
                            events.push({ type: 'edge', time: warmUpPhaseEnd + Math.random() * (middlePhaseEnd - warmUpPhaseEnd) })
                        }
                        for (let i = 0; i < numRuins; i++) {
                            events.push({ type: 'ruin', time: warmUpPhaseEnd + Math.random() * (middlePhaseEnd - warmUpPhaseEnd) })
                        }
                        events.sort((a, b) => a.time - b.time)

                        const rn = Math.random() * 100
                        const pO = config.spicyMode ? config.finaleOrgasmProb : 100
                        const pD = config.spicyMode ? config.finaleDeniedProb : 0
                        let fType: 'orgasm' | 'denied' | 'ruined' = 'orgasm'
                        if (rn > pO && rn <= pO + pD) fType = 'denied'
                        else if (rn > pO + pD) fType = 'ruined'

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

                        setStrokeSpeed(config.strokeSpeedMin)
                        useStrokeStore.getState().setPhase('stroking')
                    }} style={{ fontSize: '1.25rem', padding: '16px 48px' }}>
                        ▶ PLAY
                    </button>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Click to start the session</p>
                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.65rem', marginTop: '8px' }}>
                        Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.6rem' }}>?</kbd> during game for keyboard shortcuts
                    </p>
                </div>
            )}

            {/* ── DISCREET MODE OVERLAY ── */}
            {discreetMode && (
                <div
                    onClick={toggleDiscreet}
                    style={{
                        position: 'absolute', inset: 0, zIndex: 100,
                        background: '#1a1a2e',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: '12px', cursor: 'pointer',
                        padding: '1rem',
                    }}
                >
                    <div style={{ fontSize: mobile ? '2.5rem' : '3rem' }}>⏸</div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: mobile ? '0.8rem' : '0.85rem', fontWeight: 500, textAlign: 'center' }}>
                        {mobile ? 'Tap to resume' : 'Paused — Click or press D to resume'}
                    </p>
                </div>
            )}

            {/* ── TOP TOOLBAR ── */}
            {hasStarted && !discreetMode && (
                <div style={{
                    position: 'absolute', top: mobile ? '4px' : '8px',
                    left: mobile ? '4px' : '50%',
                    right: mobile ? '4px' : 'auto',
                    transform: mobile ? 'none' : 'translateX(-50%)',
                    zIndex: 15, display: 'flex', gap: mobile ? '2px' : '4px', alignItems: 'center',
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: mobile ? '3px 4px' : '4px 8px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    opacity: mobile ? 0.85 : 0.6,
                    transition: 'opacity 0.3s',
                    overflowX: mobile ? 'auto' : 'visible',
                    WebkitOverflowScrolling: 'touch',
                    paddingTop: 'env(safe-area-inset-top, 3px)',
                }}
                    onMouseEnter={e => { if (!mobile) e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { if (!mobile) e.currentTarget.style.opacity = '0.6' }}
                >
                    <ToolbarBtn icon="⚙️" label="Settings" onClick={() => setIsSidebarOpen(!isSidebarOpen)} hotkey="S" active={isSidebarOpen} compact={mobile} />
                    {!mobile && <ToolbarBtn icon="⌨️" label="Hotkeys" onClick={() => setShowHotkeys(!showHotkeys)} hotkey="?" active={showHotkeys} />}
                    {config.spicyMode && <ToolbarBtn icon="📜" label="History" onClick={() => setShowHistory(!showHistory)} hotkey="H" active={showHistory} compact={mobile} />}
                    <ToolbarBtn icon="👁️" label="Discreet" onClick={toggleDiscreet} hotkey="D" compact={mobile} />
                    <ToolbarBtn icon="⛶" label="Fullscreen" onClick={toggleFullscreen} hotkey="F" compact={mobile} />

                    {/* Compact media controls */}
                    <div style={{ display: 'flex', gap: '2px', marginLeft: mobile ? '4px' : '8px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: mobile ? '4px' : '8px' }}>
                        <ToolbarBtn icon="⏮" label="Previous" onClick={goBack} hotkey="←" compact={mobile} />
                        <ToolbarBtn icon={isPlaying ? '⏸' : '▶'} label={isPlaying ? 'Pause' : 'Play'} onClick={togglePlay} hotkey="P" compact={mobile} />
                        <ToolbarBtn icon="⏭" label="Next" onClick={advance} hotkey="→" compact={mobile} />
                    </div>
                </div>
            )}

            {/* ── HOTKEYS MODAL ── */}
            {showHotkeys && (
                <div
                    onClick={() => setShowHotkeys(false)}
                    style={{
                        position: 'absolute', inset: 0, zIndex: 50,
                        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'rgba(26, 26, 46, 0.95)', borderRadius: mobile ? '12px' : '16px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: mobile ? '16px' : '24px 32px',
                            width: mobile ? '95%' : 'auto',
                            minWidth: mobile ? 'auto' : '450px',
                            maxWidth: '500px',
                            maxHeight: mobile ? '80vh' : 'auto',
                            overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>⌨️ Keyboard Shortcuts</h3>
                            <button onClick={() => setShowHotkeys(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? '16px' : '24px' }}>
                            <div>
                                <h4 style={{ fontSize: '0.75rem', color: '#f472b6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                                    Media Controls
                                </h4>
                                {[
                                    ['→', 'Next slide'],
                                    ['←', 'Previous slide'],
                                    ['P / Space', 'Pause / Resume'],
                                    ['F', 'Toggle fullscreen'],
                                    ['D', 'Discreet mode'],
                                    ['M', 'Toggle metronome'],
                                ].map(([key, desc]) => (
                                    <div key={key} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                        <kbd style={{
                                            background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '4px',
                                            fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#a78bfa',
                                            border: '1px solid rgba(255,255,255,0.1)', minWidth: '32px', textAlign: 'center',
                                        }}>{key}</kbd>
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>{desc}</span>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.75rem', color: '#f472b6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                                    Game Controls
                                </h4>
                                {[
                                    ['E', 'Trigger edge'],
                                    ['R', 'Trigger ruin'],
                                    ['S', 'Toggle settings'],
                                    ['H', 'Toggle history'],
                                    ['?', 'Show hotkeys'],
                                    ['Esc', 'Close panels'],
                                ].map(([key, desc]) => (
                                    <div key={key} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                                        <kbd style={{
                                            background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '4px',
                                            fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: '#a78bfa',
                                            border: '1px solid rgba(255,255,255,0.1)', minWidth: '32px', textAlign: 'center',
                                        }}>{key}</kbd>
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>{desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── LEFT PANEL: Status HUD ── */}
            {hasStarted && !discreetMode && (
                <div style={{
                    position: 'absolute',
                    top: mobile ? '44px' : '52px',
                    left: mobile ? '4px' : '16px',
                    zIndex: 10, display: 'flex', flexDirection: 'column', gap: mobile ? '6px' : '12px',
                    paddingTop: 'env(safe-area-inset-top, 0)',
                }}>
                    {/* Compact Status HUD (always visible) */}
                    <div style={{
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        borderRadius: '10px', padding: '8px 12px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)',
                        display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span>Time:</span>
                            <span style={{ color: '#e11d48', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                {String(Math.floor(sessionTime / 60)).padStart(2, '0')}:{String(sessionTime % 60).padStart(2, '0')}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span>Remaining:</span>
                            <span style={{ color: gameTimeRemaining < 60 ? '#ef4444' : 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                                {Math.floor(gameTimeRemaining / 60)}m {gameTimeRemaining % 60}s
                            </span>
                        </div>
                        {config.spicyMode && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                                    <span>Hand:</span>
                                    <span style={{ color: 'var(--color-accent-secondary)' }}>dominant</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                                    <span>Grip:</span>
                                    <span style={{ color: 'var(--color-accent-secondary)' }}>{config.startingGripStrength.toLowerCase()}</span>
                                </div>
                            </>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span>Speed:</span>
                            <span style={{ color: 'var(--color-accent-secondary)', fontFamily: 'var(--font-mono)' }}>
                                {strokeSpeed > 0 ? `${strokeSpeed.toFixed(1)}/s` : 'Stopped'}
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons (Edge / Ruin) */}
                    <div style={{ display: 'flex', gap: mobile ? '6px' : '8px' }}>
                        <button
                            onClick={togglePlay}
                            style={{
                                width: mobile ? '44px' : '38px', height: mobile ? '44px' : '38px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                color: 'white', fontSize: mobile ? '1rem' : '0.9rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                            }}
                            title={`${isPlaying ? 'Pause' : 'Play'} (P)`}
                        >
                            {isPlaying ? '⏸' : '▶'}
                        </button>
                        {config.spicyMode && (
                            <>
                                <button
                                    onClick={() => !isActionInProgress && triggerEdge()}
                                    disabled={isActionInProgress}
                                    style={{
                                        width: mobile ? '44px' : '38px', height: mobile ? '44px' : '38px', borderRadius: '50%',
                                        background: phase.includes('edge') ? 'rgba(251, 191, 36, 0.3)' : 'rgba(255,255,255,0.1)',
                                        border: `1px solid ${phase.includes('edge') ? 'rgba(251, 191, 36, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                                        color: phase.includes('edge') ? '#fbbf24' : 'white',
                                        fontSize: mobile ? '0.75rem' : '0.65rem', cursor: isActionInProgress ? 'not-allowed' : 'pointer',
                                        opacity: isActionInProgress ? 0.4 : 1,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, transition: 'all 0.2s',
                                    }}
                                    title="Edge (E)"
                                >
                                    E{edges > 0 ? <sup style={{ fontSize: '0.5rem' }}>{edges}</sup> : null}
                                </button>
                                <button
                                    onClick={() => !isActionInProgress && triggerRuin()}
                                    disabled={isActionInProgress}
                                    style={{
                                        width: mobile ? '44px' : '38px', height: mobile ? '44px' : '38px', borderRadius: '50%',
                                        background: phase.includes('ruin') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)',
                                        border: `1px solid ${phase.includes('ruin') ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.2)'}`,
                                        color: phase.includes('ruin') ? '#ef4444' : 'white',
                                        fontSize: mobile ? '0.75rem' : '0.65rem', cursor: isActionInProgress ? 'not-allowed' : 'pointer',
                                        opacity: isActionInProgress ? 0.4 : 1,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, transition: 'all 0.2s',
                                    }}
                                    title="Ruin (R)"
                                >
                                    R{ruins > 0 ? <sup style={{ fontSize: '0.5rem' }}>{ruins}</sup> : null}
                                </button>
                            </>
                        )}
                    </div>

                    {/* Settings Panel (expandable) */}
                    {isSidebarOpen && (
                        <div style={{
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            borderRadius: '10px', padding: '12px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', flexDirection: 'column', gap: '12px',
                            maxWidth: '260px',
                        }}>
                            <h4 style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                                Audio & Display
                            </h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                <CustomToggle label="Mute Videos" checked={toggles.muteVideos} onChange={(v) => setToggles({ ...toggles, muteVideos: v })} />
                                <CustomToggle label="Beat Meter" checked={toggles.beatMeter} onChange={(v) => setToggles({ ...toggles, beatMeter: v })} />
                            </div>



                            {/* Beat Style Picker */}
                            {toggles.beatMeter && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                                                fontSize: '1rem', lineHeight: 1, transition: 'all 0.15s',
                                            }}
                                        >
                                            {s.icon}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── RIGHT PANEL: Task + History ── */}
            {hasStarted && !discreetMode && config.spicyMode && (
                <div style={{
                    position: 'absolute',
                    top: mobile ? 'auto' : '52px',
                    bottom: mobile ? '70px' : 'auto',
                    right: mobile ? '4px' : '16px',
                    zIndex: 10,
                    width: mobile ? '180px' : '220px',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    opacity: mobile ? 0.75 : 0.6,
                    transition: 'opacity 0.3s ease',
                    maxHeight: mobile ? '40vh' : 'auto',
                    overflowY: mobile ? 'auto' : 'visible',
                }}
                    onMouseEnter={e => { if (!mobile) e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { if (!mobile) e.currentTarget.style.opacity = '0.6' }}
                    onTouchStart={e => { e.currentTarget.style.opacity = '1' }}
                    onTouchEnd={e => {
                        const target = e.currentTarget;
                        setTimeout(() => { if (target) target.style.opacity = mobile ? '0.75' : '0.6' }, 2000)
                    }}
                >
                    <TaskDisplay />
                    <InstructionHistory entries={instructionHistory} visible={showHistory} />
                </div>
            )}

            {/* Stroke notification overlay */}
            {notification && hasStarted && !discreetMode && (
                <div style={{
                    position: 'absolute', bottom: mobile ? '80px' : '100px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 15, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    padding: mobile ? '8px 20px' : '12px 32px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    pointerEvents: 'none',
                    maxWidth: mobile ? '90%' : 'auto',
                }}>
                    <p style={{
                        color: phase.includes('ruin') ? '#ef4444' : phase.includes('edge') ? '#fbbf24' : 'white',
                        fontSize: mobile ? '0.9rem' : '1.1rem', fontWeight: 'bold', textAlign: 'center', margin: 0,
                        textShadow: '0 0 20px currentColor'
                    }}>
                        {notification}
                    </p>
                </div>
            )}

            {/* End Game Overlay */}
            {gamePlan?.showAnotherGame && !discreetMode && (
                <div style={{
                    position: 'absolute', bottom: mobile ? '16px' : '32px',
                    left: mobile ? '16px' : 'auto',
                    right: mobile ? '16px' : '32px',
                    zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <button className="btn-glow animate-pulse-glow" onClick={() => {
                        window.location.href = '/'
                    }} style={{ fontSize: mobile ? '1rem' : '1.25rem', padding: mobile ? '14px 32px' : '16px 48px', width: mobile ? '100%' : 'auto' }}>
                        Another Game
                    </button>
                </div>
            )}

            {/* Beat Meter */}
            {!discreetMode && (
                <BeatMeter enabled={hasStarted && toggles.beatMeter} metronomeEnabled={false} style={beatStyle} />
            )}

        </div>
    )
}
