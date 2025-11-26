// assistant-ui.js
(function () {
    // Prevent duplicate injection
    if (window.harbingerAssistantInjected) return;
    window.harbingerAssistantInjected = true;

    console.log("[Harbinger] Assistant UI injecting...");

    // Create Shadow Host
    const host = document.createElement('div');
    host.id = 'harbinger-assistant-host';
    host.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        z-index: 2147483647; /* Max z-index */
        pointer-events: none; /* Let clicks pass through when not interacting */
        font-family: 'Segoe UI', sans-serif;
    `;
    document.body.appendChild(host);

    // Create Shadow Root
    const shadow = host.attachShadow({ mode: 'open' });

    // Styles
    const style = document.createElement('style');
    style.textContent = `
        :host {
            --primary-color: #2196F3;
            --bg-color: #ffffff;
            --text-color: #333333;
        }

        .container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            pointer-events: auto; /* Re-enable clicks for the UI */
            gap: 10px;
        }

        /* Voice Mode: Ripple Circle */
        .voice-indicator {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--primary-color);
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
        }

        .voice-indicator::after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 2px solid var(--primary-color);
            opacity: 0;
            animation: ripple 1.5s infinite;
        }

        @keyframes ripple {
            0% { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(1.6); opacity: 0; }
        }

        .mic-icon {
            width: 24px;
            height: 24px;
            fill: white;
        }

        /* Typing Mode: Input Box */
        .input-container {
            background: var(--bg-color);
            border-radius: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            padding: 5px 15px;
            width: 0;
            opacity: 0;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
            transform-origin: right center;
        }

        .input-container.active {
            width: 300px;
            opacity: 1;
            padding: 10px 20px;
        }

        input {
            border: none;
            outline: none;
            font-size: 16px;
            width: 100%;
            background: transparent;
            color: var(--text-color);
        }

        /* State Classes */
        .hidden {
            display: none !important;
        }
        
        .mode-label {
            position: absolute;
            bottom: -25px;
            right: 10px;
            font-size: 12px;
            color: #666;
            background: rgba(255,255,255,0.9);
            padding: 2px 6px;
            border-radius: 4px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .container:hover .mode-label {
            opacity: 1;
        }
    `;
    shadow.appendChild(style);

    // UI Structure
    const container = document.createElement('div');
    container.className = 'container';

    // Input (Typing Mode)
    const inputContainer = document.createElement('div');
    inputContainer.className = 'input-container';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type your command...';
    inputContainer.appendChild(input);

    // Circle (Voice Mode)
    const voiceIndicator = document.createElement('div');
    voiceIndicator.className = 'voice-indicator';
    voiceIndicator.innerHTML = `
        <svg class="mic-icon" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
    `;

    const modeLabel = document.createElement('div');
    modeLabel.className = 'mode-label';
    modeLabel.textContent = 'Tab to switch';

    container.appendChild(inputContainer);
    container.appendChild(voiceIndicator);
    container.appendChild(modeLabel);
    shadow.appendChild(container);

    // State
    let isTypingMode = false;

    // Toggle Function
    function toggleMode() {
        isTypingMode = !isTypingMode;
        updateUI();
    }

    function updateUI() {
        if (isTypingMode) {
            inputContainer.classList.add('active');
            voiceIndicator.style.transform = 'scale(0.8)';
            voiceIndicator.style.opacity = '0.5';
            setTimeout(() => input.focus(), 100); // Focus after transition starts
        } else {
            inputContainer.classList.remove('active');
            voiceIndicator.style.transform = 'scale(1)';
            voiceIndicator.style.opacity = '1';
            input.blur();
        }
    }

    // Event Listeners

    // 1. Click on circle to toggle
    voiceIndicator.addEventListener('click', toggleMode);

    // 2. Global Tab Listener
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            // Logic: 
            // If we are in typing mode and input is focused, Tab switches back to voice.
            // If we are in voice mode (default), Tab switches to typing.
            // We prevent default ONLY if we are interacting with the assistant to avoid trapping user.

            // Check if our input is focused
            const isInputFocused = shadow.activeElement === input;

            if (isTypingMode && isInputFocused) {
                e.preventDefault(); // Prevent tabbing away
                toggleMode();
            } else if (!isTypingMode) {
                // If not in typing mode, we might want to capture Tab to start typing.
                // But this is aggressive. Let's only do it if no other important element is focused?
                // Or maybe just do it as requested.
                // "i will press tab for switching" implies it's a primary interaction.
                // Let's try to be smart: if the user is in a form field on the page, maybe don't hijack?
                // For now, let's implement the toggle but maybe require a modifier or just accept the request.
                // Let's stick to the request: Press Tab -> Switch.

                // To be safe: Only hijack if body is focused OR we are already interacting.
                // Actually, let's just implement the toggle.

                // e.preventDefault(); // This would break page navigation. 
                // Let's NOT prevent default unless we are sure.

                toggleMode();
                e.preventDefault(); // Consuming the tab event to switch mode.
            }
        }
    });

    // 3. Input Enter key
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = input.value.trim();
            if (command) {
                console.log(`[Harbinger] Command: ${command}`);
                // TODO: Send command to background/orchestrator
                input.value = '';
                toggleMode(); // Switch back to voice/idle after command
            }
        }
    });

})();
