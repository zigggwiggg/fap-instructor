/* ── Video Queue Store (Zustand) ── */

import { create } from 'zustand'
import type { VideoItem } from '../types'
import { fetchByNiche, searchGifs } from '../services/redgifs'
import { useConfigStore } from './configStore'

interface VideoStore {
    // ── State ──
    queue: VideoItem[]
    currentIndex: number
    isPlaying: boolean
    isLoading: boolean
    error: string | null
    searchTags: string[]
    currentPage: number
    hasMore: boolean
    shuffledTags: string[]
    unlockedTagCount: number

    // ── Actions ──
    setTags: (tags: string[]) => void
    fetchMore: () => Promise<void>
    advance: () => void
    goBack: () => void
    pause: () => void
    resume: () => void
    markLoaded: (id: string) => void
    unlockMoreTags: () => void
    reset: () => void
}

const PREFETCH_THRESHOLD = 3  // fetch more when < 3 unwatched videos remain
const BATCH_SIZE = 20

// Rewrite CDN URLs through our Vercel Edge proxy so hotlink protection is bypassed
function proxyMedia(url: string): string {
    if (!url) return url
    if (url.startsWith('https://media.redgifs.com/')) {
        const isDev = import.meta.env ? import.meta.env.DEV : false
        if (isDev) {
            // Local vite proxy for media chunks
            return `/media-redgifs${new URL(url).pathname}`
        }
        return `/api/media?url=${encodeURIComponent(url)}`
    }
    return url
}

