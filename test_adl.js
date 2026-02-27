const API_KEY = "D4YCFlXcbkm-DvHQv9Y_oWTJJ3_KCwfdZwqhBS5whAc";

async function testADL() {
    // try pornhub?
    const phVidInfo = await fetch("https://api.adultdatalink.com/xnxx/search?k=amateur", { headers: { "Authorization": `Bearer ${API_KEY}` } }).then(x => x.text());
    console.log("xnxx k:", phVidInfo.slice(0, 500));
}
testADL().catch(console.error);
