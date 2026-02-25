export default async function handler(req, res) {
    // CORS Headers for the browser
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Parse the full path, ignoring query param mappings and just taking from req.url
    // Example: req.url = "/api/redgifs/v2/auth/temporary?foo=bar" or just "/?path=v2/auth/temporary" depending on Vercel rewrite
    // If req.url starts with /api/redgifs/ we strip it. Otherwise if path was injected, we use that.

    let targetUrl = '';

    if (req.url && req.url.startsWith('/api/redgifs')) {
        const urlString = req.url.replace(/^\/api\/redgifs\/?/, '');
        targetUrl = `https://api.redgifs.com/${urlString}`;
    } else {
        // Fallback if Vercel stripped it
        const { path } = req.query;
        const urlPath = Array.isArray(path) ? path.join('/') : path;

        const queryToOmit = ['path'];
        const qsParams = new URLSearchParams();
        for (const [key, value] of Object.entries(req.query)) {
            if (!queryToOmit.includes(key)) {
                qsParams.append(key, value);
            }
        }
        const qs = qsParams.toString();
        targetUrl = `https://api.redgifs.com/${urlPath}${qs ? '?' + qs : ''}`;
    }

    // Create headers that perfectly mimic a browser on redgifs.com
    const newHeaders = new Headers(req.headers);
    newHeaders.delete('host');
    newHeaders.delete('accept-encoding');
    newHeaders.set('Origin', 'https://www.redgifs.com');
    newHeaders.set('Referer', 'https://www.redgifs.com/');
    newHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        const fetchRes = await fetch(targetUrl, {
            method: req.method,
            headers: newHeaders,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
        });

        const body = await fetchRes.arrayBuffer();

        // Forward the content type
        if (fetchRes.headers.get('content-type')) {
            res.setHeader('Content-Type', fetchRes.headers.get('content-type'));
        }

        res.status(fetchRes.status).send(Buffer.from(body));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
