document.addEventListener('DOMContentLoaded', function() {
    // Global variables for the timer
    let activeTimers = {};
    let checkInIntervals = {};
    let audioPlayer = null;
    let currentSound = null;

    // Initialize everything
    initializeTimers();
    initializeFlowShelf();
    initializeSoundPlayer();
    initializeEnergyLog();

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
            
            // Get the form in the timer controls and swap buttons
            const startBtn = timer.querySelector('.start-timer-btn');
            const stopBtn = timer.querySelector('.stop-timer-btn');
            
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'inline-flex';
            
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

    function stopTimer(timerId) {
        // Clear the interval
        if (activeTimers[timerId]) {
            clearInterval(activeTimers[timerId]);
            delete activeTimers[timerId];
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
            timer.classList.add('timer-stopped');
            
            // Remove countdown display
            const countdownEl = timer.querySelector('.timer-countdown');
            if (countdownEl) {
                countdownEl.textContent = 'Stopped';
            }
            
            // Swap buttons
            const startBtn = timer.querySelector('.start-timer-btn');
            const stopBtn = timer.querySelector('.stop-timer-btn');
            
            if (startBtn) startBtn.style.display = 'inline-flex';
            if (stopBtn) stopBtn.style.display = 'none';
            
            // Stop the sound
            if (audioPlayer) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
            }
            
            // Show re-entry mode if enabled
            const reEntryEnabled = document.getElementById('enable-reentry')?.checked;
            if (reEntryEnabled) {
                showReEntryMode(timerId);
            }
            
            // Log ending energy if enabled
            const energyLoggingEnabled = document.getElementById('enable-energy-log')?.checked;
            if (energyLoggingEnabled) {
                showEnergyLogPrompt('end', timerId);
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
                
                // Show re-entry mode if enabled
                const reEntryEnabled = document.getElementById('enable-reentry')?.checked;
                if (reEntryEnabled) {
                    showReEntryMode(timerId);
                }
                
                // Log ending energy if enabled
                const energyLoggingEnabled = document.getElementById('enable-energy-log')?.checked;
                if (energyLoggingEnabled) {
                    showEnergyLogPrompt('end', timerId);
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
                    <div class="energy-log">
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
        
        // Show the modal
        energyModal.style.display = 'block';
    }

    function saveEnergyLog(timerId, stage, energyLevel) {
        // Save to local storage for now
        const logs = JSON.parse(localStorage.getItem('energyLogs') || '[]');
        logs.push({
            timerId: timerId,
            stage: stage,
            energyLevel: energyLevel,
            timestamp: new Date().toISOString()
        });
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
        });
    }

    function displayEnergyChart() {
        // This function would use a charting library like Chart.js
        // For now, we'll just log that it would display the chart
        console.log('Energy chart would be displayed here');
        
        // Placeholder for chart data
        const logs = JSON.parse(localStorage.getItem('energyLogs') || '[]');
        console.log('Energy logs:', logs);
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
        
        // Get the timer name
        const timerName = timer.querySelector('h3').textContent;
        
        // Create re-entry section
        reEntrySection = document.createElement('div');
        reEntrySection.className = 're-entry-mode';
        reEntrySection.innerHTML = `
            <h4><i class="fas fa-redo-alt"></i> Re-Entry Mode</h4>
            <p>Ready to get back to <strong>${timerName}</strong>?</p>
            <div class="re-entry-task">
                <h5>Suggested restart task:</h5>
                <p>Take 2 minutes to review where you left off, then commit to a 10-minute focused session.</p>
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
});
