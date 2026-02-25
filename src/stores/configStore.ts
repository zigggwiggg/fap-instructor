import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameConfig } from '../types'

export const DEFAULT_CONFIG: GameConfig = {
    gameDurationMin: 5,
    gameDurationMax: 15,

    tags: [],
    mediaTypes: { gifs: true, pictures: true, videos: true },
    slideDuration: 10,
    searchOrder: 'trending',

    strokeSpeedMin: 0.25,
    strokeSpeedMax: 4,
    enableGripAdjustments: true,
    startingGripStrength: 'Normal',

    finaleOrgasmProb: 50,
    finaleDeniedProb: 20,
    finaleRuinedProb: 30,

    edgesMin: 0,
    edgesMax: 3,
    edgeCooldown: 30,

    ruinedOrgasmsMin: 0,
    ruinedOrgasmsMax: 0,

    enablePostOrgasmTorture: false,
    postOrgasmMin: 10,
    postOrgasmMax: 60,

    taskFrequency: 15,
    tasks: {
        speed: {
            doubleStrokes: true,
            halvedStrokes: true,
            teasingStrokes: true,
            randomStrokeSpeeds: true,
            accelerationCycles: false,
            randomBeat: false,
            redLightGreenLight: false,
            clusterStrokes: false,
        },
        style: {
            dominant: true,
            nonDominant: false,
            headOnly: false,
            shaftOnly: false,
            overhandGrip: false,
        },
        cbt: {
            ballSlaps: false,
            bindCockAndBalls: false,
            rubberBands: false,
            clothespins: false,
            icyHot: false,
            toothpaste: false,
            icePlay: false,
            ballSqueeze: false,
            headPalming: false,
            scratching: false,
            flicking: false,
            breathPlay: false,
        },
        cei: {
            eatCum: false,
            precum: false,
        },
        anal: {
            buttPlug: false,
        },
        misc: {
            pickYourPoison: false,
        },
    },
}

interface ConfigStore {
    config: GameConfig
    updateConfig: (updates: Partial<GameConfig>) => void
    updateTasks: (category: keyof GameConfig['tasks'], task: string, value: boolean) => void
    resetConfig: () => void
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set) => ({
            config: DEFAULT_CONFIG,
            updateConfig: (updates) =>
                set((state) => ({ config: { ...state.config, ...updates } })),
            updateTasks: (category, task, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        tasks: {
                            ...state.config.tasks,
                            [category]: {
                                ...state.config.tasks[category],
                                [task]: value
                            }
                        }
                    }
                })),
            resetConfig: () => set({ config: DEFAULT_CONFIG }),
        }),
        {
            name: 'fpinst-advanced-config',
        }
    )
)
