fetch('https://api.scrolller.com/api/v2/graphql', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify({
        query: "query SubReddit($url: String!, $limit: Int!) { getSubreddit(url: $url) { children(sort: TOP, limit: $limit, filter: VIDEO) { items { id } } } }",
        variables: { url: "/r/cats", limit: 10 }
    })
}).then(async r => {
    console.log(r.status, r.statusText);
    const text = await r.text()
    console.log(text.substring(0, 100))
}).catch(e => console.error(e));
