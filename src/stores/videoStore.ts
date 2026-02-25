/* ── Video Queue Store (Zustand) ── */

import { create } from 'zustand'
import type { VideoItem } from '../types'
import { fetchByNiche, searchGifs } from '../services/redgifs'
import { fetchFromReddit } from '../services/reddit'
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

            // -- DISTRIBUTED LOAD: Split tags perfectly between Reddit and RedGifs -- //
            const mid = Math.ceil(tagsToFetch.length / 2)
            const flip = Math.random() > 0.5 // Randomize who gets the odd tag if length is uneven
            const redgifsTags = flip ? tagsToFetch.slice(0, mid) : tagsToFetch.slice(mid)
            const redditTags = flip ? tagsToFetch.slice(mid) : tagsToFetch.slice(0, mid)

            async function tryRedgifs(tags: string[]) {
                if (tags.length === 0) return
                // Expand basic tags to curated high-quality paths
                const expandedTags = tags.flatMap(t => CURATED_MAP[t]?.redgifs || [t])
                // Deduplicate and hit max 3 to avoid rate limits
                const uniqueTags = [...new Set(expandedTags)].slice(0, 3)
                const perNiche = Math.max(10, Math.floor(BATCH_SIZE / uniqueTags.length))
                const allResults: import('../services/redgifs').RedGifsGif[] = []

                for (let i = 0; i < uniqueTags.length; i++) {
                    const tag = uniqueTags[i]
                    if (i > 0) {
                        // 500ms delay between consecutive sequential hits
                        await new Promise(res => setTimeout(res, 500))
                    }
                    try {
                        const r = await fetchByNiche(tag, currentPage, perNiche, order)
                        if (r && r.gifs) allResults.push(...r.gifs)
                    } catch (err) {
                        console.warn(`[VideoStore] Niche "${tag}" failed:`, err)
                    }
                }

                if (allResults.length === 0 && uniqueTags.length > 0) {
                    console.warn(`[VideoStore] All niches failed or empty. Falling back to unified search.`)
                    try {
                        const r = await searchGifs(uniqueTags, currentPage, BATCH_SIZE, order)
                        if (r && r.gifs) allResults.push(...r.gifs)
                    } catch (err) {
                        console.warn(`[VideoStore] Unified search fallback also failed:`, err)
                    }
                }

                // Filter & Format for Extreme Quality
                const filtered = allResults.filter((g) => {
                    // Strict Quality Filters
                    if (g.duration && g.duration < 4) return false // No micro-loops
                    if (g.views && g.views < 100) return false // Must have some traction
                    if (!g.urls.hd) return false // Must have HD source

                    if (gifs && pictures) return true          // show all
                    if (gifs && !pictures) return g.type === 1 // gifs/videos only
                    if (!gifs && pictures) return g.type === 2 // images only
                    return true                                // fallback: show all
                })

                filtered.forEach(g => newItems.push({
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

            async function tryReddit(tags: string[]) {
                if (tags.length === 0) return
                let redditQueue: VideoItem[] = []

                // Map basic tags to premium subreddits
                const expandedTags = tags.flatMap(t => CURATED_MAP[t]?.reddit || [t])
                const uniqueTags = [...new Set(expandedTags)].slice(0, 3)

                for (const tag of uniqueTags) {
                    try {
                        const results = await fetchFromReddit(tag, Math.max(5, Math.floor(BATCH_SIZE / uniqueTags.length)))
                        // format
                        results.forEach(r => redditQueue.push({
                            id: r.id,
                            url: r.url,
                            thumbnail: r.thumbnail,
                            duration: r.duration,
                            tags: r.tags || [],
                            width: r.width,
                            height: r.height,
                            loaded: false,
                            hasAudio: r.hasAudio,
                            verified: false,
                            views: 0,
                            likes: 0,
                            mediaType: r.mediaType,
                            username: r.username,
                            avgColor: '#000000',
                            niches: [],
                        }))
                    } catch (err) {
                        console.warn(`[VideoStore] Reddit fallback failed for tag ${tag}`, err)
                    }
                }
                redditQueue.forEach(q => newItems.push(q))
            }

            // Execute distributed fetch (both sources get their allocated tags)
            await tryReddit(redditTags)
            await tryRedgifs(redgifsTags)

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

            // Deduplicate by id (against the current queue only)
            const existingIds = new Set(queue.map((v) => v.id))
            const finalDistinctItems = newItems.filter((g) => !existingIds.has(g.id))

            console.log(`[VideoStore] Fetched ${finalDistinctItems.length} new items from ${tagsToFetch.length} tags. (Reddit: ${redditTags.length}, RedGifs: ${redgifsTags.length})`)

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
