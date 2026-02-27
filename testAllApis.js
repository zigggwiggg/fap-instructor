import fs from 'fs';

// Read the VITE_ADULT_DATA_LINK_API_KEY from .env.local
let adlKey = '';
try {
    const env = fs.readFileSync('.env.local', 'utf-8');
    const match = env.match(/VITE_ADULT_DATA_LINK_API_KEY=(.*)/);
    if (match) adlKey = match[1].trim();
} catch (e) {
    console.warn("Could not read .env.local");
}

async function testReddit() {
    try {
        const res = await fetch('https://www.reddit.com/r/amateur/top.json?t=all&limit=5', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) browser-test/1.0' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ Reddit API OK: ${data.data.children.length} posts retrieved.`);
    } catch (e) {
        console.error('❌ Reddit API ERROR:', e.message);
    }
}

async function testScrolller() {
    try {
        const query = `
        query testQuery {
            getSubreddit(url: "/r/amateur") {
                children(limit: 5, sort: TOP) {
                    iterator
                    items { url }
                }
            }
        }`;
        const res = await fetch('https://api.scrolller.com/api/v2/graphql', {
            method: 'POST',
            body: JSON.stringify({ query }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ Scrolller API OK: ${data.data.getSubreddit.children.items.length} items retrieved.`);
    } catch (e) {
        console.error('❌ Scrolller API ERROR:', e.message);
    }
}

async function testRule34() {
    try {
        const res = await fetch('https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=5&tags=video');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ Rule34 API OK: ${data.length} posts retrieved.`);
    } catch (e) {
        console.error('❌ Rule34 API ERROR:', e.message);
    }
}

async function testAdultDataLink() {
    if (!adlKey) {
        console.error('❌ AdultDataLink API ERROR: Missing VITE_ADULT_DATA_LINK_API_KEY');
        return;
    }
    try {
        const res = await fetch('https://api.adultdatalink.com/eporner/search?q=amateur', {
            headers: { 'Authorization': `Bearer ${adlKey}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ AdultDataLink API OK: ${data.data ? data.data.length : 0} items retrieved.`);
    } catch (e) {
        console.error('❌ AdultDataLink API ERROR:', e.message);
    }
}

async function testRedGifs() {
    try {
        // Step 1: Get temp auth token
        const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary');
        if (!authRes.ok) throw new Error(`Auth HTTP ${authRes.status}`);
        const authData = await authRes.json();
        const token = authData.token;

        // Step 2: Fetch niche
        const res = await fetch('https://api.redgifs.com/v2/search?search_text=amateur&count=5&order=top', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ RedGifs API OK: ${data.gifs ? data.gifs.length : 0} gifs retrieved.`);
    } catch (e) {
        console.error('❌ RedGifs API ERROR:', e.message);
    }
}

async function main() {
    console.log('====================================');
    console.log('Testing All Video Provider APIs...');
    console.log('====================================\n');
    await testReddit();
    await testScrolller();
    await testRule34();
    await testAdultDataLink();
    await testRedGifs();
    console.log('\n====================================');
    console.log('Done testing.');
}

main();
