/* ── Types ── */

export interface VideoItem {
    id: string
    url: string          // HD mp4 URL
    thumbnail: string
    duration: number
    tags: string[]
    width: number
    height: number
    loaded: boolean
    hasAudio: boolean
    verified: boolean
    views: number
    likes: number
    mediaType: number    // 1 = gif/video, 2 = image
    username: string
    avgColor: string
    niches: string[]
}

export interface UserPreferences {
    categories: string[]
    intensity: 'light' | 'moderate' | 'intense'
    interests: string[]
}

export interface UserProfile {
    id: string
    displayName: string
    gender: 'male' | 'female' | 'non-binary' | 'other'
    preferences: UserPreferences
    searchTags: string[]
}

export interface GameSession {
    id: string
    startedAt: number
    endedAt?: number
    durationSeconds: number
    tasksCompleted: number
    tasksSkipped: number
    videosWatched: number
    categoriesPlayed: string[]
}

export interface Action {
    id: string
    label: string
    description: string
    category: 'speed' | 'style' | 'intensity' | 'special'
    tags: string[]
    genderFilter: string[]   // empty = all genders
    weight: number            // relative probability weight
    minIntensity: 'light' | 'moderate' | 'intense'
    execute: () => Promise<ActionResult>
}

export interface ActionResult {
    completed: boolean
    skipped: boolean
    duration: number
}

export interface Room {
    id: string
    code: string
    hostId: string
    members: string[]
    state: RoomState
    isActive: boolean
}

export interface RoomState {
    currentVideoUrl: string | null
    isPlaying: boolean
    currentTaskId: string | null
    timestamp: number
}
export interface GameConfig {
    gameDurationMin: number
    gameDurationMax: number

    tags: string[]
    mediaTypes: { gifs: boolean; pictures: boolean; videos: boolean }
    slideDuration: number

    strokeSpeedMin: number
    strokeSpeedMax: number
    enableGripAdjustments: boolean
    startingGripStrength: string

    finaleOrgasmProb: number
    finaleDeniedProb: number
    finaleRuinedProb: number

    edgesMin: number
    edgesMax: number
    edgeCooldown: number

    ruinedOrgasmsMin: number
    ruinedOrgasmsMax: number

    enablePostOrgasmTorture: boolean
    postOrgasmMin: number
    postOrgasmMax: number

    taskFrequency: number
    tasks: {
        speed: Record<string, boolean>
        style: Record<string, boolean>
        cbt: Record<string, boolean>
        cei: Record<string, boolean>
        anal: Record<string, boolean>
        misc: Record<string, boolean>
    }
}
