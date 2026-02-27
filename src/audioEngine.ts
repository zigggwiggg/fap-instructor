import { useAudioStore } from './stores/audioStore'
import { useStrokeStore } from './stores/strokeStore'

/* ── Audio Engine v2 (Modular & Phase-Based) ── */

export type AudioCategory =
    | 'ambient'
    | 'moan'
    | 'voice'
    | 'sfx'

export type VoiceKey =
    | 'intro' | 'setup' | 'rules'
    | 'praise' | 'tease' | 'mock'
    | 'command' | 'edge_buildup' | 'edge_ride' | 'edge_cooldown'
    | 'ruin_buildup' | 'ruin_moment' | 'ruin_cooldown'
    | 'climax_buildup' | 'orgasm' | 'aftercare'

export interface AudioLayer {
    gain: GainNode
    source?: AudioBufferSourceNode
}

class AudioEngine {
    private ctx: AudioContext | null = null
    private layers: Record<string, AudioLayer> = {}
    private clipCache: Map<string, AudioBuffer> = new Map()
    private isInitialized = false

    // State
    private currentIntensity: 'light' | 'moderate' | 'intense' | 'heavy' = 'light'
    private moanTimer: ReturnType<typeof setTimeout> | null = null
    private duckingCount = 0

    // Library of long moan audio files
    private moanLibrary: AudioBuffer[] = []
    private MOAN_WAV_FILES = [
        '/audio/moans/library/342353__hornex__loud-moaning-girl-when-fucked-and-spanked.wav',
        '/audio/moans/library/345697__hornex__girl-sucks-on-a-dick-after-that-gets-fucked-and-her-pussy-filled-with-hot-load-of-cum.wav',
        '/audio/moans/library/345936__hornex__i-am-dooing-cunnilingus-to-my-gf-untill-she-comes-hard-but-moans-very-soft.wav',
        '/audio/moans/library/362216__hornex__nsfw-fucked-on-the-floor.wav'
    ]

    constructor() { }

    private initCtx() {
        if (this.ctx) return
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

        // Create standard layers
        this.createLayer('ambient', 0.3)
        this.createLayer('moan', 0.5)
        this.createLayer('voice', 1.0)
        this.createLayer('sfx', 0.6)
    }

    private createLayer(name: string, defaultGain: number) {
        if (!this.ctx) return
        const gain = this.ctx.createGain()
        gain.gain.value = defaultGain
        gain.connect(this.ctx.destination)
        this.layers[name] = { gain }
    }

    public async initialize() {
        if (this.isInitialized) return
        this.initCtx()
        if (this.ctx?.state === 'suspended') await this.ctx.resume()
        this.isInitialized = true
        console.log('[AudioEngine] Initialized')

        // Load the long moans asynchronously in background
        this.loadMoanLibrary()

        this.startAmbientLoop()
        this.scheduleRandomMoan()
    }

    private async loadMoanLibrary() {
        for (const url of this.MOAN_WAV_FILES) {
            const buffer = await this.loadClip(url)
            if (buffer) this.moanLibrary.push(buffer)
        }
        console.log(`[AudioEngine] Loaded ${this.moanLibrary.length} long moan tracks into library`)
    }

    // ── Ducking ──
    public duck(duration = 500) {
        if (!this.ctx || !this.layers.ambient) return
        this.duckingCount++
        const now = this.ctx.currentTime
        this.layers.ambient.gain.gain.linearRampToValueAtTime(0.1, now + (duration / 1000) / 2)
    }

    public unduck(duration = 500) {
        if (!this.ctx || !this.layers.ambient) return
        this.duckingCount--
        if (this.duckingCount <= 0) {
            this.duckingCount = 0
            const now = this.ctx.currentTime
            const { masterVolume } = useAudioStore.getState()
            this.layers.ambient.gain.gain.linearRampToValueAtTime(0.3 * masterVolume, now + (duration / 1000) / 2)
        }
    }