// Map general tags to premium, high-quality subreddits and RedGifs specific niches/searches
const CURATED_MAP: Record<string, { reddit: string[], redgifs: string[] }> = {
    amateur: { reddit: ['Amateur', 'amateurcumsluts', 'RealGirls'], redgifs: ['amateur'] },
    blowjob: { reddit: ['blowjobs', 'SuckingItDry', 'throatpies', 'DeepThroatTears'], redgifs: ['blowjob', 'deepthroat'] },
    cumshot: { reddit: ['cumsluts', 'facial', 'cumshots', 'bodyshots'], redgifs: ['cumshot', 'facial', 'swallow'] },
    titfuck: { reddit: ['titfuck', 'tittyfuck', 'Paizuri'], redgifs: ['titfuck', 'tittyfuck'] },
    milf: { reddit: ['milf', 'MILFs', 'amateur_milfs'], redgifs: ['milf'] },
    joi: { reddit: ['JerkOffInstruction', 'JOI_titillation', 'joi'], redgifs: ['joi'] },
    teasing: { reddit: ['TeaseAndPlease', 'teasing', 'cocktease'], redgifs: ['tease', 'teasing'] },
    handjob: { reddit: ['handjobs'], redgifs: ['handjob'] },
    pussy: { reddit: ['pussy', 'godpussy', 'LegalTeens'], redgifs: ['pussy'] },
    ass: { reddit: ['ass', 'paag', 'booty'], redgifs: ['ass', 'booty'] },
    anal: { reddit: ['Anal', 'AnalGW', 'buttbound'], redgifs: ['anal'] },
    hardcore: { reddit: ['HardcoreSex', 'RoughSex'], redgifs: ['hardcore', 'rough'] },
    solo: { reddit: ['GettingHerselfOff', 'SoloMasturbation'], redgifs: ['solo', 'masturbation'] },
    lesbian: { reddit: ['lesbians', 'dykesgonewild'], redgifs: ['lesbian'] },
    threesome: { reddit: ['Threesome', 'groupsex'], redgifs: ['threesome'] },
    pov: { reddit: ['POV', 'povnsfw'], redgifs: ['pov'] },
    creampie: { reddit: ['creampies', 'Creampie'], redgifs: ['creampie'] },
    hentai: { reddit: ['hentai', 'HENTAI_GIF'], redgifs: ['hentai'] },
    toys: { reddit: ['dildos', 'suctiondildos', 'SexToys'], redgifs: ['dildo', 'toys'] }
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
    shuffledTags: [],
    unlockedTagCount: 2,

    setTags: (tags) => {
        set({ searchTags: tags, queue: [], currentIndex: 0, currentPage: 1, hasMore: true })
    },

    fetchMore: async () => {
        const { isLoading, hasMore, currentPage, queue, shuffledTags, unlockedTagCount } = get()
        if (isLoading || !hasMore) return

        const gameConfig = useConfigStore.getState().config
        const order = 'top' // Force 'top' for max quality instead of trending

        set({ isLoading: true, error: null })

        try {
            // Pick a max of 4 random tags from the CURRENTLY UNLOCKED pool (which grows over time)
            const availableTags = shuffledTags.slice(0, unlockedTagCount)
            const tagsToFetch = [...availableTags].sort(() => 0.5 - Math.random()).slice(0, 4)

            const { gifs, pictures } = gameConfig.mediaTypes

            // We'll collect completely standardized VideoItems here
            const newItems: VideoItem[] = []

            // All requested tags go directly to RedGifs
            const rgTags = tagsToFetch

            async function tryRedgifs(tags: string[]) {
                if (tags.length === 0) return
                // Expand basic tags to curated high-quality paths
                const expandedTags = tags.flatMap(t => CURATED_MAP[t]?.redgifs || [t])
                // Deduplicate and hit max 10 to distribute load further and load more variety
                const uniqueTags = [...new Set(expandedTags)].slice(0, 10)
                // Only request 2 videos per niche to keep payload tiny and lightning fast
                const perNiche = 2
                const allResults: import('../services/redgifs').RedGifsGif[] = []

                // -- IDENTITY FILTERING --
                const { gender, orientation } = gameConfig
                let filteredTags = [...uniqueTags]

                // If orientation is specific, we prioritize those niches
                if (orientation === 'gay' && gender === 'male') {
                    // Prepend or inject 'gay' niches if none are present
                    if (!filteredTags.some(t => t.includes('gay'))) {
                        filteredTags.unshift('gay')
                    }
                } else if (orientation === 'lesbian' && gender === 'female') {
                    if (!filteredTags.some(t => t.includes('lesbian'))) {
                        filteredTags.unshift('lesbian')
                    }
                }

                // Fetch all unique tags concurrently
                const fetchPromises = filteredTags.map(async (tag) => {
                    try {
                        const r = await fetchByNiche(tag, currentPage, perNiche, order)
                        return r?.gifs || []
                    } catch (err) {
                        console.warn(`[VideoStore] Niche "${tag}" failed:`, err)
                        return []
                    }
                })

                const settledResults = await Promise.allSettled(fetchPromises)
                for (const res of settledResults) {
                    if (res.status === 'fulfilled') {
                        allResults.push(...res.value)
                    }
                }

                if (allResults.length === 0 && filteredTags.length > 0) {
                    console.warn(`[VideoStore] All niches failed or empty. Falling back to unified search.`)
                    try {
                        const r = await searchGifs(filteredTags, currentPage, BATCH_SIZE * 2, order)
                        if (r && r.gifs) allResults.push(...r.gifs)
                    } catch (err) {
                        console.warn(`[VideoStore] Unified search fallback also failed:`, err)
                    }
                }

                // Filter & Format for Extreme Quality AND Orientation
                const filtered = allResults.filter((g: import('../services/redgifs').RedGifsGif) => {
                    // Strict Quality Filters
                    if (g.views && g.views < 100) return false

                    // -- ORIENTATION FILTERING --
                    const gTags = (g.tags || []).map((t: string) => t.toLowerCase())
                    const isGay = gTags.includes('gay')
                    const isTrans = gTags.includes('trans') || gTags.includes('shemale') || gTags.includes('ladyboy')
                    const isLesbian = gTags.includes('lesbian')

                    if (orientation === 'straight') {
                        if (isGay || isTrans) return false
                        if (gender === 'male' && isLesbian) {
                            // Generally, straight men consume lesbian content, but if we want "Strict Straight" 
                            // we could filter it. For now, we'll allow it unless it's tagged 'gay'.
                        }
                    } else if (orientation === 'gay') {
                        if (gender === 'male' && !isGay) {
                            // If they are specifically gay, we want to hide female-centric tags
                            if (gTags.includes('pussy') || isLesbian || gTags.includes('female solo')) return false
                        }
                    } else if (orientation === 'lesbian') {
                        if (gender === 'female' && !isLesbian) {
                            // If they are lesbian, hide male-centric tags
                            if (isGay || gTags.includes('male solo') || gTags.includes('cock')) return false
                        }
                    }
                    // Bisexual allows everything, skip specific filters

                    if (gifs && !pictures) {
                        if (g.type === 2) return false // images blocked
                        if (g.duration && g.duration < 4) return false // No micro-loops for videos
                        if (!g.urls.hd) return false // Must have HD source for videos
                    }
                    if (!gifs && pictures) {
                        if (g.type === 1) return false // videos blocked
                    }

                    return true
                })

                filtered.forEach((g: import('../services/redgifs').RedGifsGif) => newItems.push({
                    id: g.id,
                    url: proxyMedia(g.urls.hd || g.urls.sd),
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
                }))
            }

            // Execute fetch concurrently
            await Promise.allSettled([
                tryRedgifs(rgTags)
            ])

            // Shuffle results perfectly
            for (let i = newItems.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newItems[i], newItems[j]] = [newItems[j], newItems[i]]
            }

            if (newItems.length === 0) {
                console.warn('[VideoStore] No items fetched. Will retry in 2s...')
                set({ isLoading: false })
                // Retry after a short delay so the player doesn't stay black forever
                setTimeout(() => {
                    const s = useVideoStore.getState()
                    if (s.queue.length === 0 && !s.isLoading) s.fetchMore()
                }, 2000)
                return
            }

            // Deduplicate by id against current queue AND internally within new items
            const existingIds = new Set(queue.map((v) => v.id))
            const finalDistinctItems = newItems.filter((g) => {
                if (existingIds.has(g.id)) return false
                existingIds.add(g.id) // Add to set to catch intra-batch duplicates
                return true
            })

            console.log(`[VideoStore] Fetched ${finalDistinctItems.length} new items from ${tagsToFetch.length} tags from RedGifs.`)

            set({
                queue: [...queue, ...finalDistinctItems],
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

        // Auto-fetch when running low
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

    markLoaded: (id) => {
        set({
            queue: get().queue.map((v) =>
                v.id === id ? { ...v, loaded: true } : v
            ),
        })
    },

    unlockMoreTags: () => {
        const { unlockedTagCount, shuffledTags } = get()
        if (unlockedTagCount < shuffledTags.length) {
            set({ unlockedTagCount: unlockedTagCount + 1 })
            console.log(`[VideoStore] Unlocked new category! Now fetching from ${unlockedTagCount + 1} categories.`)
        }
    },

    reset: () => {
        const gameConfig = useConfigStore.getState().config
        const queryTags = gameConfig.tags && gameConfig.tags.length > 0 ? gameConfig.tags : ['amateur', 'blowjob', 'cumshot']
        const shuffled = [...queryTags].sort(() => 0.5 - Math.random())

        set({
            queue: [],
            currentIndex: 0,
            isPlaying: false,
            isLoading: false,
            error: null,
            currentPage: 1,
            hasMore: true,
            shuffledTags: shuffled,
            unlockedTagCount: 2,
        })
    },
}))
