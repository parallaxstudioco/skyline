async function fetchHTML(username) {
  const https = await import('node:https');

  return new Promise((resolve, reject) => {
    https.get(`https://www.instagram.com/${username}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

(async () => {
    try {
        const { status, data } = await fetchHTML('abhibhoo.music');
        console.log('Status:', status);
        if (status === 200) {
            const match = /<meta property="og:description" content="([^"]+)"/.exec(data);
            if (match) {
                console.log('Found meta:', match[1]);
            } else {
                console.log('Meta not found in first 1000 chars:', data.substring(0, 1000));
            }
        }
    } catch (e) {
        console.error(e);
    }
})();
