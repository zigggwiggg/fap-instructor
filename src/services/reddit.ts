import type { RedGifsGif } from './redgifs'
import { getToken } from './redgifs'

export interface RedditVideoItem {
    id: string
    url: string
    thumbnail: string
    duration: number
    tags: string[]
    width: number
    height: number
    hasAudio: boolean
    mediaType: number // 1 video
    username: string
}

const parseRedGifsId = (url: string) => {
    const match = url.match(/redgifs\.com\/watch\/([a-zA-Z0-9]+)/)
    if (match && match[1]) return match[1].toLowerCase()

    // Sometimes it's embedded or frame links
    const match2 = url.match(/redgifs\.com\/.*\/([a-zA-Z0-9]+)/)
    if (match2 && match2[1]) return match2[1].toLowerCase()

    return null
}

export async function fetchFromReddit(tag: string, count = 20): Promise<RedditVideoItem[]> {
    // Basic tag sanitization to map to subreddit names
    const sub = tag.replace(/\s+/g, '').toLowerCase()
    const endpoint = `https://www.reddit.com/r/${sub}/hot.json?limit=100`

    console.log(`[Reddit] Fetching from ${endpoint}`)

    try {
        const res = await fetch(endpoint, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) fpinst/1.0'
            }
        })

        if (!res.ok) {
            console.warn(`[Reddit] Failed to fetch sub /r/${sub}: ${res.status}`)
            return []
        }

        const data = await res.json()
        if (!data.data || !data.data.children) return []

        const posts = data.data.children
        const results: RedditVideoItem[] = []
        const redgifsIds: string[] = []

        // Extract direct Reddit MP4s and collect RedGifs IDs
        for (const p of posts) {
            const d = p.data
            if (!d || d.over_18 === false) continue // strictly adult content

            // 1. Check for RedGifs
            if (d.url && d.domain && d.domain.includes('redgifs.com')) {
                const id = parseRedGifsId(d.url)
                if (id) redgifsIds.push(id)
                continue
            }

            // 2. Check for direct Reddit hosted videos (v.redd.it)
            let videoUrl = null
            let hasAudio = false

            if (d.secure_media && d.secure_media.reddit_video && d.secure_media.reddit_video.fallback_url) {
                videoUrl = d.secure_media.reddit_video.fallback_url
                hasAudio = d.secure_media.reddit_video.has_audio ?? false
            } else if (d.preview && d.preview.reddit_video_preview && d.preview.reddit_video_preview.fallback_url) {
                videoUrl = d.preview.reddit_video_preview.fallback_url
                hasAudio = d.preview.reddit_video_preview.has_audio ?? false
            }
            // Some specific GIF hosts
            else if (d.url && (d.url.endsWith('.mp4') || d.url.endsWith('.webm'))) {
                videoUrl = d.url
            }

            if (videoUrl) {
                // Remove ?source=fallback query strings
                const cleanUrl = videoUrl.split('?')[0]

                let thumb = d.thumbnail
                if (thumb === 'nsfw' || thumb === 'default' || !thumb.startsWith('http')) {
                    thumb = d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, '&') || ''
                }

                results.push({
                    id: d.id,
                    url: cleanUrl,
                    thumbnail: thumb,
                    duration: d.secure_media?.reddit_video?.duration || 10,
                    tags: [tag],
                    width: d.secure_media?.reddit_video?.width || 720,
                    height: d.secure_media?.reddit_video?.height || 1280,
                    hasAudio,
                    mediaType: 1,
                    username: d.author || ''
                })
            }
        }

        // If we found RedGifs links, resolve them bypassing Niche-rate limits
        if (redgifsIds.length > 0) {
            try {
                const token = await getToken()
                const uniqueIds = Array.from(new Set(redgifsIds)).slice(0, count)

                console.log(`[Reddit] Resolving ${uniqueIds.length} RedGifs IDs bypassing niche rate limits...`)

                // Batch fetch
                // the endpoint is GET /v2/gifs?ids=foo,bar,baz...
                const rgUrl = `https://api.redgifs.com/v2/gifs?ids=${uniqueIds.join(',')}`
                const rgRes = await fetch(rgUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })

                if (rgRes.ok) {
                    const rgData = await rgRes.json()
                    const gifs: RedGifsGif[] = rgData.gifs || []

                    for (const g of gifs) {
                        results.push({
                            id: g.id,
                            url: g.urls.hd || g.urls.sd,
                            thumbnail: g.urls.thumbnail || g.urls.poster,
                            duration: g.duration,
                            tags: [...(g.tags || []), tag],
                            width: g.width,
                            height: g.height,
                            hasAudio: g.hasAudio ?? false,
                            mediaType: 1,
                            username: g.userName ?? ''
                        })
                    }
                }
            } catch (err) {
                console.warn(`[Reddit] Failed to resolve RedGifs from Reddit:`, err)
            }
        }

        // Shuffle
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]]
        }

        // Return up to $count results
        return results.slice(0, count)
    } catch (err) {
        console.warn(`[Reddit] Error fetching ${tag}:`, err)
        return []
    }
}
