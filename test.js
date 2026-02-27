fetch('https://api.scrolller.com/api/v2/graphql', {
    method: 'POST',
    body: JSON.stringify({
        query: 'query SubredditQuery($url: String!) { getSubreddit(url: $url) { children(limit: 5) { iterator items { url title mediaSources { url resolution } } } } }',
        variables: { url: '/r/blowjobs' }
    })
}).then(r => r.json()).then(r => console.log(JSON.stringify(r))).catch(console.error)
