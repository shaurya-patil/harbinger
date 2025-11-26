const https = require('https');
const { chromium } = require('playwright');
require('dotenv').config();

console.log('='.repeat(60));
console.log('TESTING ALL SEARCH METHODS');
console.log('='.repeat(60));

const query = 'nodejs tutorial';

// Test 1: Serper API
async function testSerper() {
    console.log('\n📍 TEST 1: Serper API (Google Results)');
    console.log('Get free key at: https://serper.dev');
    console.log('-'.repeat(60));
    
    const apiKey = process.env.SERPER_API_KEY;
    
    if (!apiKey) {
        console.log('❌ SERPER_API_KEY not found in .env');
        console.log('   Add this to your .env file: SERPER_API_KEY=your_key');
        return null;
    }
    
    console.log('✓ API key found, testing...');
    
    return new Promise((resolve) => {
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
        
        const timeout = setTimeout(() => {
            console.log('⏱️  Timeout after 10s');
            resolve(null);
        }, 10000);
        
        const req = https.request(options, (res) => {
            clearTimeout(timeout);
            let data = '';
            
            res.on('data', (chunk) => { data += chunk; });
            
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.organic && json.organic.length > 0) {
                        console.log(`✅ SUCCESS! Found ${json.organic.length} results`);
                        json.organic.slice(0, 3).forEach((r, i) => {
                            console.log(`   ${i+1}. ${r.title}`);
                            console.log(`      ${r.link}`);
                        });
                        resolve(json.organic);
                    } else {
                        console.log('❌ No results returned');
                        console.log('   Response:', JSON.stringify(json).substring(0, 200));
                        resolve(null);
                    }
                } catch (error) {
                    console.log('❌ Parse error:', error.message);
                    console.log('   Response:', data.substring(0, 200));
                    resolve(null);
                }
            });
        });
        
        req.on('error', (error) => {
            clearTimeout(timeout);
            console.log('❌ Request failed:', error.message);
            resolve(null);
        });
        
        req.write(postData);
        req.end();
    });
}

