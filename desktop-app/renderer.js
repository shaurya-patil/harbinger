// renderer.js
const { ipcRenderer } = require('electron');

const inputContainer = document.getElementById('inputContainer');
const voiceIndicator = document.getElementById('voiceIndicator');
const input = document.getElementById('commandInput');

let isTypingMode = false;

// --- Audio Detection Logic ---
async function initAudioDetection() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        const NOISE_THRESHOLD = 0.15; // Adjust sensitivity
        let cooldown = false;

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);

            if (rms > NOISE_THRESHOLD && !cooldown) {
                console.log(`[Harbinger] Noise detected! RMS: ${rms.toFixed(3)}`);
                ipcRenderer.send('wake-up');

                // Cooldown to prevent spamming
                cooldown = true;
                setTimeout(() => cooldown = false, 2000);
            }
        };
    } catch (err) {
        console.error('[Harbinger] Microphone access failed:', err);
    }
}

// Initialize detection immediately
initAudioDetection();

// --- UI Logic ---

function toggleMode() {
    isTypingMode = !isTypingMode;
    updateUI();
}

function updateUI() {
    if (isTypingMode) {
        inputContainer.classList.add('active');
        voiceIndicator.style.transform = 'scale(0.8)';
        voiceIndicator.style.opacity = '0.5';
        setTimeout(() => input.focus(), 100);
    } else {
        inputContainer.classList.remove('active');
        voiceIndicator.style.transform = 'scale(1)';
        voiceIndicator.style.opacity = '1';
        input.blur();
    }
}

// Click to toggle
voiceIndicator.addEventListener('click', toggleMode);

// Tab key to toggle
document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        toggleMode();
    }
});

// IPC: Focus input when shown
ipcRenderer.on('focus-input', () => {
    updateUI();
});

// IPC: Orchestrator Feedback
ipcRenderer.on('orchestrator-start', () => {
    input.disabled = true;
    input.placeholder = "Running... please wait";
    inputContainer.classList.add('active'); // Keep visible
});

ipcRenderer.on('orchestrator-result', (event, output) => {
    input.disabled = false;
    input.placeholder = "Type your command...";
    input.focus();
    alert(`Orchestrator Output:\n${output}`);
});

ipcRenderer.on('orchestrator-error', (event, error) => {
    input.disabled = false;
    input.placeholder = "Type your command...";
    input.focus();
    alert(`Orchestrator Error:\n${error}`);
});

// Enter key to submit
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = input.value.trim();
        if (command) {
            console.log(`[Harbinger] Sending to Orchestrator: ${command}`);
            ipcRenderer.send('run-orchestrator', command);
            input.value = '';
            toggleMode();
        }
    }
});
