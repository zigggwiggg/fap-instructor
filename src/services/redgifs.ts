/* ── RedGifs API Client ── */

import fallbackNichesData from './redgifs-niches-data.json'

const TOKEN_URL = '/api/redgifs/v2/auth/temporary'
const SEARCH_URL = '/api/redgifs/v2/gifs/search'

interface RedGifsToken {
    token: string
    expiresAt: number
}

export interface RedGifsGif {
    id: string
    createDate: number
    hasAudio: boolean
    urls: {
        hd: string
        sd: string
        poster: string
        thumbnail: string
        vthumbnail: string
    }
    duration: number
    tags: string[]
    verified: boolean
    views: number
    likes: number
    width: number
    height: number
    type: number        // 1 = gif/video, 2 = image
    userName: string
    avgColor: string
    published: boolean
    niches: string[]
}

interface RedGifsSearchResponse {
    page: number
    pages: number
    total: number
    gifs: RedGifsGif[]
}

let cachedToken: RedGifsToken | null = null

/**
 * Fetch a temporary bearer token from RedGifs.
 * Tokens last ~24h; we cache and auto-refresh.
 */
export async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token
    }

    const res = await fetch(TOKEN_URL)
    if (!res.ok) throw new Error(`RedGifs auth failed: ${res.status}`)

    const data = await res.json()
    cachedToken = {
        token: data.token,
        expiresAt: Date.now() + 23 * 60 * 60 * 1000, // refresh 1h before expiry
    }
    return cachedToken.token
}

export type SearchOrder = 'trending' | 'top' | 'latest' | 'best'
export type MediaTypeFilter = 'g' | 'i' | 'a'  // gif, image, all

/**
 * Search RedGifs for videos matching given tags.
 * Returns an array of video items with HD mp4 URLs.
 */
export async function searchGifs(
    tags: string[],
    page = 1,
    count = 20,
    order?: SearchOrder | '',
    mediaType: MediaTypeFilter = 'g'
): Promise<{ gifs: RedGifsGif[]; pages: number; total: number }> {
    const token = await getToken()

    const params = new URLSearchParams({
        search_text: tags.join(' '),
        count: count.toString(),
        page: page.toString(),
    })
    if (order) params.set('order', order)

    // Only add type filter if not 'all'
    if (mediaType !== 'a') {
        params.set('type', mediaType)
    }

    console.log('[RedGifs] Searching with:', {
        search_text: tags.join(' '),
        tags,
        order,
        mediaType,
        url: `${SEARCH_URL}?${params}`,
    })

    const res = await fetch(`${SEARCH_URL}?${params}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    if (!res.ok) {
        // Token expired mid-session? Clear and retry once.
        if (res.status === 401) {
            cachedToken = null
            return searchGifs(tags, page, count, order, mediaType)
        }
        if (res.status === 429) {
            console.warn(`[RedGifs] Rate limited (429) on search. Returning empty to avoid crash.`)
            return { gifs: [], pages: 0, total: 0 }
        }
        throw new Error(`RedGifs search failed: ${res.status}`)
    }

    const data: RedGifsSearchResponse = await res.json()
    return {
        gifs: data.gifs,
        pages: data.pages,
        total: data.total,
    }
}

/**
 * Fetch GIFs from a specific niche/category.
 * Uses the dedicated /v2/niches/{slug}/gifs endpoint for accurate filtering.
 */
export async function fetchByNiche(
    nicheName: string,
    page = 1,
    count = 20,
    order?: SearchOrder | '',
    retryCount = 0
): Promise<{ gifs: RedGifsGif[]; pages: number; total: number }> {
    const token = await getToken()

    // Convert niche name to slug: "joi (Jerk Off Instructions)" → "joi-jerk-off-instructions"
    const slug = nicheName.toLowerCase()
        .replace(/[()[\]{}&'"!@#$%^*+=~`|\\/<>,.:;?]/g, '') // strip special chars
        .replace(/\s+/g, '-')     // spaces → hyphens
        .replace(/-+/g, '-')      // collapse multiple hyphens
        .replace(/^-|-$/g, '')    // trim leading/trailing hyphens

    const params = new URLSearchParams({
        count: count.toString(),
        page: page.toString(),
    })
    if (order) params.set('order', order)

    const url = `/api/redgifs/v2/niches/${slug}/gifs?${params}`
    console.log('[RedGifs] Fetching niche:', { nicheName, slug, url })

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    })

    if (!res.ok) {
        if (res.status === 401) {
            cachedToken = null
            return fetchByNiche(nicheName, page, count, order)
        }
        if (res.status === 429) {
            if (retryCount < 1) {
                console.warn(`[RedGifs] Rate limited (429) on niche "${nicheName}". Waiting 30s before retry...`)
                await new Promise(r => setTimeout(r, 30000))
                return fetchByNiche(nicheName, page, count, order, retryCount + 1)
            }
            console.warn(`[RedGifs] Still rate limited on "${nicheName}" after retry. Returning empty.`)
            return { gifs: [], pages: 0, total: 0 }
        }
        // If niche not found or moved, return empty (search endpoint doesn't filter with temp tokens)
        if (res.status === 404 || res.status === 301 || res.status === 308 || res.status === 403) {
            console.warn(`[RedGifs] Niche "${nicheName}" returned ${res.status}, no matching niche found`)
            return { gifs: [], pages: 0, total: 0 }
        }
        throw new Error(`RedGifs niche fetch failed: ${res.status}`)
    }

    const data: RedGifsSearchResponse = await res.json()
    return {
        gifs: data.gifs || [],
        pages: data.pages || 0,
        total: data.total || 0,
    }
}

/**
 * Convenience: fetch a batch of media with full metadata for a given set of tags.
 */
export async function fetchVideoUrls(
    tags: string[],
    page = 1,
    count = 20,
    order?: SearchOrder | '',
    mediaType: MediaTypeFilter = 'g'
): Promise<
    {
        id: string
        url: string
        thumbnail: string
        duration: number
        tags: string[]
        width: number
        height: number
        hasAudio: boolean
        verified: boolean
        views: number
        likes: number
        mediaType: number
        username: string
        avgColor: string
        niches: string[]
    }[]
> {
    const { gifs } = await searchGifs(tags, page, count, order, mediaType)
    return gifs.map((g) => ({
        id: g.id,
        url: g.urls.hd || g.urls.sd,
        thumbnail: g.urls.thumbnail || g.urls.poster,
        duration: g.duration,
        tags: g.tags || [],
        width: g.width,
        height: g.height,
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

/**
 * Fetch all available RedGifs niches/categories.
 * The API is paginated (~30 per page, 55+ pages).
 * We fetch all pages and cache the result in memory.
 * Falls back to a bundled static list if the API is unreachable.
 */
export interface RedGifsNiche {
    name: string
    gifs: number
    subscribers: number
    thumbnail: string
}


let cachedNiches: RedGifsNiche[] | null = null

export async function fetchNiches(): Promise<RedGifsNiche[]> {
    if (cachedNiches && cachedNiches.length > 0) {
        return cachedNiches
    }

    // Parse bundled data, sort by popularity (most gifs first)
    const all = (fallbackNichesData as any[]).map((n: any) => ({
        name: n.name || '',
        gifs: n.gifs ?? 0,
        subscribers: n.subscribers ?? 0,
        thumbnail: n.thumbnail ?? '',
    }))
    all.sort((a, b) => b.gifs - a.gifs)
    cachedNiches = all
    console.log(`[RedGifs] Loaded ${cachedNiches.length} niches for matching`)
    return cachedNiches
}

