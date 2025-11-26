// content.js
console.log("[Harbinger] Content script initialized.");

// Main entry point
function init() {
    if (!chrome.runtime?.id) {
        console.warn("[Harbinger] Extension context invalidated. Skipping init.");
        return;
    }

    try {
        chrome.storage.local.get(['enabled'], function (result) {
            if (chrome.runtime.lastError) return; // Context might have died during async

            if (result.enabled !== false) {
                // Wait a bit for page load then init
                setTimeout(() => {
                    if (window.initHarbinger) {
                        window.initHarbinger();
                    } else {
                        console.error("[Harbinger] initHarbinger not found! Overlay script might have failed.");
                    }
                }, 1500);
            }
        });
    } catch (e) {
        console.warn("[Harbinger] Init error:", e);
    }
}

// Listen for manual scan
try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "scan_now") {
            console.log("[Harbinger] Manual scan requested.");
            if (window.initHarbinger) {
                window.initHarbinger(); // Re-scan
                if (window.forceOverlay) window.forceOverlay();
            }
            sendResponse({ status: "ok" });
        }
    });
} catch (e) {
    console.warn("[Harbinger] Message listener error:", e);
}

// Run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Re-scan on URL change (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log("[Harbinger] URL changed, re-initializing...");
        init();
    }
}).observe(document, { subtree: true, childList: true });
