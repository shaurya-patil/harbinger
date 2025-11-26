// popup.js
document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.getElementById('toggle');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const saveBtn = document.getElementById('save');
    const scanBtn = document.getElementById('scan');
    const status = document.getElementById('status');

    // Load saved state and credentials
    chrome.storage.local.get(['enabled', 'email', 'password'], function (result) {
        if (result.enabled === undefined) {
            toggle.checked = true; // Default on
        } else {
            toggle.checked = result.enabled;
        }

        if (result.email) emailInput.value = result.email;
        if (result.password) passwordInput.value = result.password;

        updateStatus();
    });

    toggle.addEventListener('change', function () {
        chrome.storage.local.set({ enabled: toggle.checked }, function () {
            updateStatus();
        });
    });

    saveBtn.addEventListener('click', function () {
        const email = emailInput.value;
        const password = passwordInput.value;

        chrome.storage.local.set({
            email: email,
            password: password
        }, function () {
            status.textContent = "Credentials Saved!";
            status.style.color = "green";
            setTimeout(() => updateStatus(), 2000);
        });
    });

    if (scanBtn) {
        scanBtn.addEventListener('click', function () {
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (!tabs[0]) return;

                chrome.tabs.sendMessage(tabs[0].id, { action: "scan_now" }, function (response) {
                    if (chrome.runtime.lastError) {
                        console.log("Connection error:", chrome.runtime.lastError.message);
                        status.textContent = "Please RELOAD the web page!";
                        status.style.color = "red";
                    } else {
                        status.textContent = "Scan command sent!";
                        status.style.color = "blue";
                    }
                });
            });
        });
    }

    function updateStatus() {
        if (toggle.checked) {
            status.textContent = "System Active";
            status.style.color = "green";
        } else {
            status.textContent = "System Disabled";
            status.style.color = "red";
        }
    }
});
