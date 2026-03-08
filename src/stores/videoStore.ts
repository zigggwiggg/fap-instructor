/* ── Video Queue Store (Zustand) ── */

import { create } from 'zustand'
import type { VideoItem } from '../types'
import { fetchByNiche, fetchNiches } from '../services/redgifs'
import { useConfigStore } from './configStore'
import { shouldUseSD, getPerNicheCount } from '../utils/network'

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
    retryDelay: 30000,

    setTags: (tags) => {
        set({ searchTags: tags, queue: [], currentIndex: 0, currentPage: 1, hasMore: true })
    },

    fetchMore: async () => {
        const { isLoading, hasMore, currentPage } = get()
        if (isLoading || !hasMore) return

        const gameConfig = useConfigStore.getState().config

        set({ isLoading: true, error: null })

        try {
            const allTags = gameConfig.tags && gameConfig.tags.length > 0
                ? gameConfig.tags
                : ['amateur girls', 'blowjobs', 'real couples']

            // Shuffle all tags for variety
            const shuffledTags = [...allTags].sort(() => 0.5 - Math.random())

            const perNiche = getPerNicheCount()

            // -- IDENTITY: inject orientation niche if needed --
            const { gender, orientation } = gameConfig
            if (orientation === 'gay' && gender === 'male') {
                if (!shuffledTags.some(t => t.includes('gay'))) shuffledTags.unshift('gay')
            } else if (orientation === 'lesbian' && gender === 'female') {
                if (!shuffledTags.some(t => t.includes('lesbian'))) shuffledTags.unshift('lesbian')
            }

            // Build a set of known niche names for quick lookup
            const knownNiches = await fetchNiches()
            const knownNicheSet = new Set(knownNiches.map(n => n.name.toLowerCase()))

            // Helper: find the best matching niche for a custom tag
            const findMatchingNiche = (customTag: string): string | null => {
                const tagLower = customTag.toLowerCase()
                if (knownNicheSet.has(tagLower)) return customTag
                const matches = knownNiches.filter(n =>
                    n.name.toLowerCase().includes(tagLower) || tagLower.includes(n.name.toLowerCase())
                )
                if (matches.length > 0) {
                    matches.sort((a, b) => b.gifs - a.gifs)
                    console.log(`[VideoStore] Custom tag "${customTag}" → matched niche "${matches[0].name}" (${matches[0].gifs} gifs)`)
                    return matches[0].name
                }
                return null
            }

            // Helper: process results from a single niche fetch and add to queue
            const processAndEnqueue = (gifs: import('../services/redgifs').RedGifsGif[], searchTag: string, _isCustomTag: boolean) => {
                const useSD = shouldUseSD()
                const items: VideoItem[] = []

                for (const g of gifs) {
                    if (g.views && g.views < 100) continue
                    if (g.type === 2) continue
                    if (g.duration && g.duration < 4) continue
                    if (!useSD && !g.urls.hd) continue
                    if (useSD && !g.urls.sd && !g.urls.hd) continue


                    const videoTags = (g.tags || []).map((t: string) => t.toLowerCase())

                    // Tag matching is not needed here — we're fetching from the exact niche endpoint
                    // which already guarantees relevant content

                    // Orientation filtering
                    const gTags = videoTags
                    const isGay = gTags.includes('gay')
                    const isTrans = gTags.includes('trans') || gTags.includes('shemale') || gTags.includes('ladyboy')
                    const isLesbian = gTags.includes('lesbian')
                    if (orientation === 'straight' && (isGay || isTrans)) continue
                    if (orientation === 'gay' && gender === 'male' && !isGay && (gTags.includes('pussy') || isLesbian)) continue
                    if (orientation === 'lesbian' && gender === 'female' && !isLesbian && (isGay || gTags.includes('cock'))) continue

                    const mediaUrl = useSD ? (g.urls.sd || g.urls.hd) : (g.urls.hd || g.urls.sd)
                    items.push({
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
                }

                // Deduplicate against existing queue
                const currentQueue = [...useVideoStore.getState().queue]
                const existingIds = new Set(currentQueue.map(v => v.id))
                const unique = items.filter(v => {
                    if (existingIds.has(v.id)) return false
                    existingIds.add(v.id)
                    return true
                })

                if (unique.length > 0) {
                    // INSERT at random positions among UNWATCHED videos (after currentIndex)
                    // This interleaves videos from different tags instead of playing one tag continuously
                    const currentIdx = useVideoStore.getState().currentIndex
                    const updatedQueue = [...useVideoStore.getState().queue]

                    for (const vid of unique) {
                        // Random position between currentIndex+1 and end of queue
                        const insertAfter = currentIdx + 1
                        const insertPos = insertAfter + Math.floor(Math.random() * (updatedQueue.length - insertAfter + 1))
                        updatedQueue.splice(insertPos, 0, vid)
                    }

                    console.log(`[VideoStore] +${unique.length} videos from "${searchTag}" (scattered into queue)`)
                    set({ queue: updatedQueue })
                }

                return unique.length
            }

            // Resolve the niche name for each tag
            const resolvedTags = shuffledTags.map(tag => {
                const isKnown = knownNicheSet.has(tag.toLowerCase())
                let actualNiche = tag
                if (!isKnown) {
                    const matched = findMatchingNiche(tag)
                    if (matched) actualNiche = matched
                    else console.warn(`[VideoStore] No matching niche for "${tag}", trying as slug`)
                }
                return { tag, actualNiche, isCustomTag: !isKnown }
            })

            // ── FETCH FIRST TAG IMMEDIATELY (so user sees videos fast) ──
            const first = resolvedTags[0]
            if (first) {
                try {
                    const r = await fetchByNiche(first.actualNiche, currentPage, perNiche)
                    if (r?.gifs) processAndEnqueue(r.gifs, first.tag, first.isCustomTag)
                } catch (err) {
                    console.warn(`[VideoStore] Fetch "${first.tag}" failed:`, err)
                }
            }

            // If first tag returned nothing, handle retry
            if (useVideoStore.getState().queue.length === 0 && resolvedTags.length <= 1) {
                const { retryDelay } = get()
                if (retryDelay > 90000) {
                    set({
                        isLoading: false,
                        error: 'No videos found. Please try different niches or wait a few minutes.',
                        hasMore: false
                    })
                    return
                }
                console.warn(`[VideoStore] No items from first tag. Will retry in ${retryDelay / 1000}s...`)
                set({ isLoading: false, retryDelay: retryDelay * 2 })
                setTimeout(() => {
                    const s = useVideoStore.getState()
                    if (s.queue.length === 0 && !s.isLoading && s.hasMore) s.fetchMore()
                }, retryDelay)
                return
            }

            set({ retryDelay: 30000, isLoading: false, currentPage: currentPage + 1 })

            // ── FETCH REMAINING TAGS IN BACKGROUND (10s apart) ──
            const remaining = resolvedTags.slice(1)
            remaining.forEach((entry, idx) => {
                setTimeout(async () => {
                    try {
                        const r = await fetchByNiche(entry.actualNiche, currentPage, perNiche)
                        if (r?.gifs) processAndEnqueue(r.gifs, entry.tag, entry.isCustomTag)
                    } catch (err) {
                        console.warn(`[VideoStore] Background fetch "${entry.tag}" failed:`, err)
                    }
                }, (idx + 1) * 10000) // 10 seconds apart
            })

            if (remaining.length > 0) {
                console.log(`[VideoStore] Scheduled ${remaining.length} more tags, fetching every 10s: [${remaining.map(e => e.tag).join(', ')}]`)
            }
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
            retryDelay: 30000,
        })
    },
}))
