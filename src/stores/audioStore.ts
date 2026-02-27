import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AudioState {
    masterVolume: number
    videoVolume: number
    uiVolume: number
    moansEnabled: boolean
    voiceEnabled: boolean
    metronomeEnabled: boolean

    setMasterVolume: (v: number) => void
    setVideoVolume: (v: number) => void
    setUIVolume: (v: number) => void
    toggleMoans: () => void
    toggleVoice: () => void
    toggleMetronome: () => void
}

export const useAudioStore = create<AudioState>()(
    persist(
        (set) => ({
            masterVolume: 0.8,
            videoVolume: 0.5,
            uiVolume: 0.7,
            moansEnabled: true,
            voiceEnabled: true,
            metronomeEnabled: true,

            setMasterVolume: (v) => set({ masterVolume: v }),
            setVideoVolume: (v) => set({ videoVolume: v }),
            setUIVolume: (v) => set({ uiVolume: v }),
            toggleMoans: () => set((state) => ({ moansEnabled: !state.moansEnabled })),
            toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
            toggleMetronome: () => set((state) => ({ metronomeEnabled: !state.metronomeEnabled })),
        }),
        {
            name: 'fap-instructor-audio'
        }
    )
)
