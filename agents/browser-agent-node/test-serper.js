const https = require('https');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const query = 'latest AI research papers';
const apiKey = process.env.SERPER_API_KEY;

console.log('Testing Serper API...');
console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET');

const postData = JSON.stringify({ q: query, num: 5 });

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
    let data = '';
    console.log('Status Code:', res.statusCode);
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('Response:', data);
        try {
            const json = JSON.parse(data);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.error('Failed to parse JSON:', e);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

req.write(postData);
req.end();
