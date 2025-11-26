const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'agents/browser-agent-node/.env') });
const https = require('https');

const apiKey = process.env.SERPER_API_KEY;
console.log(`Checking SERPER_API_KEY...`);
if (!apiKey) {
    console.error('SERPER_API_KEY is missing or empty.');
    process.exit(1);
}
console.log(`SERPER_API_KEY is present (length: ${apiKey.length})`);

const postData = JSON.stringify({ q: "test", num: 1 });
const options = {
    hostname: 'google.serper.dev',
    path: '/search',
    method: 'POST',
    headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': postData.length
    }
};

const req = https.request(options, (res) => {
    console.log(`Response Status: ${res.statusCode}`);
    let data = '';
    res.on('data', (d) => { data += d; });
    res.on('end', () => {
        console.log('Response Body:', data);
    });
});

req.on('error', (e) => {
    console.error(`Request Error: ${e.message}`);
});

req.write(postData);
req.end();
