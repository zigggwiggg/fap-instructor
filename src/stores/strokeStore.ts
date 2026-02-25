/* ── Stroke Engine Store (Zustand) ── */

import { create } from 'zustand'
import { useConfigStore } from './configStore'

// ── Tick Audio (Web Audio API for precise timing) ──
let audioCtx: AudioContext | null = null

function playTick(volume = 0.3) {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 800
    gain.gain.setValueAtTime(volume, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.08)
}

// ── Types ──
export type StrokePhase = 'idle' | 'stroking' | 'edge_buildup' | 'riding_edge' | 'edge_cooldown' | 'ruin_buildup' | 'ruined' | 'ruin_cooldown' | 'orgasm'

interface StrokeStore {
    // ── State ──
    strokeSpeed: number          // strokes per second (0 = stopped)
    phase: StrokePhase
    isPaused: boolean
    totalStrokes: number
    edges: number
    ruins: number
    orgasms: number
    strokeWave: number[]         // timestamps for beat meter visual
    notification: string | null  // current instruction text
    lastBeatTime: number         // internal timer for beat loop

    // ── Actions ──
    setStrokeSpeed: (speed: number) => void
    randomStrokeSpeed: () => number
    tick: (deltaMs: number) => void         // called from game loop
    triggerEdge: () => void
    triggerRuin: () => void
    setPhase: (phase: StrokePhase) => void
    setNotification: (msg: string | null) => void
    pauseStrokes: () => void
    resumeStrokes: () => void
    reset: () => void
}

// ── Helpers ──
function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val))
}

function getRandomInRange(min: number, max: number) {
    return min + Math.random() * (max - min)
}

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useStrokeStore = create<StrokeStore>((set, get) => ({
    // Initial state
    strokeSpeed: 0,
    phase: 'idle',
    isPaused: false,
    totalStrokes: 0,
    edges: 0,
    ruins: 0,
    orgasms: 0,
    strokeWave: [],
    notification: null,
    lastBeatTime: 0,

    setStrokeSpeed: (speed: number) => {
        const config = useConfigStore.getState().config
        if (speed <= 0) {
            set({ strokeSpeed: 0 })
        } else {
            set({ strokeSpeed: clamp(speed, config.strokeSpeedMin, config.strokeSpeedMax) })
        }
    },

    randomStrokeSpeed: () => {
        const config = useConfigStore.getState().config
        // Bias toward middle of range
        const slow = config.strokeSpeedMin * 1.5
        const fast = config.strokeSpeedMax / 1.4
        const min = clamp(slow, config.strokeSpeedMin, config.strokeSpeedMax)
        const max = clamp(fast, config.strokeSpeedMin, config.strokeSpeedMax)
        return getRandomInRange(min, max)
    },

    // Called every frame from requestAnimationFrame loop
    tick: (deltaMs: number) => {
        const { strokeSpeed, isPaused, lastBeatTime } = get()
        if (isPaused || strokeSpeed <= 0) return

        const newBeatTime = lastBeatTime + deltaMs
        const interval = (1 / strokeSpeed) * 1000  // ms between beats

        if (newBeatTime >= interval) {
            // BEAT!
            playTick()
            set((state) => ({
                totalStrokes: state.totalStrokes + 1,
                lastBeatTime: 0,
                strokeWave: [...state.strokeWave.slice(-60), Date.now()],
            }))
        } else {
            set({ lastBeatTime: newBeatTime })
        }
    },

    // ── Edge Flow ──
    triggerEdge: async () => {
        const { setStrokeSpeed, randomStrokeSpeed: randSpeed } = get()
        const config = useConfigStore.getState().config

        // Phase 1: Build up - go fast
        set({ phase: 'edge_buildup', notification: '🔥 Get to the edge!' })
        setStrokeSpeed(config.strokeSpeedMax)

        // Wait for user to reach edge (auto after 8-15s)
        await delay(getRandomInt(8000, 15000))

        // Phase 2: Ride the edge
        set({ phase: 'riding_edge', notification: '⚡ Ride the edge... don\'t cum!' })
        setStrokeSpeed(config.strokeSpeedMax * 0.3)  // Slow down to edge speed

        const rideTime = getRandomInt(5, 25) * 1000
        await delay(rideTime)

        // Phase 3: Stop & cooldown
        set((state) => ({
            edges: state.edges + 1,
            phase: 'edge_cooldown',
            notification: '✋ Let go! Hands off.',
        }))
        setStrokeSpeed(0)

        await delay(config.edgeCooldown * 1000)

        // Phase 4: Resume
        const newSpeed = randSpeed()
        setStrokeSpeed(newSpeed)
        set({ phase: 'stroking', notification: '👊 Start stroking again' })

        await delay(3000)
        set({ notification: null })
    },

    // ── Ruin Flow ──
    triggerRuin: async () => {
        const { setStrokeSpeed, randomStrokeSpeed: randSpeed } = get()
        const config = useConfigStore.getState().config

        // Phase 1: Go max speed
        set({ phase: 'ruin_buildup', notification: '💀 Ruin it for me!' })
        setStrokeSpeed(config.strokeSpeedMax)

        // Wait for user to get close
        await delay(getRandomInt(6000, 12000))

        // Phase 2: RUIN - let go at the moment
        set((state) => ({
            ruins: state.ruins + 1,
            phase: 'ruined',
            notification: '😈 RUINED! Let go NOW!',
        }))
        setStrokeSpeed(0)

        // Cooldown
        await delay(getRandomInt(5000, 15000))

        // Phase 3: Resume
        set({ phase: 'ruin_cooldown', notification: '👊 Start stroking again' })
        const newSpeed = randSpeed()
        setStrokeSpeed(newSpeed)

        await delay(3000)
        set({ phase: 'stroking', notification: null })
    },

    setPhase: (phase) => set({ phase }),
    setNotification: (msg) => set({ notification: msg }),
    pauseStrokes: () => set({ isPaused: true }),
    resumeStrokes: () => set({ isPaused: false }),

    reset: () =>
        set({
            strokeSpeed: 0,
            phase: 'idle',
            isPaused: false,
            totalStrokes: 0,
            edges: 0,
            ruins: 0,
            orgasms: 0,
            strokeWave: [],
            notification: null,
            lastBeatTime: 0,
        }),
}))
