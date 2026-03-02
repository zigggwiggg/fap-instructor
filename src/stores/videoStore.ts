/* ── Video Queue Store (Zustand) ── */

import { create } from 'zustand'
import type { VideoItem } from '../types'
import { searchGifs } from '../services/redgifs'
import { useConfigStore } from './configStore'
import { shouldUseSD, getPerNicheCount, getConnectionQuality } from '../utils/network'

interface VideoStore {
    queue: VideoItem[]
    currentIndex: number
    isPlaying: boolean
    isLoading: boolean
    error: string | null
    searchTags: string[]
    currentPage: number
    hasMore: boolean

    setTags: (tags: string[]) => void
    fetchMore: () => Promise<void>
    advance: () => void
    goBack: () => void
    pause: () => void
    resume: () => void
    markLoaded: (id: string) => void
    reset: () => void

    // Internal state for backoff
    retryDelay: number
}

const PREFETCH_THRESHOLD = 3

// Rewrite CDN URLs through our Vercel Edge proxy
function proxyMedia(url: string): string {
    if (!url) return url
    if (url.startsWith('https://media.redgifs.com/')) {
        const isDev = import.meta.env ? import.meta.env.DEV : false
        if (isDev) {
            return `/media-redgifs${new URL(url).pathname}`
        }
        return `/api/media?url=${encodeURIComponent(url)}`
    }
    return url
}

