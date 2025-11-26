// automation.js
console.log("[Harbinger] Automation script loaded.");

let automationInterval;

function runAutomation() {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
        console.warn("[Harbinger] Extension context invalidated. Stopping automation loop.");
        if (automationInterval) clearInterval(automationInterval);
        return;
    }

    try {
        chrome.storage.local.get(['automationState', 'email', 'password'], function (data) {
            if (chrome.runtime.lastError) {
                console.warn("[Harbinger] Storage access error:", chrome.runtime.lastError.message);
                return;
            }

            if (data.automationState !== 'active') return;
            if (!data.email || !data.password) {
                console.log("[Harbinger] Missing credentials. Stopping.");
                return;
            }

            console.log("[Harbinger] Automation is ACTIVE. Analyzing page...");

            // Heuristic: Check for Email Field
            const emailField = document.querySelector('input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[id*="user"]');

            // Heuristic: Check for Password Field
            const passwordField = document.querySelector('input[type="password"], input[name="password"], input[id*="pass"]');
            // Logic Flow
            if (emailField && !passwordField) {
                // Step 1: Enter Email
                if (emailField.value !== data.email) {
                    console.log("[Harbinger] Filling email...");
                    emailField.value = data.email;
                    emailField.dispatchEvent(new Event('input', { bubbles: true }));
                    emailField.dispatchEvent(new Event('change', { bubbles: true }));

                    setTimeout(() => {
                        if (submitBtn) {
                            console.log("[Harbinger] Clicking Next...");
                            submitBtn.click();
                        }
                    }, 500);
                }
            } else if (passwordField) {
                // Step 2: Enter Password
                // Check if email is present (sometimes on same page)
                if (emailField && emailField.value !== data.email) {
                    emailField.value = data.email;
                    emailField.dispatchEvent(new Event('input', { bubbles: true }));
                }

                if (passwordField.value !== data.password) {
                    console.log("[Harbinger] Filling password...");
                    passwordField.value = data.password;
                    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
                    passwordField.dispatchEvent(new Event('change', { bubbles: true }));

                    setTimeout(() => {
                        if (submitBtn) {
                            console.log("[Harbinger] Clicking Sign In...");
                            submitBtn.click();

                            // Optional: Reset state after success or timeout
                            // setTimeout(() => { chrome.storage.local.set({ automationState: 'idle' }); }, 5000);
                        }
                    }, 500);
                }
            } else {
                // No obvious fields. Check for 2FA or success.
                const bodyText = document.body.innerText.toLowerCase();
                if (bodyText.includes('2-step') || bodyText.includes('verification code') || bodyText.includes('authenticator')) {
                    console.log("[Harbinger] 2FA detected. Stopping automation.");
                    chrome.storage.local.set({ automationState: 'idle' });
                    alert("Harbinger: 2FA detected. Please complete login manually.");
                }
            }
        });
    } catch (e) {
        console.warn("[Harbinger] Automation error (likely context invalidated):", e);
        if (automationInterval) clearInterval(automationInterval);
    }
}

// Run automation loop periodically if active
automationInterval = setInterval(runAutomation, 1000);
