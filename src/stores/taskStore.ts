import { create } from 'zustand'
import type { Action, ActionResult } from '../types'
import { useConfigStore } from './configStore'

interface TaskStore {
    // ── State ──
    registeredActions: Action[]
    currentAction: Action | null
    isExecuting: boolean
    isPaused: boolean
    actionHistory: { action: Action; result: ActionResult; timestamp: number }[]
    schedulerInterval: number  // ms between tasks
    schedulerTimer: ReturnType<typeof setTimeout> | null

    // ── Actions ──
    registerActions: (actions: Action[]) => void
    setInterval: (ms: number) => void
    start: () => void
    stop: () => void
    pauseScheduler: () => void
    resumeScheduler: () => void
    executeNext: (genderFilter?: string, intensityFilter?: string) => void
    skipCurrent: () => void
    completeAction: (result: ActionResult) => void
}

/**
 * Normalized weighted random selection.
 */
function weightedRandomPick(actions: Action[]): Action | null {
    if (actions.length === 0) return null
    const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0)
    let roll = Math.random() * totalWeight
    for (const action of actions) {
        roll -= action.weight
        if (roll <= 0) return action
    }
    return actions[actions.length - 1]
}

export const useTaskStore = create<TaskStore>((set, get) => ({
    registeredActions: [],
    currentAction: null,
    isExecuting: false,
    isPaused: false,
    actionHistory: [],
    schedulerInterval: 15000,
    schedulerTimer: null,

    registerActions: (actions) => set({ registeredActions: actions }),

    setInterval: (ms) => set({ schedulerInterval: ms }),

    start: () => {
        // Read interval from game config
        const configInterval = useConfigStore.getState().config.taskFrequency * 1000
        const interval = configInterval || get().schedulerInterval
        set({ isPaused: false, schedulerInterval: interval })

        const { executeNext } = get()
        const tick = () => {
            const state = get()
            if (state.isPaused || state.isExecuting) return
            executeNext()
        }
        const timer = setInterval(tick, interval)
        set({ schedulerTimer: timer as unknown as ReturnType<typeof setTimeout> })
    },

    stop: () => {
        const { schedulerTimer } = get()
        if (schedulerTimer) clearInterval(schedulerTimer as unknown as number)
        set({
            schedulerTimer: null,
            currentAction: null,
            isExecuting: false,
            isPaused: false,
        })
    },

    pauseScheduler: () => set({ isPaused: true }),
    resumeScheduler: () => set({ isPaused: false }),

    executeNext: (genderFilter, intensityFilter) => {
        const { registeredActions, isExecuting } = get()
        if (isExecuting) return

        // Filter actions by gender and intensity
        let eligible = [...registeredActions]

        if (genderFilter) {
            eligible = eligible.filter(
                (a) => a.genderFilter.length === 0 || a.genderFilter.includes(genderFilter)
            )
        }

        if (intensityFilter) {
            const levels = ['light', 'moderate', 'intense']
            const maxLevel = levels.indexOf(intensityFilter)
            eligible = eligible.filter(
                (a) => levels.indexOf(a.minIntensity) <= maxLevel
            )
        }

        const picked = weightedRandomPick(eligible)
        if (!picked) return

        set({ currentAction: picked, isExecuting: true })
    },

    skipCurrent: () => {
        const { currentAction } = get()
        if (currentAction) {
            set((state) => ({
                actionHistory: [
                    ...state.actionHistory,
                    {
                        action: currentAction,
                        result: { completed: false, skipped: true, duration: 0 },
                        timestamp: Date.now(),
                    },
                ],
                currentAction: null,
                isExecuting: false,
            }))
        }
    },

    completeAction: (result) => {
        const { currentAction } = get()
        if (currentAction) {
            set((state) => ({
                actionHistory: [
                    ...state.actionHistory,
                    { action: currentAction, result, timestamp: Date.now() },
                ],
                currentAction: null,
                isExecuting: false,
            }))
        }
    },
}))