export const useVideoStore = create<VideoStore>((set, get) => ({
    queue: [],
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    error: null,
    searchTags: ['nsfw'],
    currentPage: 1,
    hasMore: true,
    retryDelay: 2000,

    setTags: (tags) => {
        set({ searchTags: tags, queue: [], currentIndex: 0, currentPage: 1, hasMore: true })
    },

    fetchMore: async () => {
        const { isLoading, hasMore, currentPage, queue } = get()
        if (isLoading || !hasMore) return

        const gameConfig = useConfigStore.getState().config

        set({ isLoading: true, error: null })

        try {
            const allTags = gameConfig.tags && gameConfig.tags.length > 0
                ? gameConfig.tags
                : ['amateur girls', 'blowjobs', 'real couples']

            // Pick ONLY ONE random niche from the user's selection per batch.
            // This guarantees we only make 1 API call per fetch cycle, completely eliminating 429 errors.
            const tagsToFetch = [...allTags].sort(() => 0.5 - Math.random()).slice(0, 1)

            const newItems: VideoItem[] = []
            const perNiche = getPerNicheCount()
            const allResults: { gif: import('../services/redgifs').RedGifsGif, searchTag: string }[] = []

            // -- IDENTITY: inject orientation niche if needed --
            const { gender, orientation } = gameConfig
            let fetchTags = [...tagsToFetch]
            if (orientation === 'gay' && gender === 'male') {
                if (!fetchTags.some(t => t.includes('gay'))) fetchTags.unshift('gay')
            } else if (orientation === 'lesbian' && gender === 'female') {
                if (!fetchTags.some(t => t.includes('lesbian'))) fetchTags.unshift('lesbian')
            }

            // Fetch each tag: exclusively use search API, because custom tags break the niche endpoint
            for (let i = 0; i < fetchTags.length; i++) {
                const tag = fetchTags[i]
                try {
                    const r = await searchGifs([tag], currentPage, perNiche)
                    if (r?.gifs) {
                        allResults.push(...r.gifs.map(g => ({ gif: g, searchTag: tag })))
                    }

                    // Wait 1 second between API calls to prevent 429 errors
                    if (i < fetchTags.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000))
                    }
                } catch (err) {
                    console.warn(`[VideoStore] Fetch "${tag}" failed:`, err)
                }
            }

            // Filter for quality and orientation
            const filtered = allResults.filter(({ gif: g }) => {
                if (g.views && g.views < 100) return false
                if (g.type === 2) return false  // skip images
                if (g.duration && g.duration < 4) return false

                const useSD = shouldUseSD()
                if (!useSD && !g.urls.hd) return false
                if (useSD && !g.urls.sd && !g.urls.hd) return false

                const videoTags = (g.tags || []).map((t: string) => t.toLowerCase())
                // We rely entirely on the RedGifs search algorithm to provide relevant videos.
                // Doing strict string matching against client-side tags causes false negatives 
                // for perfectly valid searches (like "footjob").

                // Orientation filtering
                const gTags = videoTags
                const isGay = gTags.includes('gay')
                const isTrans = gTags.includes('trans') || gTags.includes('shemale') || gTags.includes('ladyboy')
                const isLesbian = gTags.includes('lesbian')

                if (orientation === 'straight') {
                    if (isGay || isTrans) return false
                } else if (orientation === 'gay') {
                    if (gender === 'male' && !isGay) {
                        if (gTags.includes('pussy') || isLesbian) return false
                    }
                } else if (orientation === 'lesbian') {
                    if (gender === 'female' && !isLesbian) {
                        if (isGay || gTags.includes('cock')) return false
                    }
                }

                return true
            })

            // Build VideoItems
            const useSD = shouldUseSD()
            const quality = getConnectionQuality()
            if (useSD) console.log(`[VideoStore] Using SD quality (connection: ${quality})`)

            filtered.forEach(({ gif: g, searchTag }) => {
                const mediaUrl = useSD ? (g.urls.sd || g.urls.hd) : (g.urls.hd || g.urls.sd)
                newItems.push({
                    id: g.id,
                    url: proxyMedia(mediaUrl),
                    thumbnail: g.urls.thumbnail || g.urls.poster,
                    duration: g.duration,
                    tags: g.tags || [],
                    width: g.width,
                    height: g.height,
                    loaded: false,
                    hasAudio: g.hasAudio ?? false,
                    verified: g.verified ?? false,
                    views: g.views ?? 0,
                    likes: g.likes ?? 0,
                    mediaType: g.type ?? 1,
                    username: g.userName ?? '',
                    avgColor: g.avgColor ?? '#000000',
                    niches: g.niches ?? [],
                    searchTag,
                })
            })

            // Shuffle
            for (let i = newItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newItems[i], newItems[j]] = [newItems[j], newItems[i]]
            }

            if (newItems.length === 0) {
                const { retryDelay } = get()
                // If we've hit max backoff, give up to save rate limits
                if (retryDelay > 15000) {
                    set({
                        isLoading: false,
                        error: 'No videos found or rate limit hit. Please try different niches or wait a few minutes.',
                        hasMore: false
                    })
                    return
                }

                console.warn(`[VideoStore] No items fetched. Will retry in ${retryDelay}ms...`)
                set({ isLoading: false, retryDelay: retryDelay * 2 })

                setTimeout(() => {
                    const s = useVideoStore.getState()
                    if (s.queue.length === 0 && !s.isLoading && s.hasMore) s.fetchMore()
                }, retryDelay)
                return
            }

            // Success! Reset retry delay
            set({ retryDelay: 2000 })

            // Deduplicate
            const existingIds = new Set(queue.map((v) => v.id))
            const finalItems = newItems.filter((g) => {
                if (existingIds.has(g.id)) return false
                existingIds.add(g.id)
                return true
            })

            console.log(`[VideoStore] Fetched ${finalItems.length} videos from niches: [${tagsToFetch.join(', ')}]`)

            set({
                queue: [...queue, ...finalItems],
                currentPage: currentPage + 1,
                isLoading: false,
            })
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false })
        }
    },

    advance: () => {
        const { currentIndex, queue } = get()
        const nextIndex = currentIndex + 1
        set({ currentIndex: nextIndex })

        const remaining = queue.length - nextIndex
        if (remaining <= PREFETCH_THRESHOLD) {
            get().fetchMore()
        }
    },

    goBack: () => {
        const { currentIndex } = get()
        if (currentIndex > 0) {
            set({ currentIndex: currentIndex - 1 })
        }
    },

    pause: () => set({ isPlaying: false }),
    resume: () => set({ isPlaying: true }),

    markLoaded: (id: string) => {
        set({
            queue: get().queue.map((v) =>
                v.id === id ? { ...v, loaded: true } : v
            ),
        })
    },

    reset: () => {
        set({
            queue: [],
            currentIndex: 0,
            isPlaying: false,
            isLoading: false,
            error: null,
            currentPage: 1,
            hasMore: true,
            retryDelay: 2000,
        })
    },
}))