// Test 2: DuckDuckGo Lite (browser)
async function testDDGLite() {
    console.log('\n📍 TEST 2: DuckDuckGo Lite (Browser Scraping)');
    console.log('-'.repeat(60));
    
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        console.log('✓ Browser launched');
        console.log(`   Navigating to: https://lite.duckduckgo.com/lite/?q=${query}`);
        
        await page.goto(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        console.log('✓ Page loaded');
        
        await page.waitForTimeout(2000);
        
        const results = await page.evaluate(() => {
            const data = [];
            const links = document.querySelectorAll('a[href^="http"]');
            const seen = new Set();
            
            links.forEach(link => {
                const href = link.href;
                const text = link.textContent.trim();
                
                if (!href.includes('duckduckgo.com') && 
                    !href.includes('duck.co') &&
                    text.length > 10 &&
                    !seen.has(href)) {
                    seen.add(href);
                    data.push({
                        title: text,
                        url: href
                    });
                }
            });
            
            return data.slice(0, 5);
        });
        
        if (results.length > 0) {
            console.log(`✅ SUCCESS! Found ${results.length} results`);
            results.slice(0, 3).forEach((r, i) => {
                console.log(`   ${i+1}. ${r.title.substring(0, 60)}...`);
                console.log(`      ${r.url}`);
            });
            return results;
        } else {
            console.log('❌ No results found');
            const pageText = await page.evaluate(() => document.body.innerText);
            console.log('   Page preview:', pageText.substring(0, 200));
            return null;
        }
        
    } catch (error) {
        console.log('❌ Failed:', error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// Test 3: Bing (browser)
async function testBing() {
    console.log('\n📍 TEST 3: Bing (Browser Scraping)');
    console.log('-'.repeat(60));
    
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        console.log('✓ Browser launched');
        
        await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        console.log('✓ Page loaded');
        
        await page.waitForTimeout(2000);
        
        const results = await page.evaluate(() => {
            const data = [];
            const seen = new Set();
            
            const resultItems = document.querySelectorAll('li.b_algo, .b_algo');
            
            resultItems.forEach(item => {
                const link = item.querySelector('h2 a, a[href^="http"]');
                const title = item.querySelector('h2');
                
                if (link && title && !seen.has(link.href)) {
                    seen.add(link.href);
                    data.push({
                        title: title.textContent.trim(),
                        url: link.href
                    });
                }
            });
            
            return data.slice(0, 5);
        });
        
        if (results.length > 0) {
            console.log(`✅ SUCCESS! Found ${results.length} results`);
            results.slice(0, 3).forEach((r, i) => {
                console.log(`   ${i+1}. ${r.title}`);
                console.log(`      ${r.url}`);
            });
            return results;
        } else {
            console.log('❌ No results found');
            
            // Check for CAPTCHA
            const pageText = await page.evaluate(() => document.body.innerText);
            if (pageText.includes('unusual traffic') || pageText.includes('CAPTCHA')) {
                console.log('   ⚠️  CAPTCHA detected!');
            }
            return null;
        }
        
    } catch (error) {
        console.log('❌ Failed:', error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// Test 4: Brave Search (browser)
async function testBrave() {
    console.log('\n📍 TEST 4: Brave Search (Browser Scraping)');
    console.log('-'.repeat(60));
    
    let browser;
    try {
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        console.log('✓ Browser launched');
        
        await page.goto(`https://search.brave.com/search?q=${encodeURIComponent(query)}`, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        console.log('✓ Page loaded');
        
        await page.waitForTimeout(2000);
        
        const results = await page.evaluate(() => {
            const data = [];
            const seen = new Set();
            
            // Try multiple selectors
            const snippets = document.querySelectorAll('[id^="snippet"], .snippet, [data-pos]');
            
            snippets.forEach(snippet => {
                const link = snippet.querySelector('a[href^="http"]');
                const title = snippet.querySelector('h2, h3, h4, .title');
                
                if (link && title && !link.href.includes('brave.com') && !seen.has(link.href)) {
                    seen.add(link.href);
                    data.push({
                        title: title.textContent.trim(),
                        url: link.href
                    });
                }
            });
            
            return data.slice(0, 5);
        });
        
        if (results.length > 0) {
            console.log(`✅ SUCCESS! Found ${results.length} results`);
            results.slice(0, 3).forEach((r, i) => {
                console.log(`   ${i+1}. ${r.title}`);
                console.log(`      ${r.url}`);
            });
            return results;
        } else {
            console.log('❌ No results found');
            return null;
        }
        
    } catch (error) {
        console.log('❌ Failed:', error.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// Run all tests
async function runAllTests() {
    console.log(`\nQuery: "${query}"\n`);
    
    const results = {
        serper: await testSerper(),
        ddgLite: await testDDGLite(),
        bing: await testBing(),
        brave: await testBrave()
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n1. Serper API:    ${results.serper ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`2. DDG Lite:      ${results.ddgLite ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`3. Bing:          ${results.bing ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`4. Brave:         ${results.brave ? '✅ WORKS' : '❌ FAILED'}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    if (results.serper) {
        console.log('\n✅ Use Serper API (best option - fast, reliable, no CAPTCHA)');
        console.log('   Already configured in your .env file');
    } else {
        console.log('\n⚠️  Serper API not configured');
        console.log('   Get free key at: https://serper.dev');
        console.log('   Add to .env: SERPER_API_KEY=your_key');
    }
    
    if (results.ddgLite) {
        console.log('\n✅ DDG Lite works as fallback');
    }
    
    if (results.bing) {
        console.log('\n✅ Bing works as fallback');
    }
    
    if (results.brave) {
        console.log('\n✅ Brave works as fallback');
    }
    
    if (!results.serper && !results.ddgLite && !results.bing && !results.brave) {
        console.log('\n❌ ALL METHODS FAILED');
        console.log('   Possible issues:');
        console.log('   - Network restrictions/firewall');
        console.log('   - All services blocking your IP');
        console.log('   - Playwright not installed correctly');
        console.log('\n   Try:');
        console.log('   1. Get Serper API key (recommended)');
        console.log('   2. Use a VPN or different network');
        console.log('   3. Check if Playwright is working: npx playwright install');
    }
    
    console.log('\n' + '='.repeat(60));
}

runAllTests().then(() => {
    console.log('\nTest complete!');
    process.exit(0);
}).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});