    public setCategoryVolume(cat: AudioCategory, volume: number) {
        if (!this.layers[cat]) return
        const { masterVolume } = useAudioStore.getState()
        const now = this.ctx?.currentTime || 0
        this.layers[cat].gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * masterVolume), now + 0.1)
    }

    // ── Asset Loading ──
    public async loadClip(url: string): Promise<AudioBuffer | null> {
        if (!this.ctx) return null
        if (this.clipCache.has(url)) return this.clipCache.get(url)!
        try {
            const resp = await fetch(url)
            const arrayBuf = await resp.arrayBuffer()
            const audioBuf = await this.ctx!.decodeAudioData(arrayBuf)
            this.clipCache.set(url, audioBuf)
            return audioBuf
        } catch (e) {
            console.warn(`[AudioEngine] Failed to load clip: ${url}`, e)
            return null
        }
    }

    // ── Playback ──
    public async playVoice(key: VoiceKey, _variantIndex?: number) {
        const { voiceEnabled } = useAudioStore.getState()
        if (!voiceEnabled || !this.isInitialized) return

        this.duck()

        // Try random index 1-5. It fails silently if the file doesn't exist.
        const randIndex = _variantIndex || Math.floor(Math.random() * 5) + 1
        let url = `/audio/voice/${key}/${randIndex}.mp3`

        let buffer = await this.loadClip(url)

        // Fallback to 1.mp3 if random index misses
        if (!buffer && randIndex !== 1) {
            buffer = await this.loadClip(`/audio/voice/${key}/1.mp3`)
        }

        if (buffer && this.ctx) {
            const source = this.ctx.createBufferSource()
            source.buffer = buffer

            // Adjust pitch slightly for intense moments
            if (this.currentIntensity === 'intense' || this.currentIntensity === 'heavy') {
                source.playbackRate.value = 1.05 + Math.random() * 0.05
            }

            source.connect(this.layers['voice'].gain)
            source.start(0)

            setTimeout(() => this.unduck(), buffer.duration * 1000)
            return
        }

        // If no file, just unduck
        console.warn(`[AudioEngine] Missing real voice file for: ${key}`)
        this.unduck()
    }

    public playMoan(intensity?: 'light' | 'moderate' | 'intense' | 'heavy') {
        const { moansEnabled } = useAudioStore.getState()
        if (!moansEnabled || !this.isInitialized || !this.ctx || this.moanLibrary.length === 0) return

        const finalIntensity = intensity || this.currentIntensity

        const buffer = this.moanLibrary[Math.floor(Math.random() * this.moanLibrary.length)]

        let playDuration = 3
        let layerGain = 0.5
        let playbackRate = 1.0

        if (finalIntensity === 'light') { playDuration = 3; layerGain = 0.4 }
        else if (finalIntensity === 'moderate') { playDuration = 5; layerGain = 0.6 }
        else if (finalIntensity === 'intense') { playDuration = 8; layerGain = 0.8; playbackRate = 1.05 }
        else if (finalIntensity === 'heavy') { playDuration = 12; layerGain = 1.0; playbackRate = 1.1 }

        const maxOffset = buffer.duration - playDuration - 1
        const offset = Math.max(0, Math.random() * maxOffset)

        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.playbackRate.value = playbackRate

        const fadeGain = this.ctx.createGain()
        fadeGain.gain.setValueAtTime(layerGain, this.ctx.currentTime)
        fadeGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + playDuration)

        source.connect(fadeGain)
        fadeGain.connect(this.layers['moan'].gain)

        source.start(0, offset, playDuration + 0.1)
    }

    public playTick(isEmphasis: boolean = false) {
        const { masterVolume, uiVolume, metronomeEnabled } = useAudioStore.getState()
        if (!metronomeEnabled || !this.isInitialized) return
        this.playUISfx(isEmphasis ? 880 : 440, 0.08, 0.1 * masterVolume * uiVolume)
    }

    private playUISfx(freq: number, dur: number, volume: number = 0.1) {
        if (!this.ctx) return
        const osc = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        osc.frequency.value = freq
        g.gain.setValueAtTime(volume, this.ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur)
        osc.connect(g)
        g.connect(this.ctx.destination)
        osc.start()
        osc.stop(this.ctx.currentTime + dur)
    }

    private startAmbientLoop() {
        console.log('[AudioEngine] Ambient background pulse started')
    }

    private scheduleRandomMoan() {
        if (this.moanTimer) clearTimeout(this.moanTimer)
        if (!this.isInitialized) return

        const strokeStore = useStrokeStore.getState()
        const strokeSpeed = strokeStore.strokeSpeed
        const isPlaying = strokeStore.phase !== 'idle'

        if (isPlaying) {
            this.playMoan()
        }

        const delay = strokeSpeed > 2 ? 3000 : 10000
        this.moanTimer = setTimeout(() => this.scheduleRandomMoan(), delay + Math.random() * 5000)
    }

    public updateIntensity(speed: number) {
        if (speed < 1) this.currentIntensity = 'light'
        else if (speed < 2.5) this.currentIntensity = 'moderate'
        else if (speed < 4) this.currentIntensity = 'intense'
        else this.currentIntensity = 'heavy'
    }

}

export const audioEngine = new AudioEngine()

export const initAudio = () => audioEngine.initialize()
export const playMoan = (int?: any) => audioEngine.playMoan(int)
export const updateAudioIntensity = (speed: number) => audioEngine.updateIntensity(speed)
