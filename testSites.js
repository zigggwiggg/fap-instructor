const fetchAll = async () => {
    try {
        const gh = await fetch('https://gifhq.com/backend.php?p=1&search=amateur&sort=hottest&period=alltime&device=pc&content=all').then(r => r.text());
        const jsonMatches = [...gh.matchAll(/data-videos="([^"]+)"/g)].map(m => m[1]);

        jsonMatches.slice(0, 3).forEach((jsonStr, i) => {
            const decoded = jsonStr.replace(/&quot;/g, '"');
            try {
                console.log(`VIDEO ${i}:`, JSON.parse(decoded));
            } catch (e) {
                console.log(`VIDEO ${i} ERROR:`, decoded);
            }
        });
    } catch (e) {
        console.error(e);
    }
}
fetchAll();
