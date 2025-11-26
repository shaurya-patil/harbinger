const { chromium } = require('playwright');

async function testGoogleSearch() {
    console.log('Testing Google Search...');
    const browser = await chromium.launch({ headless: false }); // Non-headless for debugging
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    try {
        console.log('Navigating to Google...');
        await page.goto('https://www.google.com/search?q=latest+AI+news', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        console.log('Waiting for results...');
        await page.waitForTimeout(3000); // Wait 3 seconds for page to settle

        // Try to find results
        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('div.g, div[data-sokoban-container]');
            const data = [];
            items.forEach(item => {
                const titleEl = item.querySelector('h3');
                const linkEl = item.querySelector('a');
                if (titleEl && linkEl && linkEl.href.startsWith('http')) {
                    data.push({
                        title: titleEl.innerText,
                        url: linkEl.href
                    });
                }
            });
            return data.slice(0, 5);
        });

        console.log('Results:', JSON.stringify(results, null, 2));
        await browser.close();
        return results;
    } catch (error) {
        console.error('Error:', error);
        await browser.close();
        throw error;
    }
}

testGoogleSearch();
