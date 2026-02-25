export const config = { runtime: 'edge' }

export default async function handler(req) {
    const { searchParams } = new URL(req.url)
    const videoUrl = searchParams.get('url')

    // Only proxy media.redgifs.com URLs
    if (!videoUrl || !videoUrl.startsWith('https://media.redgifs.com/')) {
        return new Response('Forbidden', { status: 403 })
    }

    // Forward range requests for video seeking
    const headers = {
        'Referer': 'https://www.redgifs.com/',
        'Origin': 'https://www.redgifs.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }

    const rangeHeader = req.headers.get('range')
    if (rangeHeader) headers['Range'] = rangeHeader

    const upstream = await fetch(videoUrl, { headers })

    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'Content-Type': upstream.headers.get('Content-Type') || 'video/mp4',
            'Content-Length': upstream.headers.get('Content-Length') || '',
            'Content-Range': upstream.headers.get('Content-Range') || '',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
