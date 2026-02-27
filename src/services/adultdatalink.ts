import type { VideoItem } from '../types'

// Securely access the AdultDataLink API and token injected in the env file
const API_KEY = import.meta.env.VITE_ADULT_DATA_LINK_API_KEY || ''
const BASE_URL = '/api/adultdatalink'

export interface AdlEpornerSearchResponse {
    videos: {
        id: string
        title: string
        url: string
        embed: string
        length_sec: number
        views: number
        default_thumb: { src: string }
    }[]
}

export interface AdlEpornerVideoResponse {
    title: string
    thumbnail: string
    duration: string
    resolution: string
    uploader: { name: string }
    views: string
    download_links?: Record<string, { url: string; size: string }>
}

export async function fetchFromAdultDataLink(tag: string, limit: number = 5): Promise<VideoItem[]> {
    console.log(`[AdultDataLink] Starting fetch for tag: "${tag}"`);
    if (!API_KEY) {
        console.warn('[AdultDataLink] Missing VITE_ADULT_DATA_LINK_API_KEY')
        return []
    }

    try {
        // Step 1: Search Eporner for the keyword/tag
        const searchUrl = `${BASE_URL}/eporner/search?query=${encodeURIComponent(tag)}`;
        console.log(`[AdultDataLink] Requesting: ${searchUrl}`);
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        })

        console.log(`[AdultDataLink] Search Response Status: ${searchRes.status}`);

        if (!searchRes.ok) {
            console.error(`[AdultDataLink] Search failed: ${searchRes.statusText}`, await searchRes.text());
            return []
        }

        const searchData = await searchRes.json()
        console.log(`[AdultDataLink] Search parsed. Items found: ${searchData?.videos?.length || 0}`);

        if (!searchData || !searchData.videos || searchData.videos.length === 0) {
            console.warn(`[AdultDataLink] No search results for tag: ${tag}`);
            return []
        }

        // Shuffle & Take 'limit' items to distribute randomness
        let resultsToProcess = [...searchData.videos]
            .sort(() => 0.5 - Math.random())
            .slice(0, limit)

        console.log(`[AdultDataLink] Selected ${resultsToProcess.length} items to detail-fetch.`);

        const videoItems: VideoItem[] = []

        // Step 2: Fetch detailed video information to get direct .mp4 streaming links
        const detailedFetches = resultsToProcess.map(async (v) => {
            try {
                const infoRes = await fetch(`${BASE_URL}/eporner/video-information?video_id=${v.id}`, {
                    headers: { 'Authorization': `Bearer ${API_KEY}` }
                })
                if (!infoRes.ok) {
                    console.error(`[AdultDataLink] Info fetch failed for ${v.id}. Status: ${infoRes.status}`);
                    return null;
                }
                const infoText = await infoRes.text()
                // Safely parse JSON
                const info = JSON.parse(infoText) as AdlEpornerVideoResponse

                if (!info.download_links) {
                    console.warn(`[AdultDataLink] No download_links for ${v.id}. Keys found:`, Object.keys(info));
                    return null;
                }

                // Pick the highest resolution or fallback
                // Eporner format usually "720p_h264", "480p_h264", "1080p_h264", etc.
                const links = info.download_links
                const targetRes = links['1080p_h264'] || links['720p_h264'] || links['480p_h264'] || Object.values(links)[0]

                if (!targetRes || !targetRes.url) {
                    console.warn(`[AdultDataLink] Valid URL not found in resolution links for ${v.id}`);
                    return null;
                }

                // AdultDataLink's direct .mp4 urls can be streamed!
                // We always proxy it to bypass local ISP blocks (like India blocking Eporner)
                const isDev = import.meta.env ? import.meta.env.DEV : false
                const proxiedUrl = isDev
                    ? `/media-eporner${new URL(targetRes.url).pathname}`
                    : `/api/media?url=${encodeURIComponent(targetRes.url)}`

                return {
                    id: v.id,
                    url: proxiedUrl,
                    thumbnail: info.thumbnail || v.default_thumb?.src || '',
                    duration: v.length_sec,
                    tags: [tag, 'eporner', 'adultdatalink'],
                    width: targetRes.url.includes('1080') ? 1920 : targetRes.url.includes('720') ? 1280 : 854,
                    height: targetRes.url.includes('1080') ? 1080 : targetRes.url.includes('720') ? 720 : 480,
                    loaded: false,
                    hasAudio: true, // Eporner has audio
                    verified: true,
                    views: v.views || parseInt(info.views || '0', 10),
                    likes: 0,
                    mediaType: 1, // Video
                    username: info.uploader?.name || 'eporner',
                    avgColor: '#121212',
                    niches: [tag]
                } as VideoItem
            } catch (err) {
                console.warn(`[AdultDataLink] Failed fetching detail for ${v.id}`, err)
                return null
            }
        })

        const resolved = await Promise.all(detailedFetches)
        resolved.filter(Boolean).forEach(r => videoItems.push(r as VideoItem))

        console.log(`[AdultDataLink] Final successful items mapped: ${videoItems.length}`);
        return videoItems
    } catch (err) {
        console.error('[AdultDataLink] Fetch error:', err)
        return []
    }
}
