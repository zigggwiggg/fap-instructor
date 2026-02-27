export const config = { runtime: 'edge' }

export default async function handler(req) {
    const { searchParams } = new URL(req.url)
    const videoUrl = searchParams.get('url')

    // Allow redgifs and eporner to proxy
    if (!videoUrl || (!videoUrl.includes('redgifs.com') && !videoUrl.includes('eporner.com'))) {
        return new Response('Forbidden', { status: 403 })
    }

    // Forward range requests for video seeking
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }

    if (videoUrl.includes('redgifs.com')) {
        headers['Referer'] = 'https://www.redgifs.com/'
        headers['Origin'] = 'https://www.redgifs.com'
    } else if (videoUrl.includes('eporner.com')) {
        headers['Referer'] = 'https://www.eporner.com/'
        headers['Origin'] = 'https://www.eporner.com'
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
