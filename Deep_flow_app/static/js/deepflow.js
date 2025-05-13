document.addEventListener('DOMContentLoaded', function() {
    // Global variables for the timer
    let activeTimers = {};
    let checkInIntervals = {};
    let pausedTimers = {}; // Store paused timer data
    let audioPlayer = null;
    let currentSound = null;

    // Initialize everything
    initializeTimers();
    initializeFlowShelf();
    initializeSoundPlayer();
    initializeEnergyLog();
    
    // Initialize timer toggle functionality if available
    if (window.timerToggle && typeof window.timerToggle.enhanceTimerControls === 'function') {
        // Using setTimeout to ensure all DOM elements are fully loaded
        setTimeout(() => {
            document.querySelectorAll('.timer-item').forEach(timer => {
                window.timerToggle.enhanceTimerControls(timer);
            });
        }, 100);
    }

    // Timer functionality
    function initializeTimers() {
        // Start timer buttons
        document.querySelectorAll('.start-timer-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                if (!e.target.closest('form')) {
                    e.preventDefault();
                    const timerId = this.getAttribute('data-timer-id');
                    const timerDuration = parseInt(this.getAttribute('data-duration'));
                    startTimer(timerId, timerDuration);
                }
            });
        });

        // Pause timer buttons
        document.querySelectorAll('.pause-timer-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                if (!e.target.closest('form')) {
                    e.preventDefault();
                    const timerId = this.getAttribute('data-timer-id');
                    pauseTimer(timerId);
                }
            });
        });

        // Resume timer buttons
        document.querySelectorAll('.resume-timer-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                if (!e.target.closest('form')) {
                    e.preventDefault();
                    const timerId = this.getAttribute('data-timer-id');
                    resumeTimer(timerId);
                }
            });
        });

        // Stop timer buttons
        document.querySelectorAll('.stop-timer-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                if (!e.target.closest('form')) {
                    e.preventDefault();
                    const timerId = this.getAttribute('data-timer-id');
                    stopTimer(timerId);
                }
            });
        });

        // Advanced timer settings toggle
        const advancedSettingsToggle = document.getElementById('advanced-settings-toggle');
        if (advancedSettingsToggle) {
            advancedSettingsToggle.addEventListener('click', function() {
                const advancedSettings = document.getElementById('advanced-timer-settings');
                if (advancedSettings) {
                    advancedSettings.classList.toggle('hidden');
                    this.textContent = advancedSettings.classList.contains('hidden') 
                        ? 'Show Advanced Settings' 
                        : 'Hide Advanced Settings';
                }
            });
        }
    }

    function startTimer(timerId, duration) {
        // Convert minutes to milliseconds
        const durationMs = duration * 60 * 1000;
        const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        
        if (timer) {
            // Update UI to show timer is running
            timer.classList.add('timer-running');
            timer.classList.remove('timer-stopped');
            timer.classList.remove('timer-paused');
            
            // Create or update countdown display
            let countdownEl = timer.querySelector('.timer-countdown');
            if (!countdownEl) {
                countdownEl = document.createElement('div');
                countdownEl.className = 'timer-countdown';
                timer.querySelector('.timer-details').appendChild(countdownEl);
            }
            
            // Set end time and start countdown
            const endTime = Date.now() + durationMs;
            activeTimers[timerId] = setInterval(() => {
                updateCountdown(countdownEl, endTime, timerId);
            }, 1000);
            
            // Update countdown immediately
            updateCountdown(countdownEl, endTime, timerId);
            
            // Set up mid-session check-in if enabled
            const checkInEnabled = document.getElementById('enable-checkin')?.checked;
            if (checkInEnabled) {
                // Check in halfway through the session
                const checkInTime = durationMs / 2;
                checkInIntervals[timerId] = setTimeout(() => {
                    showCheckInPrompt(timerId);
                }, checkInTime);
            }

            // Log starting energy if enabled
            const energyLoggingEnabled = document.getElementById('enable-energy-log')?.checked;
            if (energyLoggingEnabled) {
                showEnergyLogPrompt('start', timerId);
            }
            
            // Toggle timer control buttons
            const startBtn = timer.querySelector('.start-timer-btn');
            const pauseBtn = timer.querySelector('.pause-timer-btn');
            const stopBtn = timer.querySelector('.stop-timer-btn');
            
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-flex';
            
            // Add stop button if it doesn't exist
            if (!stopBtn) {
                const stopBtn = document.createElement('button');
                stopBtn.type = 'button';
                stopBtn.className = 'btn btn-stop stop-timer-btn';
                stopBtn.setAttribute('data-timer-id', timerId);
                stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
                stopBtn.addEventListener('click', function(e) {
                    if (!e.target.closest('form')) {
                        e.preventDefault();
                        const timerId = this.getAttribute('data-timer-id');
                        stopTimer(timerId);
                    }
                });
                timer.querySelector('.timer-controls').appendChild(stopBtn);
            } else {
                stopBtn.style.display = 'inline-flex';
            }
            
            // Play background sound if enabled
            const soundEnabled = document.getElementById('enable-sound')?.checked;
            if (soundEnabled && currentSound) {
                playSound(currentSound);
            }
            
            // Make AJAX request to update timer in database
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'start' }),
            });
        }
    }

    function pauseTimer(timerId) {
        console.log(`Pausing timer ${timerId}`); // Debug log
        
        // Clear the interval
        if (activeTimers[timerId]) {
            clearInterval(activeTimers[timerId]);
            delete activeTimers[timerId];
        }
        
        // Store the remaining time
        const countdownEl = document.querySelector(`.timer-item[data-timer-id="${timerId}"] .timer-countdown`);
        if (countdownEl) {
            const timeParts = countdownEl.textContent.split(' ');
            let totalSeconds = 0;
            timeParts.forEach(part => {
                if (part.endsWith('h')) {
                    totalSeconds += parseInt(part) * 3600;
                } else if (part.endsWith('m')) {
                    totalSeconds += parseInt(part) * 60;
                } else if (part.endsWith('s')) {
                    totalSeconds += parseInt(part);
                }
            });
            pausedTimers[timerId] = totalSeconds * 1000;
            
            // Update countdown display to show paused state
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            // Format the time with a pause indicator
            let timeString = '⏸️ ';
            if (hours > 0) {
                timeString += `${hours}h `;
            }
            timeString += `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
            
            countdownEl.textContent = timeString;
        }
        
        // Update UI to show timer is paused
        const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        if (timer) {
            timer.classList.add('timer-paused');
            timer.classList.remove('timer-running');
            
            // Toggle buttons
            const pauseBtn = timer.querySelector('.pause-timer-btn');
            const resumeBtn = timer.querySelector('.resume-timer-btn');
            
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'inline-flex';
        }
        
        // Pause the sound
        if (audioPlayer) {
            audioPlayer.pause();
        }
        
        // Make AJAX request to update timer in database
        fetch(`/update_timer/${timerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'pause' }),
        });
    }

    function resumeTimer(timerId) {
        const remainingTime = pausedTimers[timerId];
        if (!remainingTime) return;
        
        // Get the timer element
        const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        if (!timer) return;

        // Update UI to show timer is running again
        timer.classList.add('timer-running');
        timer.classList.remove('timer-paused');

        // Create or update countdown display
        let countdownEl = timer.querySelector('.timer-countdown');
        if (!countdownEl) {
            countdownEl = document.createElement('div');
            countdownEl.className = 'timer-countdown';
            timer.querySelector('.timer-details').appendChild(countdownEl);
        }
        
        // Set end time and start countdown
        const endTime = Date.now() + remainingTime;
        activeTimers[timerId] = setInterval(() => {
            updateCountdown(countdownEl, endTime, timerId);
        }, 1000);
        
        // Update countdown immediately
        updateCountdown(countdownEl, endTime, timerId);
        
        // Toggle buttons
        const pauseBtn = timer.querySelector('.pause-timer-btn');
        const resumeBtn = timer.querySelector('.resume-timer-btn');
        
        if (pauseBtn) pauseBtn.style.display = 'inline-flex';
        if (resumeBtn) resumeBtn.style.display = 'none';
        
        // Resume audio if it was playing
        if (audioPlayer && currentSound) {
            playSound(currentSound);
        }
        
        // Clear from paused timers
        delete pausedTimers[timerId];
    }

    function stopTimer(timerId) {
        // Clear the interval
        if (activeTimers[timerId]) {
            clearInterval(activeTimers[timerId]);
            delete activeTimers[timerId];
        }
        
        // Clear any paused timer data
        if (pausedTimers[timerId]) {
            delete pausedTimers[timerId];
        }
        
        // Clear the check-in interval if it exists
        if (checkInIntervals[timerId]) {
            clearTimeout(checkInIntervals[timerId]);
            delete checkInIntervals[timerId];
        }
        
        const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        if (timer) {
            // Update UI to show timer is stopped
            timer.classList.remove('timer-running');
            timer.classList.remove('timer-paused');  // Also remove paused class if present
            timer.classList.add('timer-stopped');
            
            // Remove countdown display
            const countdownEl = timer.querySelector('.timer-countdown');
            if (countdownEl) {
                countdownEl.textContent = 'Stopped';
            }
            
            // Swap buttons
            const startBtn = timer.querySelector('.start-timer-btn');
            const stopBtn = timer.querySelector('.stop-timer-btn');
            const pauseBtn = timer.querySelector('.pause-timer-btn');
            const resumeBtn = timer.querySelector('.resume-timer-btn');
            
            if (startBtn) startBtn.style.display = 'inline-flex';
            if (stopBtn) stopBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'none';
            
            // Stop the sound
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
            
            // Log ending energy if enabled (display this first)
            const energyLoggingEnabled = document.getElementById('enable-energy-log')?.checked;
            if (energyLoggingEnabled) {
                // Show energy log first
                showEnergyLogPrompt('end', timerId);
                
                // If re-entry is also enabled, we'll need to modify the energy log save behavior 
                // to show the re-entry mode after energy log is saved
                const reEntryEnabled = document.getElementById('enable-reentry')?.checked;
                if (reEntryEnabled) {
                    // Get the energy log save button and modify its behavior
                    const energyModal = document.getElementById('energy-log-modal');
                    if (energyModal) {
                        const saveBtn = energyModal.querySelector('#log-energy-btn');
                        if (saveBtn) {
                            // Replace existing event listener by cloning the button
                            const newSaveBtn = saveBtn.cloneNode(true);
                            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                            
                            // Add new event listener to show re-entry mode after saving energy
                            newSaveBtn.addEventListener('click', () => {
                                const energyLevel = document.getElementById('energy-slider').value;
                                saveEnergyLog(timerId, 'end', energyLevel);
                                energyModal.style.display = 'none';
                                
                                // Now show the re-entry mode
                                showReEntryMode(timerId);
                            });
                        }
                    }
                }
            } else {
                // If energy logging is not enabled, but re-entry is, show re-entry directly
                const reEntryEnabled = document.getElementById('enable-reentry')?.checked;
                if (reEntryEnabled) {
                    showReEntryMode(timerId);
                }
            }
            
            // Make AJAX request to update timer in database
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'stop' }),
            });
        }
    }

    function updateCountdown(countdownEl, endTime, timerId) {
        const now = Date.now();
        const timeLeft = endTime - now;
        
        if (timeLeft <= 0) {
            // Timer is complete
            clearInterval(activeTimers[timerId]);
            delete activeTimers[timerId];
            
            countdownEl.textContent = 'Complete!';
            
            // Play completion sound
            playTimerCompleteSound();
            
            // Handle timer completion
            const timer = countdownEl.closest('.timer-item');
            if (timer) {
                timer.classList.remove('timer-running');
                timer.classList.add('timer-stopped');
                
                // Log ending energy if enabled (display this first)
                const energyLoggingEnabled = document.getElementById('enable-energy-log')?.checked;
                if (energyLoggingEnabled) {
                    // Show energy log first
                    showEnergyLogPrompt('end', timerId);
                    
                    // If re-entry is also enabled, we'll need to modify the energy log save behavior 
                    // to show the re-entry mode after energy log is saved
                    const reEntryEnabled = document.getElementById('enable-reentry')?.checked;
                    if (reEntryEnabled) {
                        // Get the energy log save button and modify its behavior
                        const energyModal = document.getElementById('energy-log-modal');
                        if (energyModal) {
                            const saveBtn = energyModal.querySelector('#log-energy-btn');
                            if (saveBtn) {
                                // Replace existing event listener by cloning the button
                                const newSaveBtn = saveBtn.cloneNode(true);
                                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                                
                                // Add new event listener to show re-entry mode after saving energy
                                newSaveBtn.addEventListener('click', () => {
                                    const energyLevel = document.getElementById('energy-slider').value;
                                    saveEnergyLog(timerId, 'end', energyLevel);
                                    energyModal.style.display = 'none';
                                    
                                    // Now show the re-entry mode
                                    showReEntryMode(timerId);
                                });
                            }
                        }
                    }
                } else {
                    // If energy logging is not enabled, but re-entry is, show re-entry directly
                    const reEntryEnabled = document.getElementById('enable-reentry')?.checked;
                    if (reEntryEnabled) {
                        showReEntryMode(timerId);
                    }
                }
                
                // Make AJAX request to update timer in database
                fetch(`/update_timer/${timerId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'stop' }),
                });
            }
            
            return;
        }
        
        // Calculate hours, minutes, and seconds
        const totalSeconds = Math.floor(timeLeft / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Format the time
        let timeString = '';
        if (hours > 0) {
            timeString += `${hours}h `;
        }
        timeString += `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        
        // Update the countdown display
        countdownEl.textContent = timeString;
    }

    function showCheckInPrompt(timerId) {
        // Create check-in modal if it doesn't exist
        let checkInModal = document.getElementById('check-in-modal');
        if (!checkInModal) {
            checkInModal = document.createElement('div');
            checkInModal.id = 'check-in-modal';
            checkInModal.className = 'modal';
            checkInModal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>Still in flow?</h3>
                    <p>This is a gentle check-in for your extended focus session.</p>
                    <div class="modal-buttons">
                        <button id="continue-btn" class="btn btn-primary">Continue Working</button>
                        <button id="pause-btn" class="btn btn-secondary">Take a Break</button>
                    </div>
                </div>
            `;
            document.body.appendChild(checkInModal);
            
            // Add event listeners for the modal
            const closeBtn = checkInModal.querySelector('.close');
            const continueBtn = checkInModal.querySelector('#continue-btn');
            const pauseBtn = checkInModal.querySelector('#pause-btn');
            
            closeBtn.addEventListener('click', () => {
                checkInModal.style.display = 'none';
            });
            
            continueBtn.addEventListener('click', () => {
                checkInModal.style.display = 'none';
            });
            
            pauseBtn.addEventListener('click', () => {
                checkInModal.style.display = 'none';
                stopTimer(timerId);
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (event) => {
                if (event.target === checkInModal) {
                    checkInModal.style.display = 'none';
                }
            });
        }
        
        // Show the modal
        checkInModal.style.display = 'block';
        
        // Play a gentle sound
        playCheckInSound();
    }

    // Flow Shelf functionality
    function initializeFlowShelf() {
        const shelfForm = document.getElementById('flow-shelf-form');
        if (shelfForm) {
            shelfForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const input = this.querySelector('input[name="shelf-item"]');
                if (input && input.value.trim()) {
                    addToFlowShelf(input.value);
                    input.value = '';
                }
            });
        }
        
        // Initialize remove buttons for existing items
        document.querySelectorAll('.remove-shelf-item').forEach(button => {
            button.addEventListener('click', function() {
                removeFromFlowShelf(this.closest('.shelf-item'));
            });
        });
    }

    function addToFlowShelf(text) {
        const shelfList = document.getElementById('flow-shelf-list');
        if (shelfList) {
            const item = document.createElement('div');
            item.className = 'shelf-item';
            item.innerHTML = `
                <span>${text}</span>
                <button class="remove-shelf-item" title="Remove item"><i class="fas fa-times"></i></button>
            `;
            shelfList.appendChild(item);
            
            // Add event listener to the remove button
            item.querySelector('.remove-shelf-item').addEventListener('click', function() {
                removeFromFlowShelf(item);
            });
            
            // Save to local storage
            saveShelfToLocalStorage();
            
            // Optional: Make AJAX request to save to database
            fetch('/add_shelf_item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: text }),
            });
        }
    }

    function removeFromFlowShelf(item) {
        if (item) {
            const itemText = item.querySelector('span').textContent;
            item.remove();
            
            // Save updated list to local storage
            saveShelfToLocalStorage();
            
            // Optional: Make AJAX request to remove from database
            fetch('/remove_shelf_item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: itemText }),
            });
        }
    }

    function saveShelfToLocalStorage() {
        const items = [];
        document.querySelectorAll('#flow-shelf-list .shelf-item span').forEach(span => {
            items.push(span.textContent);
        });
        localStorage.setItem('flowShelfItems', JSON.stringify(items));
    }

    function loadShelfFromLocalStorage() {
        const items = JSON.parse(localStorage.getItem('flowShelfItems') || '[]');
        items.forEach(text => addToFlowShelf(text));
    }

    // Sound player functionality
    function initializeSoundPlayer() {
        audioPlayer = new Audio();
        
        // Add event listeners to sound options
        document.querySelectorAll('.sound-option').forEach(option => {
            option.addEventListener('click', function() {
                const sound = this.getAttribute('data-sound');
                selectSound(sound, this);
            });
        });
        
        // Play/pause button
        const playPauseBtn = document.getElementById('sound-play-pause');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', function() {
                if (currentSound) {
                    if (audioPlayer.paused) {
                        playSound(currentSound);
                        this.innerHTML = '<i class="fas fa-pause"></i> Pause';
                    } else {
                        audioPlayer.pause();
                        this.innerHTML = '<i class="fas fa-play"></i> Play';
                    }
                }
            });
        }
        
        // Volume control
        const volumeSlider = document.getElementById('sound-volume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', function() {
                audioPlayer.volume = this.value / 100;
            });
        }
    }

    function selectSound(sound, element) {
        currentSound = sound;
        
        // Update UI to show selected sound
        document.querySelectorAll('.sound-option').forEach(option => {
            option.classList.remove('active');
        });
        
        if (element) {
            element.classList.add('active');
        }
        
        // Enable the play button once a sound is selected
        const playPauseBtn = document.getElementById('sound-play-pause');
        if (playPauseBtn) {
            playPauseBtn.disabled = false;
        }
        
        // Play the sound if auto-play is enabled
        const autoPlay = document.getElementById('enable-sound')?.checked;
        if (autoPlay && isAnyTimerRunning()) {
            playSound(sound);
        }
    }

    function playSound(sound) {
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.src = `/static/audio/${sound}.mp3`;
            audioPlayer.loop = true;
            audioPlayer.volume = document.getElementById('sound-volume')?.value / 100 || 0.7;
            
            // Play and handle errors
            audioPlayer.play().catch(error => {
                console.error('Error playing audio:', error);
            });
            
            // Update play/pause button
            const playPauseBtn = document.getElementById('sound-play-pause');
            if (playPauseBtn) {
                playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            }
        }
    }

    function playCheckInSound() {
        const checkInAudio = new Audio('/static/audio/check-in.mp3');
        checkInAudio.volume = 0.5;
        checkInAudio.play().catch(error => {
            console.error('Error playing check-in audio:', error);
        });
    }

    function playTimerCompleteSound() {
        const completeAudio = new Audio('/static/audio/timer-complete.mp3');
        completeAudio.volume = 0.7;
        completeAudio.play().catch(error => {
            console.error('Error playing timer complete audio:', error);
        });
    }

    // Energy Log functionality
    function initializeEnergyLog() {
        // Initialize energy log history view if it exists
        const energyChartEl = document.getElementById('energy-chart');
        if (energyChartEl) {
            displayEnergyChart();
        }
        
        // Load energy logs from API if user is logged in
        if (document.querySelector('.sidebar-nav')) { // Check if we're on a logged in page
            fetchEnergyLogs();
        }
    }

    function showEnergyLogPrompt(stage, timerId) {
        // Create energy log modal if it doesn't exist
        let energyModal = document.getElementById('energy-log-modal');
        if (!energyModal) {
            energyModal = document.createElement('div');
            energyModal.id = 'energy-log-modal';
            energyModal.className = 'modal';
            energyModal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>How's your energy level?</h3>
                    <p class="modal-description">This helps you track when you're most productive.</p>
                    <div class="energy-log">
                        <div class="energy-emoji-selector">
                            <div class="emoji-option" data-value="1">😴</div>
                            <div class="emoji-option" data-value="3">😔</div>
                            <div class="emoji-option" data-value="5">😐</div>
                            <div class="emoji-option" data-value="7">😊</div>
                            <div class="emoji-option" data-value="10">⚡</div>
                        </div>
                        <input type="range" id="energy-slider" class="energy-slider" min="1" max="10" step="1" value="5">
                        <div class="slider-labels">
                            <span>🧠 Drained</span>
                            <span>Neutral</span>
                            <span>Energized ⚡</span>
                        </div>
                    </div>
                    <button id="log-energy-btn" class="btn btn-primary">Save</button>
                </div>
            `;
            document.body.appendChild(energyModal);
            
            // Add event listeners for the modal
            const closeBtn = energyModal.querySelector('.close');
            closeBtn.addEventListener('click', () => {
                energyModal.style.display = 'none';
            });
            
            // Close modal when clicking outside
            window.addEventListener('click', (event) => {
                if (event.target === energyModal) {
                    energyModal.style.display = 'none';
                }
            });
            
            // Add event listeners to emoji options
            energyModal.querySelectorAll('.emoji-option').forEach(option => {
                option.addEventListener('click', function() {
                    const value = this.getAttribute('data-value');
                    document.getElementById('energy-slider').value = value;
                    
                    // Update active class
                    energyModal.querySelectorAll('.emoji-option').forEach(opt => {
                        opt.classList.remove('active');
                    });
                    this.classList.add('active');
                });
            });
            
            // Add event listener for slider to update selected emoji
            const slider = energyModal.querySelector('#energy-slider');
            slider.addEventListener('input', function() {
                updateSelectedEmoji(this.value);
            });
            
            function updateSelectedEmoji(value) {
                const val = parseInt(value);
                const emojis = energyModal.querySelectorAll('.emoji-option');
                emojis.forEach(emoji => {
                    emoji.classList.remove('active');
                });
                
                // Find closest emoji
                if (val <= 2) emojis[0].classList.add('active');
                else if (val <= 4) emojis[1].classList.add('active');
                else if (val <= 6) emojis[2].classList.add('active');
                else if (val <= 8) emojis[3].classList.add('active');
                else emojis[4].classList.add('active');
            }
        }
        
        // Update modal content based on stage
        const modalTitle = energyModal.querySelector('h3');
        modalTitle.textContent = stage === 'start' 
            ? 'How\'s your energy level before starting?' 
            : 'How\'s your energy level after this session?';
        
        // Add or update save button event listener
        const saveBtn = energyModal.querySelector('#log-energy-btn');
        
        // Remove any existing event listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // Add new event listener
        newSaveBtn.addEventListener('click', () => {
            const energyLevel = document.getElementById('energy-slider').value;
            saveEnergyLog(timerId, stage, energyLevel);
            energyModal.style.display = 'none';
        });
        
        // Reset slider to middle position
        const slider = energyModal.querySelector('#energy-slider');
        slider.value = 5;
        
        // Update the selected emoji for the default value
        energyModal.querySelectorAll('.emoji-option').forEach(opt => {
            opt.classList.remove('active');
        });
        energyModal.querySelector('.emoji-option[data-value="5"]').classList.add('active');
        
        // Show the modal
        energyModal.style.display = 'block';
    }

    function saveEnergyLog(timerId, stage, energyLevel) {
        // Save to local storage for now
        const logs = JSON.parse(localStorage.getItem('energyLogs') || '[]');
        
        // Get the timer name
        const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        const timerName = timer ? timer.querySelector('h3').textContent : 'Unknown Timer';
        
        const logEntry = {
            timerId: timerId,
            timerName: timerName,
            stage: stage,
            energyLevel: parseInt(energyLevel),
            timestamp: new Date().toISOString()
        };
        
        // Add to the beginning for chronological display
        logs.unshift(logEntry);
        
        // Limit to last 30 entries to avoid localStorage overflow
        if (logs.length > 30) logs.length = 30;
        
        localStorage.setItem('energyLogs', JSON.stringify(logs));
        
        // Make AJAX request to save to database
        fetch('/log_energy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                timer_id: timerId,
                stage: stage,
                energy_level: energyLevel
            }),
        }).then(response => {
            if (response.ok) {
                // Update the chart if we're on the dashboard
                const energyChartEl = document.getElementById('energy-chart');
                if (energyChartEl) {
                    displayEnergyChart();
                }
            }
        });
    }

    function fetchEnergyLogs() {
        fetch('/get_energy_logs')
            .then(response => response.json())
            .then(data => {
                if (data.logs) {
                    // Store for chart display
                    localStorage.setItem('serverEnergyLogs', JSON.stringify(data.logs));
                    // Update chart if showing
                    const energyChartEl = document.getElementById('energy-chart');
                    if (energyChartEl) {
                        displayEnergyChart();
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching energy logs:', error);
            });
    }

    function displayEnergyChart() {
        const energyChartEl = document.getElementById('energy-chart');
        if (!energyChartEl) return;
        
        // Try to get logs from server first, fall back to local storage
        const serverLogs = JSON.parse(localStorage.getItem('serverEnergyLogs') || '[]');
        const localLogs = JSON.parse(localStorage.getItem('energyLogs') || '[]');
        
        // Use server logs if available, otherwise use local logs
        const logs = serverLogs.length > 0 ? serverLogs : localLogs;
        
        // Clear out energy insights content and trend values
        const insightsContent = document.getElementById('energy-insights-content');
        const bestTimeValue = document.getElementById('best-time-value');
        const bestTaskValue = document.getElementById('best-task-value');
        
        if (bestTimeValue) bestTimeValue.textContent = '--';
        if (bestTaskValue) bestTaskValue.textContent = '--';
        
        if (logs.length === 0) {
            // No logs yet, show placeholder
            const container = document.getElementById('energy-chart-container');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <p>No energy data yet. Start tracking when you use timers.</p>
                </div>
            `;
            
            // Also show empty state in insights
            if (insightsContent) {
                insightsContent.innerHTML = `
                    <div class="empty-insights">
                        <i class="fas fa-chart-bar"></i>
                        <p>Track your energy levels with timers to see insights here.</p>
                    </div>
                `;
            }
            return;
        }
        
        // Process the energy data for insights
        // Group logs by timeOfDay, task, and day of week
        const timeOfDayGroups = {
            'Morning (6AM-12PM)': { count: 0, totalEnergy: 0, logs: [] },
            'Afternoon (12PM-6PM)': { count: 0, totalEnergy: 0, logs: [] },
            'Evening (6PM-12AM)': { count: 0, totalEnergy: 0, logs: [] },
            'Night (12AM-6AM)': { count: 0, totalEnergy: 0, logs: [] }
        };
        
        // Task energy impact (how tasks affect energy levels)
        const taskImpact = {};
        
        // Day of week analysis
        const dayOfWeekGroups = {
            0: { name: 'Sunday', count: 0, totalEnergy: 0 },
            1: { name: 'Monday', count: 0, totalEnergy: 0 },
            2: { name: 'Tuesday', count: 0, totalEnergy: 0 },
            3: { name: 'Wednesday', count: 0, totalEnergy: 0 },
            4: { name: 'Thursday', count: 0, totalEnergy: 0 },
            5: { name: 'Friday', count: 0, totalEnergy: 0 },
            6: { name: 'Saturday', count: 0, totalEnergy: 0 }
        };
        
        // Process data for display
        const labels = [];
        const datasets = [];
        const startData = [];
        const endData = [];
        
        // Group logs by date and timer
        const dateGroups = {};
        const timerGroups = {};
        
        // Energy level ranges for classification
        const energyRanges = {
            low: { min: 1, max: 3, label: 'Low', icon: '😴' },
            medium: { min: 4, max: 7, label: 'Medium', icon: '😐' },
            high: { min: 8, max: 10, label: 'High', icon: '⚡' }
        };

        logs.forEach(log => {
            try {
                // Format for display
                const date = new Date(log.timestamp || log.timestamp);
                if (isNaN(date.getTime())) {
                    console.error('Invalid timestamp found:', log.timestamp);
                    return; // Skip this log entry
                }
                
                const energyLevel = log.energy_level || log.energyLevel;
                const formattedDate = `${date.getMonth()+1}/${date.getDate()}`;
                const hour = date.getHours();
                const minutes = date.getMinutes();
                const time = `${hour}:${minutes.toString().padStart(2,'0')}`;
                const label = `${formattedDate} ${time}`;
                const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
                
                // Categorize by time of day
                let timeOfDay;
                if (hour >= 6 && hour < 12) {
                    timeOfDay = 'Morning (6AM-12PM)';
                } else if (hour >= 12 && hour < 18) {
                    timeOfDay = 'Afternoon (12PM-6PM)';
                } else if (hour >= 18 && hour < 24) {
                    timeOfDay = 'Evening (6PM-12AM)';
                } else {
                    timeOfDay = 'Night (12AM-6AM)';
                }
                
                // Update time of day stats
                timeOfDayGroups[timeOfDay].count++;
                timeOfDayGroups[timeOfDay].totalEnergy += energyLevel;
                timeOfDayGroups[timeOfDay].logs.push(log);
                
                // Update day of week stats
                dayOfWeekGroups[dayOfWeek].count++;
                dayOfWeekGroups[dayOfWeek].totalEnergy += energyLevel;
                
                // Add to date groups
                const day = `${date.getMonth()+1}/${date.getDate()}`;
                if (!dateGroups[day]) {
                    dateGroups[day] = {
                        labels: [],
                        start: [],
                        end: []
                    };
                }
                
                dateGroups[day].labels.push(time);
                if (log.stage === 'start') {
                    dateGroups[day].start.push(energyLevel);
                } else {
                    dateGroups[day].end.push(energyLevel);
                }
                
                // Add to timer groups
                const timerName = log.timer_name || log.timerName || 'Unknown';
                if (!timerGroups[timerName]) {
                    timerGroups[timerName] = {
                        start: [],
                        end: [],
                        count: 0,
                        totalEnergyStart: 0,
                        totalEnergyEnd: 0,
                        energyChange: 0
                    };
                }
                
                if (log.stage === 'start') {
                    timerGroups[timerName].start.push(energyLevel);
                    timerGroups[timerName].totalEnergyStart += energyLevel;
                } else {
                    timerGroups[timerName].end.push(energyLevel);
                    timerGroups[timerName].totalEnergyEnd += energyLevel;
                }
                
                timerGroups[timerName].count++;
                // Task impact analysis
                const taskName = log.timer_name || log.timerName || 'Unknown';
                
                // Only analyze paired logs (start and end for same timer)
                if (timerGroups[taskName].start.length > 0 && timerGroups[taskName].end.length > 0) {
                    if (!taskImpact[taskName]) {
                        taskImpact[taskName] = {
                            totalImpact: 0,
                            count: 0,
                            avgImpact: 0
                        };
                    }
                    
                    // Calculate impact for this task
                    if (log.stage === 'end') {
                        const previousStart = timerGroups[taskName].start.length - 1;
                        if (previousStart >= 0) {
                            const startEnergy = timerGroups[taskName].start[previousStart];
                            const endEnergy = energyLevel;
                            const impact = endEnergy - startEnergy;
                            
                            taskImpact[taskName].totalImpact += impact;
                            taskImpact[taskName].count++;
                            taskImpact[taskName].avgImpact = taskImpact[taskName].totalImpact / taskImpact[taskName].count;
                        }
                    }
                }
            } catch (e) {
                console.error('Error processing energy log:', e, log);
            }
        });
        
        // Process timer groups to calculate energy changes
        Object.keys(timerGroups).forEach(timerName => {
            const group = timerGroups[timerName];
            if (group.start.length > 0 && group.end.length > 0) {
                const avgStart = group.totalEnergyStart / group.start.length;
                const avgEnd = group.totalEnergyEnd / group.end.length;
                group.energyChange = avgEnd - avgStart;
            }
        });
        
        // Calculate time of day averages
        Object.keys(timeOfDayGroups).forEach(tod => {
            const group = timeOfDayGroups[tod];
            group.avgEnergy = group.count > 0 ? group.totalEnergy / group.count : 0;
        });
        
        // Calculate day of week averages
        Object.keys(dayOfWeekGroups).forEach(day => {
            const group = dayOfWeekGroups[day];
            group.avgEnergy = group.count > 0 ? group.totalEnergy / group.count : 0;
        });
        
        // Create chart instance
        if (window.energyChart) {
            window.energyChart.destroy();
        }
        
        // Find the most recent 5 days with data
        const sortedDays = Object.keys(dateGroups).sort((a,b) => {
            const [monthA, dayA] = a.split('/').map(Number);
            const [monthB, dayB] = b.split('/').map(Number);
            return (monthB - monthA) || (dayB - dayA);
        }).slice(0, 5);
        
        // Create daily energy chart
        window.energyChart = new Chart(energyChartEl, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Energy Before Session',
                        data: sortedDays.map(day => {
                            const values = dateGroups[day].start;
                            return values.length > 0 ? 
                                values.reduce((a,b) => a+b, 0) / values.length : null;
                        }),
                        borderColor: '#4287f5',
                        backgroundColor: 'rgba(66, 135, 245, 0.2)',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Energy After Session',
                        data: sortedDays.map(day => {
                            const values = dateGroups[day].end;
                            return values.length > 0 ? 
                                values.reduce((a,b) => a+b, 0) / values.length : null;
                        }),
                        borderColor: '#f54242',
                        backgroundColor: 'rgba(245, 66, 66, 0.2)',
                        borderWidth: 2,
                        tension: 0.3
                    }
                ],
                labels: sortedDays
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 0,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Energy Level (1-10)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                const day = items[0].label;
                                return `Energy Level - ${day}`;
                            }
                        }
                    }
                }
            }
        });
        
        // Find best time of day for energy
        let bestTimeOfDay = Object.keys(timeOfDayGroups).reduce((best, current) => {
            return (timeOfDayGroups[current].avgEnergy > timeOfDayGroups[best].avgEnergy) ? 
                current : best;
        }, Object.keys(timeOfDayGroups)[0]);
        
        // Find best day of week for energy
        let bestDayOfWeek = Object.keys(dayOfWeekGroups).reduce((best, current) => {
            return (dayOfWeekGroups[current].avgEnergy > dayOfWeekGroups[best].avgEnergy) ? 
                current : best;
        }, '0');
        
        // Find the most energizing task
        let mostEnergizingTask = null;
        let bestTaskAvgImpact = -Infinity;
        
        Object.keys(taskImpact).forEach(task => {
            if (taskImpact[task].count >= 2 && taskImpact[task].avgImpact > bestTaskAvgImpact) {
                mostEnergizingTask = task;
                bestTaskAvgImpact = taskImpact[task].avgImpact;
            }
        });
        
        // Update the trend cards with the insights
        if (bestTimeValue) {
            const timeText = timeOfDayGroups[bestTimeOfDay].avgEnergy > 0 ? 
                bestTimeOfDay : 'Not enough data';
            bestTimeValue.textContent = timeText;
        }
        
        if (bestTaskValue) {
            const taskText = (mostEnergizingTask && bestTaskAvgImpact > 0) ? 
                mostEnergizingTask : 'Not enough data';
            bestTaskValue.textContent = taskText;
        }
        
        // Populate the Energy Insights content with detailed information
        if (insightsContent) {
            // Clear any existing content first
            insightsContent.innerHTML = '';
            
            // Create detailed insights if we have enough data
            if (logs.length >= 3) {
                // Energy pattern insights box
                const patternInsight = document.createElement('div');
                patternInsight.className = 'energy-insights-box';
                
                // Time of day insight
                let timeOfDayInsight = '';
                if (timeOfDayGroups[bestTimeOfDay].avgEnergy > 0) {
                    timeOfDayInsight = `
                        <div class="energy-insight-item">
                            <div class="energy-insights-icon">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="energy-insight-content">
                                <div class="energy-insight-title">Peak Energy Time</div>
                                <div class="energy-insight-desc">
                                    Your energy levels tend to be highest during ${bestTimeOfDay}. 
                                    Consider scheduling your most demanding tasks during this timeframe.
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Best day of week insight
                let dayOfWeekInsight = '';
                if (dayOfWeekGroups[bestDayOfWeek].count >= 2) {
                    dayOfWeekInsight = `
                        <div class="energy-insight-item">
                            <div class="energy-insights-icon">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                            <div class="energy-insight-content">
                                <div class="energy-insight-title">Best Day of the Week</div>
                                <div class="energy-insight-desc">
                                    ${dayOfWeekGroups[bestDayOfWeek].name} appears to be your most energetic day.
                                    Plan important activities or focus sessions on this day when possible.
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Task impact insight
                let taskImpactInsight = '';
                if (mostEnergizingTask && bestTaskAvgImpact > 0) {
                    taskImpactInsight = `
                        <div class="energy-insight-item">
                            <div class="energy-insights-icon">
                                <i class="fas fa-bolt"></i>
                            </div>
                            <div class="energy-insight-content">
                                <div class="energy-insight-title">Energy Boosting Activity</div>
                                <div class="energy-insight-desc">
                                    "${mostEnergizingTask}" sessions tend to increase your energy levels by 
                                    approximately ${bestTaskAvgImpact.toFixed(1)} points. Consider using this 
                                    activity when you need an energy boost.
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Find most draining task if it exists
                let mostDrainingTask = null;
                let worstTaskAvgImpact = Infinity;
                
                Object.keys(taskImpact).forEach(task => {
                    if (taskImpact[task].count >= 2 && taskImpact[task].avgImpact < worstTaskAvgImpact && taskImpact[task].avgImpact < 0) {
                        mostDrainingTask = task;
                        worstTaskAvgImpact = taskImpact[task].avgImpact;
                    }
                });
                
                // Draining task insight
                let drainingTaskInsight = '';
                if (mostDrainingTask && worstTaskAvgImpact < 0) {
                    drainingTaskInsight = `
                        <div class="energy-insight-item">
                            <div class="energy-insights-icon">
                                <i class="fas fa-battery-quarter"></i>
                            </div>
                            <div class="energy-insight-content">
                                <div class="energy-insight-title">Energy Draining Activity</div>
                                <div class="energy-insight-desc">
                                    "${mostDrainingTask}" sessions tend to decrease your energy levels by 
                                    approximately ${Math.abs(worstTaskAvgImpact).toFixed(1)} points. Try scheduling 
                                    these sessions when you don't need to be at peak energy afterward.
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Combine all insights
                patternInsight.innerHTML = timeOfDayInsight + dayOfWeekInsight + taskImpactInsight + drainingTaskInsight;
                
                // Only add the box if we have at least one insight
                if (timeOfDayInsight || dayOfWeekInsight || taskImpactInsight || drainingTaskInsight) {
                    insightsContent.appendChild(patternInsight);
                }
                
                // Energy trend statistics
                const trendStats = document.createElement('div');
                trendStats.className = 'energy-stats-container';
                
                // Calculate overall energy trend
                let totalStartEnergy = 0;
                let totalEndEnergy = 0;
                let startCount = 0;
                let endCount = 0;
                
                logs.forEach(log => {
                    const energy = log.energy_level || log.energyLevel;
                    if (log.stage === 'start') {
                        totalStartEnergy += energy;
                        startCount++;
                    } else {
                        totalEndEnergy += energy;
                        endCount++;
                    }
                });
                
                const avgStartEnergy = startCount > 0 ? totalStartEnergy / startCount : 0;
                const avgEndEnergy = endCount > 0 ? totalEndEnergy / endCount : 0;
                const overallTrend = avgEndEnergy - avgStartEnergy;
                
                // Overall energy trend stat
                let trendIcon = 'fa-minus';
                let trendColor = '#666';
                
                if (overallTrend > 0.5) {
                    trendIcon = 'fa-arrow-up';
                    trendColor = '#28a745';
                } else if (overallTrend < -0.5) {
                    trendIcon = 'fa-arrow-down';
                    trendColor = '#dc3545';
                }
                
                trendStats.innerHTML = `
                    <div class="energy-stat">
                        <i class="fas ${trendIcon} energy-stat-icon" style="color: ${trendColor}"></i>
                        <div class="energy-stat-content">
                            <div class="energy-stat-value">${Math.abs(overallTrend).toFixed(1)} point ${overallTrend >= 0 ? 'increase' : 'decrease'}</div>
                            <div class="energy-stat-label">Average energy change after work sessions</div>
                        </div>
                    </div>
                `;
                
                insightsContent.appendChild(trendStats);
                
                // Recommendation box
                const recommendationBox = document.createElement('div');
                recommendationBox.className = 'energy-insights-box';
                
                // Generate personalized recommendations based on data
                let recommendations = [];
                
                if (overallTrend < -1) {
                    // Sessions are draining energy significantly
                    recommendations.push({
                        icon: 'fa-clock',
                        title: 'Shorter Sessions',
                        desc: 'Your energy tends to drop significantly during work sessions. Consider using shorter focus periods with more frequent breaks.'
                    });
                }
                
                if (bestTaskAvgImpact > 1) {
                    // Energizing tasks exist
                    recommendations.push({
                        icon: 'fa-tasks',
                        title: 'Energy Boosting Task',
                        desc: `Start your day with "${mostEnergizingTask}" to boost your energy levels before tackling other tasks.`
                    });
                }
                
                // Add more recommendations if we have more data points
                if (logs.length >= 7) {
                    // Add recommendations based on time of day patterns
                    if (timeOfDayGroups[bestTimeOfDay].avgEnergy - timeOfDayGroups['Night (12AM-6AM)'].avgEnergy > 2) {
                        recommendations.push({
                            icon: 'fa-sun',
                            title: 'Optimize Your Schedule',
                            desc: `Schedule your most challenging tasks during ${bestTimeOfDay} when your energy is at its peak.`
                        });
                    }
                }
                
                // Add at least one recommendation even if data is limited
                if (recommendations.length === 0) {
                    recommendations.push({
                        icon: 'fa-chart-line',
                        title: 'Track More Data',
                        desc: 'Continue logging your energy levels to receive more personalized recommendations based on your patterns.'
                    });
                }
                
                // Build recommendation HTML
                let recommendationHtml = '';
                recommendations.forEach(rec => {
                    recommendationHtml += `
                        <div class="energy-insight-item">
                            <div class="energy-insights-icon">
                                <i class="fas ${rec.icon}"></i>
                            </div>
                            <div class="energy-insight-content">
                                <div class="energy-insight-title">${rec.title}</div>
                                <div class="energy-insight-desc">${rec.desc}</div>
                            </div>
                        </div>
                    `;
                });
                
                recommendationBox.innerHTML = `
                    <h4 style="margin-top: 0; margin-bottom: 15px; color: #4facfe;">
                        <i class="fas fa-lightbulb"></i> Recommendations
                    </h4>
                    ${recommendationHtml}
                `;
                
                insightsContent.appendChild(recommendationBox);
            } else {
                // Not enough data yet
                insightsContent.innerHTML = `
                    <div class="empty-insights">
                        <i class="fas fa-chart-bar"></i>
                        <p>Track more energy levels with timers to see detailed insights here.</p>
                        <p>We need at least 3 data points to generate insights.</p>
                    </div>
                `;
            }
        }
    }

    // Re-Entry Mode functionality
    function showReEntryMode(timerId) {
        // Find the timer element
        const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        if (!timer) return;
        
        // Check if re-entry section already exists
        let reEntrySection = timer.querySelector('.re-entry-mode');
        if (reEntrySection) {
            reEntrySection.style.display = 'block';
            return;
        }
        
        // Get the timer name and any notes from previous session
        const timerName = timer.querySelector('h3').textContent;
        
        // Try to get the last task worked on from flow shelf
        let lastTaskText = "your previous task";
        try {
            const flowShelfItems = JSON.parse(localStorage.getItem('flowShelfItems') || '[]');
            if (flowShelfItems.length > 0) {
                lastTaskText = flowShelfItems[0]; // Use the most recent item
            }
        } catch (e) {
            console.error('Error retrieving flow shelf items:', e);
        }
        
        // Generate a small, achievable restart task suggestion
        const restartTasks = [
            `Take 2 minutes to review where you left off, then commit to a 5-minute focused session.`,
            `Read through the last few paragraphs or lines of code you wrote to refresh your memory.`,
            `Jot down 3 key points you remember from your previous session.`,
            `Look at your work for one minute, then write a one-sentence summary of your next step.`,
            `Set a timer for 3 minutes of uninterrupted focus to ease back into your workflow.`
        ];
        
        // Randomly select a restart task
        const restartTask = restartTasks[Math.floor(Math.random() * restartTasks.length)];
        
        // Create re-entry section
        reEntrySection = document.createElement('div');
        reEntrySection.className = 're-entry-mode';
        reEntrySection.innerHTML = `
            <h4><i class="fas fa-redo-alt"></i> Recovery Tracker: Re-Entry Mode</h4>
            <p><i class="fas fa-volume-up"></i> <em>"Ready to get back in?"</em></p>
            <div class="re-entry-recap">
                <h5><i class="fas fa-tasks"></i> Recap of Previous Work:</h5>
                <p>You were working on <strong>${timerName}</strong>.</p>
                <p class="last-task-text">Last noted task: "${lastTaskText}"</p>
            </div>
            <div class="re-entry-task">
                <h5><i class="fas fa-check-circle"></i> Suggested Restart Task:</h5>
                <p>${restartTask}</p>
            </div>
            <button class="btn btn-start re-entry-start-btn">
                <i class="fas fa-play"></i> I'm Ready to Return
            </button>
        `;
        
        // Append to timer
        timer.appendChild(reEntrySection);
        
        // Add event listener to start button
        const startBtn = reEntrySection.querySelector('.re-entry-start-btn');
        startBtn.addEventListener('click', function() {
            reEntrySection.style.display = 'none';
            startTimer(timerId, parseInt(timer.querySelector('.start-timer-btn').getAttribute('data-duration')));
        });
        
        // Play a gentle "ready to return" sound
        const returnAudio = new Audio('/static/audio/return.mp3');
        returnAudio.volume = 0.5;
        returnAudio.play().catch(() => { /* Handle silently */ });
    }

    // Helper functions
    function isAnyTimerRunning() {
        return Object.keys(activeTimers).length > 0;
    }

    // Load data from localStorage on page load
    loadShelfFromLocalStorage();
    
    // Initialize energy log data if available
    fetchEnergyLogs();
    
    // Initialize energy chart if element exists
    const energyChartEl = document.getElementById('energy-chart');
    if (energyChartEl) {
        displayEnergyChart();
    }

    // Create dynamic timers with proper controls
    function addDynamicTimer(timerId, timerData) {
        const timerList = document.querySelector('.timer-list');
        if (!timerList) return;
        
        // Create timer item
        const timerItem = document.createElement('div');
        timerItem.className = `timer-item ${timerData.isRunning ? 'timer-running' : 'timer-stopped'}`;
        timerItem.setAttribute('data-timer-id', timerId);
        
        // Calculate minutes from seconds
        const durationMinutes = Math.floor(timerData.duration / 60);
        
        // Create the HTML structure
        timerItem.innerHTML = `
            <div class="timer-details">
                <h3>${timerData.name}</h3>
                <p><i class="fas fa-stopwatch"></i> ${durationMinutes} minutes</p>
                ${timerData.startTime ? `<p><i class="fas fa-play"></i> Started: ${timerData.startTime}</p>` : ''}
                ${timerData.endTime ? `<p><i class="fas fa-stop"></i> Ended: ${timerData.endTime}</p>` : ''}
                ${timerData.isRunning ? `<div class="timer-countdown"></div>` : ''}
            </div>
            <div class="timer-controls">
                ${!timerData.isRunning ? 
                    `<button type="button" class="btn btn-start start-timer-btn" data-timer-id="${timerId}" data-duration="${durationMinutes}">
                        <i class="fas fa-play"></i> Start
                    </button>` : 
                    `<button type="button" class="btn btn-pause pause-timer-btn" data-timer-id="${timerId}" style="display: inline-flex;">
                        <i class="fas fa-pause"></i> Pause
                    </button>
                    <button type="button" class="btn btn-resume resume-timer-btn" data-timer-id="${timerId}" style="display: none;">
                        <i class="fas fa-play"></i> Resume
                    </button>
                    <button type="button" class="btn btn-stop stop-timer-btn" data-timer-id="${timerId}">
                        <i class="fas fa-stop"></i> Stop
                    </button>`
                }
                <form action="/delete_timer/${timerId}" method="post" onsubmit="return confirm('Are you sure you want to delete this timer?');">
                    <button type="submit" class="btn btn-delete">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </form>
            </div>
        `;
        
        // Add to the timer list
        timerList.appendChild(timerItem);
        
        // Initialize event listeners for the timer's buttons
        const startBtn = timerItem.querySelector('.start-timer-btn');
        if (startBtn) {
            startBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const timerId = this.getAttribute('data-timer-id');
                const timerDuration = parseInt(this.getAttribute('data-duration'));
                startTimer(timerId, timerDuration);
            });
        }
        
        const pauseBtn = timerItem.querySelector('.pause-timer-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const timerId = this.getAttribute('data-timer-id');
                pauseTimer(timerId);
            });
        }
        
        const resumeBtn = timerItem.querySelector('.resume-timer-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const timerId = this.getAttribute('data-timer-id');
                resumeTimer(timerId);
            });
        }
        
        const stopBtn = timerItem.querySelector('.stop-timer-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const timerId = this.getAttribute('data-timer-id');
                stopTimer(timerId);
            });
        }
        
        // If the timer is running, start it in the UI
        if (timerData.isRunning) {
            // We need to manually start the timer in the UI
            startTimer(timerId, durationMinutes);
        }
        
        return timerItem;
    }
});
