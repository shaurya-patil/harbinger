// overlay.js
console.log("[Harbinger] Overlay script loaded.");

const PROVIDERS = [
    { name: 'Google', keywords: ['google'] },
    { name: 'Facebook', keywords: ['facebook'] },
    { name: 'Apple', keywords: ['apple'] },
    { name: 'GitHub', keywords: ['github'] },
    { name: 'Microsoft', keywords: ['microsoft'] },
    { name: 'Twitter', keywords: ['twitter', 'x.com'] },
    { name: 'LinkedIn', keywords: ['linkedin'] },
    { name: 'Email', keywords: ['email', 'continue with email'] }
];

let overlayElement = null;
let detectedProviders = new Set(); // Stores names of providers found across all frames

// 1. Scan Local DOM for Buttons
function scanLocalButtons() {
    const localMatches = [];
    const elements = document.querySelectorAll('a, button, input[type="submit"], div, span');

    elements.forEach(el => {
        if (el.offsetParent === null || el.offsetWidth < 10 || el.offsetHeight < 10) return;

        const text = el.textContent.toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const className = (typeof el.className === 'string' ? el.className : '').toLowerCase();
        const imgAlt = el.querySelector('img') ? el.querySelector('img').alt.toLowerCase() : '';
        const title = (el.title || '').toLowerCase();

        const isLoginContext =
            text.includes('sign in') || text.includes('log in') || text.includes('continue') ||
            aria.includes('sign in') || aria.includes('log in') ||
            id.includes('login') || id.includes('signin') ||
            className.includes('login') || className.includes('signin') || className.includes('sso');

        if (isLoginContext || text.length < 100 || imgAlt || title) {
            PROVIDERS.forEach(provider => {
                const match = provider.keywords.some(k =>
                    text.includes(k) || aria.includes(k) || imgAlt.includes(k) || title.includes(k) || className.includes(k)
                );

                if (match) {
                    if (!localMatches.some(p => p.name === provider.name)) {
                        localMatches.push({
                            name: provider.name,
                            element: el
                        });
                    }
                }
            });
        }
    });
    return localMatches;
}

// 2. Main Logic
function initHarbinger() {
    const localButtons = scanLocalButtons();
    const isTop = window === window.top;

    if (isTop) {
        // --- TOP FRAME LOGIC ---

        // Add local buttons to detected set
        localButtons.forEach(b => detectedProviders.add(b.name));

        // Listen for reports from iframes
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'HARBINGER_FOUND') {
                const newProviders = event.data.providers;
                let changed = false;
                newProviders.forEach(p => {
                    if (!detectedProviders.has(p)) {
                        detectedProviders.add(p);
                        changed = true;
                    }
                });
                if (changed) updateOverlay();
            }
        });

        // Listen for click requests (from overlay) to route to local buttons
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'HARBINGER_CLICK') {
                const target = event.data.provider;
                const match = localButtons.find(b => b.name === target);
                if (match) {
                    console.log(`[Harbinger] Top frame clicking ${target}`);
                    match.element.click();
                }
            }
        });

        // Show overlay if we have anything (or if manually triggered)
        updateOverlay();

    } else {
        // --- IFRAME LOGIC ---

        if (localButtons.length > 0) {
            // Report findings to top
            console.log(`[Harbinger] Iframe found: ${localButtons.map(b => b.name).join(', ')}`);
            window.top.postMessage({
                type: 'HARBINGER_FOUND',
                providers: localButtons.map(b => b.name)
            }, '*');

            // Listen for click commands from top
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'HARBINGER_CLICK') {
                    const target = event.data.provider;
                    const match = localButtons.find(b => b.name === target);
                    if (match) {
                        console.log(`[Harbinger] Iframe clicking ${target}`);
                        match.element.click();
                    }
                }
            });
        }
    }
}

// 3. Overlay UI (Only runs in Top Frame)
function updateOverlay() {
    if (window !== window.top) return; // Safety check

    if (overlayElement) overlayElement.remove();

    const providerList = Array.from(detectedProviders);
    if (providerList.length === 0) return; // Don't show empty overlay automatically? 
    // Actually user wants to see it if they scanned manually. 
    // But initHarbinger runs automatically. We should probably only show if > 0.

    overlayElement = document.createElement('div');
    overlayElement.id = 'harbinger-overlay';

    overlayElement.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        background-color: white !important;
        padding: 15px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
        font-family: 'Segoe UI', sans-serif !important;
        min-width: 200px !important;
        border: 1px solid #ccc !important;
        display: block !important;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Harbinger Login';
    title.style.cssText = "margin: 0 0 10px 0; fontSize: 14px; color: #333;";
    overlayElement.appendChild(title);

    providerList.forEach(name => {
        const btn = document.createElement('button');
        btn.textContent = `Continue with ${name}`;
        btn.style.cssText = `
            display: block;
            width: 100%;
            padding: 8px;
            margin-bottom: 5px;
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            text-align: left;
            font-size: 13px;
            color: #333;
        `;

        btn.onmouseover = () => btn.style.backgroundColor = '#e0e0e0';
        btn.onmouseout = () => btn.style.backgroundColor = '#f5f5f5';

        btn.onclick = () => {
            console.log(`[Harbinger] Selected ${name}. Broadcasting click...`);

            // Activate automation
            chrome.storage.local.set({
                automationState: 'active',
                targetProvider: name
            });

            // Broadcast click to ALL frames (including self)
            // 1. Send to self
            window.postMessage({ type: 'HARBINGER_CLICK', provider: name }, '*');

            // 2. Send to all iframes
            const frames = document.querySelectorAll('iframe');
            frames.forEach(frame => {
                try {
                    frame.contentWindow.postMessage({ type: 'HARBINGER_CLICK', provider: name }, '*');
                } catch (e) { /* Ignore cross-origin blocks if any */ }
            });

            overlayElement.remove();
        };

        overlayElement.appendChild(btn);
    });

    // Close button
    const closeBtn = document.createElement('div');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 10px;
        cursor: pointer;
        font-size: 18px;
        color: #999;
    `;
    closeBtn.onclick = () => {
        overlayElement.remove();
        overlayElement = null;
    };
    overlayElement.appendChild(closeBtn);

    document.body.appendChild(overlayElement);
}

// Export for content.js
window.initHarbinger = initHarbinger;
window.forceOverlay = () => {
    // For manual scan, show even if empty
    if (window === window.top) {
        if (detectedProviders.size === 0) {
            alert("Harbinger: No login buttons found yet. Try scrolling or waiting.");
        } else {
            updateOverlay();
        }
    }
};
