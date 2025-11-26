const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { chromium } = require('playwright');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const https = require('https');
const TurndownService = require('turndown');

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Primary: Serper API (Google results via API)
async function serperSearch(query) {
    console.log(`[Browser Agent] Searching via Serper API for: ${query}`);

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        throw new Error('SERPER_API_KEY not configured');
    }

    return new Promise((resolve, reject) => {
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
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`[Browser Agent] Serper API response status: ${res.statusCode}`);
                console.log(`[Browser Agent] Serper API response: ${data.substring(0, 500)}...`);
                try {
                    const json = JSON.parse(data);
                    if (json.organic && json.organic.length > 0) {
                        const results = json.organic.slice(0, 5).map(r => ({
                            title: r.title,
                            url: r.link,
                            content: r.snippet || ''
                        }));
                        console.log(`[Browser Agent] ✓ Serper found ${results.length} results`);
                        resolve(results);
                    } else {
                        console.log(`[Browser Agent] Serper returned no organic results. Full response:`, JSON.stringify(json));
                        reject(new Error('No results from Serper'));
                    }
                } catch (error) {
                    console.error(`[Browser Agent] Failed to parse Serper response:`, error);
                    reject(error);
                }
            });
        });
        req.on('error', (error) => {
            console.error(`[Browser Agent] Serper request error:`, error);
            reject(error);
        });
        req.write(postData);
        req.end();
    });
}

// Fallback: Bing Search (Browser Scraping)
async function bingSearch(query) {
    console.log(`[Browser Agent] Fallback: Searching via Bing for: ${query}`);
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        await page.waitForTimeout(1000);

        const results = await page.evaluate(() => {
            const data = [];
            const seen = new Set();
            const resultItems = document.querySelectorAll('li.b_algo, .b_algo');

            resultItems.forEach(item => {
                const link = item.querySelector('h2 a, a[href^="http"]');
                const title = item.querySelector('h2');
                const snippet = item.querySelector('.b_caption p, .b_snippet') || { textContent: '' };

                if (link && title && !seen.has(link.href)) {
                    seen.add(link.href);
                    data.push({
                        title: title.textContent.trim(),
                        url: link.href,
                        content: snippet.textContent.trim()
                    });
                }
            });
            return data.slice(0, 5);
        });

        if (results.length > 0) {
            console.log(`[Browser Agent] ✓ Bing found ${results.length} results`);
            return results;
        }
    } catch (error) {
        console.error(`[Browser Agent] Bing search failed: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
    return null;
}

// Main search with fallback
async function performSearch(query) {
    // Try Serper first
    try {
        const results = await serperSearch(query);
        if (results && results.length > 0) return results;
    } catch (error) {
        console.log(`[Browser Agent] Serper failed: ${error.message}`);
    }

    // Try Bing fallback
    const bingResults = await bingSearch(query);
    if (bingResults && bingResults.length > 0) return bingResults;

    // Return empty if all fail
    console.log(`[Browser Agent] All search methods failed`);
    return [];
}

async function scrapePage(url) {
    console.log(`[Browser Agent] Scraping URL: ${url}`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const content = await page.content();

        const doc = new JSDOM(content, { url });
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        return {
            title: article ? article.title : await page.title(),
            content: article ? article.textContent : await page.evaluate(() => document.body.innerText),
            excerpt: article ? article.excerpt : ''
        };
    } finally {
        await browser.close();
    }
}

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};
    console.log(`[Browser Agent] Task ${task.id}: ${task.type}`);

    try {
        let result;
        if (task.type === 'browser.search') {
            const searchResults = await performSearch(params.query);
            // Format search results as a readable string
            if (searchResults && searchResults.length > 0) {
                result = searchResults.map(r => `### [${r.title}](${r.url})\n${r.content}\n`).join('\n');
            } else {
                result = "No results found.";
            }
        } else if (task.type === 'browser.scrape') {
            const scrapeResult = await scrapePage(params.url);
            // Format scrape result as Markdown
            const turndownService = new TurndownService();
            const markdown = turndownService.turndown(scrapeResult.content);

            result = `# ${scrapeResult.title}\n\n${scrapeResult.excerpt ? `> ${scrapeResult.excerpt}\n\n` : ''}${markdown}`;
        } else {
            throw new Error(`Unknown task type: ${task.type}`);
        }

        callback(null, {
            id: task.id,
            status: "success",
            result_uri: `data://${task.type}/result`,
            result_data: result // Now a string, not JSON
        });

    } catch (error) {
        console.error(`[Browser Agent] Task failed:`, error.message);
        callback(null, {
            id: task.id,
            status: "fail",
            error_message: error.message
        });
    }
}

function healthCheck(call, callback) {
    callback(null, {
        status: "ok",
        capabilities: ["browser.search", "browser.scrape"]
    });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50053';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Browser Agent] Server running at ${address}`);
        console.log(`[Browser Agent] Using Serper API for search`);
        server.start();
    });
}

main();