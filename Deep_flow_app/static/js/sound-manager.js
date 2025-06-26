document.addEventListener('DOMContentLoaded', () => {
    const sounds = {
        whitenoise: new Audio('/static/audio/whitenoise.mp3'),
        brownnoise: new Audio('/static/audio/brownnoise.mp3'),
        greynoise: new Audio('/static/audio/greynoise.mp3'),
        rain: new Audio('/static/audio/rain.mp3'),
    };

    let currentSound = null;
    let audioUnlocked = false;

    // Preload audio and set to loop
    Object.values(sounds).forEach(sound => {
        sound.loop = true;
        sound.preload = 'auto';
    });

    // Function to unlock audio on user interaction
    const unlockAudio = () => {
        if (audioUnlocked) return;
        const silentSound = new Audio('data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaXRyYXRlIHN1cHBseSBieSBiaXRyYXRlLmNvbQBLTVB3AAAAAABRAAAAAAYAAAD/2R4YAEwAAAAEAAAAAAAAAAAAAAB/2R4YAMgAAAAEAAAAAAAAAAAAAAB/2R4YAEwAAAAEAAAAAAAAAAAAAAB/2R4YAMgAAAAEAAAAAAAAAAAAAAB');
        silentSound.play().then(() => {
            audioUnlocked = true;
            console.log("Audio context unlocked.");
        }).catch(e => console.error("Audio unlock failed:", e));
    };

    const playSound = (soundName) => {
        // Stop any currently playing sound first
        if (currentSound) {
            currentSound.pause();
            currentSound.currentTime = 0;
        }

        // Play the new sound
        currentSound = sounds[soundName];
        if (currentSound) {
            currentSound.play().catch(e => console.error(`Error playing ${soundName}:`, e));
        }
        
        // Update button states
        updateActiveButton(soundName);
    };

    const stopSound = () => {
        if (currentSound) {
            currentSound.pause();
            currentSound.currentTime = 0;
            currentSound = null;
        }
        updateActiveButton(null);
    };

    const updateActiveButton = (activeSoundName) => {
        document.querySelectorAll('.sound-option').forEach(button => {
            if (button.dataset.sound === activeSoundName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    };

    // Event Listeners for sound options
    document.querySelectorAll('.sound-option').forEach(button => {
        button.addEventListener('click', () => {
            if (!audioUnlocked) unlockAudio();
            const soundName = button.dataset.sound;
            playSound(soundName);
        });
    });

    // Event Listener for the stop button
    const stopButton = document.getElementById('stop-sound');
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            stopSound();
        });
    }
});
