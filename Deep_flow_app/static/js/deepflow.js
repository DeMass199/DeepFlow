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
    initializeEnergyInsights();
    
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

                    // Show energy insights popup instead of simple prompt
                    showEnergyInsightsForTimer(timerId, timerDuration);
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
            const resumeBtn = timer.querySelector('.resume-timer-btn');
            
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-flex';
            if (resumeBtn) resumeBtn.style.display = 'none';
            
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
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    console.error('Error starting timer:', data.error);
                    // Display an error message to the user
                    showNotification('Error starting timer: ' + (data.error || 'Unknown error'), 'error');
                }
            })
            .catch(error => {
                console.error('Error starting timer:', error);
                showNotification('Failed to start timer. Please try again.', 'error');
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
        
        // Show break confirmation dialog
        const isBreak = confirm("Are you having a break?");
        if (isBreak) {
            // Focus on the flow shelf text box
            const flowShelfTextBox = document.getElementById('flow-shelf-text');
            if (flowShelfTextBox) {
                flowShelfTextBox.focus();
                flowShelfTextBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        // Make AJAX request to update timer in database
        fetch(`/update_timer/${timerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'pause' }),
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Error pausing timer:', data.error);
                showNotification('Error pausing timer: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error pausing timer:', error);
            showNotification('Failed to pause timer. Timer functionality will continue locally.', 'error');
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
        // Adjust endTime to avoid adding extra time when resuming
        const adjustedEndTime = Date.now() + remainingTime - (Date.now() - pausedTimers[timerId].pausedAt);

        activeTimers[timerId] = setInterval(() => {
            updateCountdown(countdownEl, adjustedEndTime, timerId);
        }, 1000);
        
        // Update countdown immediately
        updateCountdown(countdownEl, adjustedEndTime, timerId);
        
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
        
        // Make AJAX request to update timer in database - we're restarting the timer so we send a 'start' action
        fetch(`/update_timer/${timerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'start' }),
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Error resuming timer:', data.error);
                showNotification('Error resuming timer: ' + (data.error || 'Unknown error'), 'error');
            }
        })
        .catch(error => {
            console.error('Error resuming timer:', error);
            // Show notification but keep timer running locally
            showNotification('Failed to update server, but timer is running locally.', 'error');
        });
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
            
            // Make AJAX request to update timer in database
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'stop' }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    console.error('Error stopping timer:', data.error);
                    showNotification('Error stopping timer: ' + (data.error || 'Unknown error'), 'error');
                }
            })
            .catch(error => {
                console.error('Error stopping timer:', error);
                showNotification('Failed to update timer status on server.', 'error');
            });
            
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
        
        // Process data for display
        const labels = [];
        const datasets = [];
        const startData = [];
        const endData = [];
        
        // Group logs by date and timer
        const dateGroups = {};
        const timerGroups = {};

        logs.forEach(log => {
            try {
                // Format for display
                const date = new Date(log.timestamp || log.timestamp);
                if (isNaN(date.getTime())) {
                    console.error('Invalid timestamp found:', log.timestamp);
                    return; // Skip this log entry
                }
                
                const formattedDate = `${date.getMonth()+1}/${date.getDate()}`;
                const time = `${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
                const label = `${formattedDate} ${time}`;
                
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
                    dateGroups[day].start.push(log.energy_level || log.energyLevel);
                } else {
                    dateGroups[day].end.push(log.energy_level || log.energyLevel);
                }
                
                // Add to timer groups
                const timerName = log.timer_name || log.timerName || 'Unknown';
                if (!timerGroups[timerName]) {
                    timerGroups[timerName] = {
                        start: [],
                        end: []
                    };
                }
                
                if (log.stage === 'start') {
                    timerGroups[timerName].start.push(log.energy_level || log.energyLevel);
                } else {
                    timerGroups[timerName].end.push(log.energy_level || log.energyLevel);
                }
            } catch (e) {
                console.error('Error processing energy log:', e, log);
            }
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
        
        // Add insights summary
        const container = document.getElementById('energy-chart-container');
        let insightsEl = document.getElementById('energy-insights');
        if (!insightsEl) {
            insightsEl = document.createElement('div');
            insightsEl.id = 'energy-insights';
            insightsEl.style.marginTop = '20px';
            insightsEl.style.fontSize = '0.9em';
            container.appendChild(insightsEl);
        }
        
        // Generate insights
        let insights = '<h4>Energy Insights:</h4><ul>';
        
        // Find best performing tasks/times
        const timerAverages = {};
        Object.entries(timerGroups).forEach(([timer, data]) => {
            const startAvg = data.start.length ? 
                data.start.reduce((a,b) => a+b, 0) / data.start.length : 0;
            const endAvg = data.end.length ? 
                data.end.reduce((a,b) => a+b, 0) / data.end.length : 0;
            const diff = endAvg - startAvg;
            
            timerAverages[timer] = {
                startAvg,
                endAvg,
                diff
            };
        });
        
        // Find most energizing task
        let bestTask = null;
        let bestTaskDiff = -Infinity;
        Object.entries(timerAverages).forEach(([timer, data]) => {
            if (data.diff > bestTaskDiff) {
                bestTask = timer;
                bestTaskDiff = data.diff;
            }
        });
        
        if (bestTask && bestTaskDiff > 0) {
            insights += `<li>"<strong>${bestTask}</strong>" sessions tend to increase your energy levels the most.</li>`;
        }
        
        // Find most draining task
        let worstTask = null;
        let worstTaskDiff = Infinity;
        Object.entries(timerAverages).forEach(([timer, data]) => {
            if (data.diff < worstTaskDiff) {
                worstTask = timer;
                worstTaskDiff = data.diff;
            }
        });
        
        if (worstTask && worstTaskDiff < 0) {
            insights += `<li>"<strong>${worstTask}</strong>" sessions tend to drain your energy the most.</li>`;
        }
        
        // Add time of day insight if we have enough data
        if (logs.length >= 5) {
            const morningLogs = logs.filter(log => {
                const hour = new Date(log.timestamp || log.timestamp).getHours();
                return hour >= 6 && hour < 12;
            });
            
            const afternoonLogs = logs.filter(log => {
                const hour = new Date(log.timestamp || log.timestamp).getHours();
                return hour >= 12 && hour < 18;
            });
            
            const eveningLogs = logs.filter(log => {
                const hour = new Date(log.timestamp || log.timestamp).getHours();
                return hour >= 18 || hour < 6;
            });
            
            const timeGroups = [
                { name: 'Morning', logs: morningLogs },
                { name: 'Afternoon', logs: afternoonLogs },
                { name: 'Evening', logs: eveningLogs }
            ];
            
            let bestTime = null;
            let bestTimeAvg = -Infinity;
            
            timeGroups.forEach(group => {
                if (group.logs.length > 0) {
                    const avgEnergy = group.logs
                        .map(log => log.energy_level || log.energyLevel)
                        .reduce((a,b) => a+b, 0) / group.logs.length;
                    
                    if (avgEnergy > bestTimeAvg) {
                        bestTime = group.name;
                        bestTimeAvg = avgEnergy;
                    }
                }
            });
            
            if (bestTime) {
                insights += `<li><strong>${bestTime}</strong> appears to be your most energetic time of day.</li>`;
            }
        }
        
        insights += '</ul>';
        insightsEl.innerHTML = insights;
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

    // Energy Insights Form Functionality
    function initializeEnergyInsights() {
        const modal = document.getElementById('energy-insights-modal');
        const openBtn = document.getElementById('energy-insights-btn');
        const form = document.getElementById('add-energy-insight-form');
        
        // Handle the main form on the dashboard
        if (form) {
            initializeEnergyInsightsForm();
        }
        
        // Load initial insights and chart
        loadEnergyInsights();
        displayEnergyInsightsChart();
        
        // Handle modal functionality if it exists
        if (modal && openBtn) {
            const closeBtn = document.getElementById('close-insights-modal');
            const cancelBtn = document.getElementById('cancel-insights-btn');
            const modalForm = document.getElementById('energy-insights-form');
            
            // Open energy analytics dashboard
            openBtn.addEventListener('click', function() {
                generateEnergyAnalytics();
            });
            
            // Close modal
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
            
            // Close modal when clicking outside
            window.addEventListener('click', function(event) {
                if (event.target === modal) {
                    closeModal();
                }
            });
            
            // Handle modal form if it exists
            if (modalForm) {
                initializeModalForm(modalForm);
            }
            
            function closeModal() {
                modal.style.display = 'none';
            }
        }
    }

    // Initialize the main energy insights form on the dashboard
    function initializeEnergyInsightsForm() {
        const form = document.getElementById('add-energy-insight-form');
        if (!form) {
            console.log('Energy insights form not found');
            return;
        }
        
        console.log('Initializing energy insights form...');
        
        // Handle slider value updates
        const sliders = form.querySelectorAll('.energy-slider');
        console.log('Found', sliders.length, 'energy sliders');
        
        sliders.forEach((slider, index) => {
            console.log(`Processing slider ${index}: ${slider.id}`);
            
            // Find the correct value span - it's in the slider-labels div
            const sliderContainer = slider.closest('.slider-container');
            const valueSpan = sliderContainer ? sliderContainer.querySelector('.energy-value') : null;
            
            if (valueSpan) {
                console.log(`Found value span for slider ${index}`);
                
                // Function to update value and position
                const updateSliderValue = () => {
                    const value = slider.value;
                    const min = slider.min || 1;
                    const max = slider.max || 10;
                    
                    // Update the displayed value
                    valueSpan.textContent = value;
                    
                    // Calculate the percentage position of the thumb
                    const percentage = ((value - min) / (max - min)) * 100;
                    
                    // Position the value display to align with the thumb
                    // Account for the thumb width and container padding
                    const offset = (percentage - 50) * 0.8; // Slight adjustment for better alignment
                    valueSpan.style.transform = `translateX(calc(-50% + ${offset}%))`;
                };
                
                // Set initial value and position
                updateSliderValue();
                
                // Update on input
                slider.addEventListener('input', updateSliderValue);
                
                // Also add change event as backup
                slider.addEventListener('change', updateSliderValue);
            } else {
                console.error(`No value span found for slider ${index}`);
            }
        });
        
        // Handle form submission
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {
                overall_energy: formData.get('energy_level'),
                motivation_level: formData.get('focus_level'), // Using focus level as motivation
                focus_clarity: formData.get('focus_level'),
                physical_energy: formData.get('energy_level'), // Using energy level as physical
                mood_state: formData.get('mood'),
                energy_source: '', // Not in simple form
                energy_drains: '', // Not in simple form
                notes: '' // Notes field removed from simple form
            };
            
            if (!data.mood_state) {
                showNotification('Please select your current mood.', 'error');
                return;
            }
            
            // Save insights and refresh chart
            saveEnergyInsights(data);
        });
    }

    // Initialize modal form (advanced energy insights)
    function initializeModalForm(form) {
        // Handle slider value updates
        form.querySelectorAll('.energy-slider').forEach(slider => {
            const valueSpan = slider.parentElement.querySelector('.energy-value');
            
            if (valueSpan) {
                // Set initial value
                valueSpan.textContent = slider.value;
                
                // Update on input
                slider.addEventListener('input', function() {
                    valueSpan.textContent = this.value;
                });
            }
        });
        
        // Handle mood selection
        form.querySelectorAll('.mood-option').forEach(option => {
            option.addEventListener('click', function() {
                form.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                const moodInput = form.querySelector('#mood-state');
                if (moodInput) moodInput.value = this.dataset.mood;
            });
        });
        
        // Handle form submission
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {
                overall_energy: formData.get('overall_energy'),
                motivation_level: formData.get('motivation_level'),
                focus_clarity: formData.get('focus_clarity'),
                physical_energy: formData.get('physical_energy'),
                mood_state: formData.get('mood_state'),
                energy_source: formData.get('energy_source'),
                energy_drains: formData.get('energy_drains'),
                notes: formData.get('notes')
            };
            
            if (!data.mood_state) {
                showNotification('Please select your current mood.', 'error');
                return;
            }
            
            saveEnergyInsights(data);
        });
    }

    // Show energy insights modal when starting a timer
    function showEnergyInsightsForTimer(timerId, timerDuration) {
        const modal = document.getElementById('energy-insights-modal');
        const form = document.getElementById('energy-insights-form');
        
        if (!modal || !form) {
            console.error('Energy insights modal not found');
            // Fallback to simple energy prompt
            showEnergyLogPrompt('start', timerId);
            return;
        }

        // Update modal title and description for timer context
        const modalTitle = modal.querySelector('h3');
        const modalDescription = modal.querySelector('.modal-description');
        
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-play"></i> Ready to start your focus session?';
        }
        if (modalDescription) {
            modalDescription.textContent = 'Tell us how you\'re feeling right now to get better insights about your focus patterns.';
        }

        // Reset form to default values
        resetInsightsForm();
        
        // Show the modal
        modal.style.display = 'block';

        // Remove any existing timer-specific event listeners
        const existingTimerHandler = form.getAttribute('data-timer-handler');
        if (existingTimerHandler) {
            form.removeEventListener('submit', window[existingTimerHandler]);
        }

        // Create new event handler for timer start context
        const timerStartHandler = function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {
                overall_energy: formData.get('overall_energy'),
                motivation_level: formData.get('motivation_level'),
                focus_clarity: formData.get('focus_clarity'),
                physical_energy: formData.get('physical_energy'),
                mood_state: formData.get('mood_state'),
                energy_source: formData.get('energy_source'),
                energy_drains: formData.get('energy_drains'),
                notes: formData.get('notes')
            };
            
            if (!data.mood_state) {
                alert('Please select your current mood.');
                return;
            }

            // Save energy insights first
            fetch('/save_energy_insights', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    // Close the modal
                    modal.style.display = 'none';
                    
                    // Show notification
                    showNotification('Energy insights saved! Starting your focus session...', 'success');
                    
                    // Now start the timer
                    startTimer(timerId, timerDuration);
                    
                    // Refresh insights display
                    loadEnergyInsights();
                } else {
                    showNotification('Error saving insights: ' + result.error, 'error');
                }
            })
            .catch(error => {
                console.error('Error saving energy insights:', error);
                showNotification('Error saving energy insights. Starting timer anyway...', 'error');
                // Still start the timer even if insights saving failed
                modal.style.display = 'none';
                startTimer(timerId, timerDuration);
            });
        };

        // Store handler reference and add event listener
        const handlerName = 'timerStartHandler_' + Date.now();
        window[handlerName] = timerStartHandler;
        form.setAttribute('data-timer-handler', handlerName);
        form.addEventListener('submit', timerStartHandler);

        // Override the cancel button to restore original form behavior
        const cancelBtn = document.getElementById('cancel-insights-btn');
        if (cancelBtn) {
            const cancelHandler = function() {
                modal.style.display = 'none';
                // Clean up the timer-specific handler
                form.removeEventListener('submit', timerStartHandler);
                form.removeAttribute('data-timer-handler');
                delete window[handlerName];
                
                // Restore modal title and description
                if (modalTitle) {
                    modalTitle.innerHTML = '<i class="fas fa-bolt"></i> How are you feeling right now?';
                }
                if (modalDescription) {
                    modalDescription.textContent = 'Share your current energy state to build personalized insights over time.';
                }
            };
            
            // Remove existing cancel handlers and add new one
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', cancelHandler);
        }
    }

    // Helper function to reset the insights form
    function resetInsightsForm() {
        const form = document.getElementById('energy-insights-form');
        if (!form) return;
        
        form.reset();
        document.querySelectorAll('.energy-slider').forEach(slider => {
            slider.value = 5;
            const valueSpan = slider.parentElement.querySelector('.energy-value');
            if (valueSpan) valueSpan.textContent = '5';
        });
        document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
        document.getElementById('mood-state').value = '';
    }

    function saveEnergyInsights(data) {
        fetch('/save_energy_insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('Energy insights saved successfully!', 'success');
                
                // Reset the main form if it exists
                const mainForm = document.getElementById('add-energy-insight-form');
                if (mainForm) {
                    resetMainForm();
                }
                
                // Close modal if it exists
                const modal = document.getElementById('energy-insights-modal');
                if (modal) {
                    modal.style.display = 'none';
                }
                
                loadEnergyInsights(); // Refresh the insights display
                displayEnergyInsightsChart(); // Refresh the chart with new data
            } else {
                showNotification('Error saving insights: ' + result.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving energy insights:', error);
            showNotification('Error saving energy insights. Please try again.', 'error');
        });
    }

    function resetMainForm() {
        const form = document.getElementById('add-energy-insight-form');
        if (!form) return;
        
        // Reset form fields
        form.reset();
        
        // Reset sliders to default values
        const sliders = form.querySelectorAll('.energy-slider');
        sliders.forEach(slider => {
            slider.value = 5;
            const valueSpan = slider.parentElement.querySelector('.energy-value');
            if (valueSpan) valueSpan.textContent = '5';
        });
        
        // Reset mood selection to default
        const moodSelect = form.querySelector('#mood-select');
        if (moodSelect) {
            moodSelect.value = 'focused';
        }
        
        // Reset other fields - duration field has been removed
    }

    function loadEnergyInsights() {
        fetch('/get_energy_insights?limit=5')
        .then(response => response.json())
        .then(data => {
            if (data.insights) {
                displayEnergyInsights(data.insights);
            }
        })
        .catch(error => {
            console.error('Error loading energy insights:', error);
        });
    }

    function displayEnergyInsights(insights) {
        // Try both potential containers
        let container = document.getElementById('energy-insights-display');
        if (!container) {
            container = document.getElementById('energy-insights-list');
        }
        if (!container) return;
        
        if (insights.length === 0) {
            container.innerHTML = `
                <div class="empty-state" id="empty-insights">
                    <i class="fas fa-bolt"></i>
                    <h3>No energy insights yet</h3>
                    <p>Start tracking your energy levels to gain insights into your focus patterns.</p>
                </div>
            `;
            return;
        }
        
        // Hide empty state if it exists
        const emptyState = document.getElementById('empty-insights');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        container.innerHTML = insights.map(insight => {
            const date = new Date(insight.timestamp);
            const timeStr = date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            let textContent = '';
            if (insight.energy_source) {
                textContent += `<p><strong>Energy boosters:</strong> ${insight.energy_source}</p>`;
            }
            if (insight.energy_drains) {
                textContent += `<p><strong>Energy drains:</strong> ${insight.energy_drains}</p>`;
            }
            if (insight.notes) {
                textContent += `<p><strong>Notes:</strong> ${insight.notes}</p>`;
            }
            
            return `
                <div class="energy-insight-item" data-mood="${insight.mood_state}">
                    <div class="energy-insight-details">
                        <div class="energy-insight-header">
                            <span class="energy-insight-mood">${getMoodEmoji(insight.mood_state)}</span>
                            <h3 class="energy-insight-timestamp">Energy Check-in</h3>
                        </div>
                        <div class="energy-insight-metrics">
                            <div class="energy-metric">
                                <i class="fas fa-bolt"></i>
                                <span>Overall Energy:</span>
                                <span class="energy-metric-value">${insight.overall_energy}/10</span>
                            </div>
                            <div class="energy-metric">
                                <i class="fas fa-bullseye"></i>
                                <span>Focus:</span>
                                <span class="energy-metric-value">${insight.focus_clarity}/10</span>
                            </div>
                            <div class="energy-metric">
                                <i class="fas fa-rocket"></i>
                                <span>Motivation:</span>
                                <span class="energy-metric-value">${insight.motivation_level}/10</span>
                            </div>
                            <div class="energy-metric">
                                <i class="fas fa-dumbbell"></i>
                                <span>Physical:</span>
                                <span class="energy-metric-value">${insight.physical_energy}/10</span>
                            </div>
                        </div>
                        ${textContent ? `<div class="energy-insight-notes">${textContent}</div>` : ''}
                        <div class="energy-insight-meta">
                            <small><i class="fas fa-clock"></i> ${timeStr}</small>
                        </div>
                    </div>
                    <div class="energy-insight-controls">
                        <small class="energy-insight-mood-label">${insight.mood_state}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getMoodEmoji(mood) {
        const moodEmojis = {
            'happy': '😊',
            'calm': '😌',
            'focused': '🎯',
            'stressed': '😰',
            'anxious': '😟',
            'excited': '🤩',
            'tired': '😴',
            'frustrated': '😤'
        };
        return moodEmojis[mood] || '😐';
    }

    // Display Energy Insights Chart
    function displayEnergyInsightsChart() {
        const chartCanvas = document.getElementById('energy-chart');
        if (!chartCanvas) return;

        // Fetch energy insights data
        fetch('/get_energy_insights?limit=20')
        .then(response => response.json())
        .then(data => {
            const insights = data.insights || [];
            
            if (insights.length === 0) {
                // Show empty state
                const container = chartCanvas.parentElement;
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-chart-area"></i>
                        <p>No energy insights data yet. Record your energy states to see trends here.</p>
                    </div>
                `;
                return;
            }

            // Prepare data for the chart
            const labels = [];
            const energyData = [];
            const focusData = [];
            
            // Sort insights by timestamp (most recent first, then reverse for chronological order)
            const sortedInsights = insights.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            sortedInsights.forEach(insight => {
                const date = new Date(insight.timestamp);
                const dateLabel = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
                
                labels.push(dateLabel);
                energyData.push(insight.overall_energy || 5);
                focusData.push(insight.focus_clarity || 5);
            });

            // Destroy existing chart if it exists
            if (window.energyInsightsChart) {
                window.energyInsightsChart.destroy();
            }

            // Create new chart
            window.energyInsightsChart = new Chart(chartCanvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Energy Level',
                            data: energyData,
                            borderColor: '#4f46e5',
                            backgroundColor: 'rgba(79, 70, 229, 0.1)',
                            borderWidth: 3,
                            pointBackgroundColor: '#4f46e5',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            tension: 0.4
                        },
                        {
                            label: 'Focus Level',
                            data: focusData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 3,
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 6,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Your Energy & Focus Patterns',
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#374151'
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#374151',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            callbacks: {
                                title: function(context) {
                                    return `Check-in: ${context[0].label}`;
                                },
                                label: function(context) {
                                    return `${context.dataset.label}: ${context.parsed.y}/10`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Time',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                maxTicksLimit: 6,
                                font: {
                                    size: 10
                                }
                            }
                        },
                        y: {
                            display: true,
                            min: 1,
                            max: 10,
                            title: {
                                display: true,
                                text: 'Level (1-10)',
                                font: {
                                    size: 12,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: 10
                                }
                            },
                            grid: {
                                color: 'rgba(229, 231, 235, 0.5)'
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error loading energy insights for chart:', error);
        });
    }

    // Energy Insights Chart - End

    // Enhanced Energy Analytics Functions
    function generateEnergyAnalytics() {
        // Fetch both energy insights and timer logs for comprehensive analysis
        Promise.all([
            fetch('/get_energy_insights?limit=50').then(r => r.json()),
            fetch('/get_energy_logs').then(r => r.json())
        ])
        .then(([insightsData, logsData]) => {
            const insights = insightsData.insights || [];
            const logs = logsData.logs || [];
            
            // Combine data for analysis
            const combinedData = [...insights, ...logs];
            
            if (combinedData.length === 0) {
                displayNoDataAnalytics();
                return;
            }
            
            // Generate comprehensive analytics
            const analytics = {
                bestTimeOfDay: analyzeBestTimeOfDay(combinedData),
                bestDayOfWeek: analyzeBestDayOfWeek(combinedData),
                productivityPatterns: analyzeProductivityPatterns(combinedData),
                energyTrends: analyzeEnergyTrends(combinedData),
                focusInsights: analyzeFocusPatterns(combinedData)
            };
            
            displayEnergyAnalytics(analytics);
            createAnalyticsCharts(combinedData);
        })
        .catch(error => {
            console.error('Error generating analytics:', error);
            showNotification('Error loading analytics data', 'error');
        });
    }

    function analyzeBestTimeOfDay(data) {
        const timeSlots = {
            'Early Morning (6-9 AM)': { scores: [], count: 0 },
            'Morning (9-12 PM)': { scores: [], count: 0 },
            'Afternoon (12-3 PM)': { scores: [], count: 0 },
            'Late Afternoon (3-6 PM)': { scores: [], count: 0 },
            'Evening (6-9 PM)': { scores: [], count: 0 },
            'Night (9 PM-12 AM)': { scores: [], count: 0 }
        };
        
        data.forEach(entry => {
            const date = new Date(entry.timestamp);
            const hour = date.getHours();
            const energyScore = entry.overall_energy || entry.energy_level || 5;
            
            let timeSlot;
            if (hour >= 6 && hour < 9) timeSlot = 'Early Morning (6-9 AM)';
            else if (hour >= 9 && hour < 12) timeSlot = 'Morning (9-12 PM)';
            else if (hour >= 12 && hour < 15) timeSlot = 'Afternoon (12-3 PM)';
            else if (hour >= 15 && hour < 18) timeSlot = 'Late Afternoon (3-6 PM)';
            else if (hour >= 18 && hour < 21) timeSlot = 'Evening (6-9 PM)';
            else timeSlot = 'Night (9 PM-12 AM)';
            
            timeSlots[timeSlot].scores.push(energyScore);
            timeSlots[timeSlot].count++;
        });
        
        // Calculate averages and find best time
        let bestTime = null;
        let highestAverage = 0;
        
        Object.entries(timeSlots).forEach(([time, data]) => {
            if (data.scores.length > 0) {
                const average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
                data.average = average;
                
                if (average > highestAverage && data.count >= 2) { // Require at least 2 sessions
                    highestAverage = average;
                    bestTime = time;
                }
            }
        });
        
        return {
            bestTime,
            average: highestAverage,
            allTimeSlots: timeSlots
        };
    }

    function analyzeBestDayOfWeek(data) {
        const days = {
            'Monday': { scores: [], count: 0 },
            'Tuesday': { scores: [], count: 0 },
            'Wednesday': { scores: [], count: 0 },
            'Thursday': { scores: [], count: 0 },
            'Friday': { scores: [], count: 0 },
            'Saturday': { scores: [], count: 0 },
            'Sunday': { scores: [], count: 0 }
        };
        
        data.forEach(entry => {
            const date = new Date(entry.timestamp);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const energyScore = entry.overall_energy || entry.energy_level || 5;
            
            if (days[dayName]) {
                days[dayName].scores.push(energyScore);
                days[dayName].count++;
            }
        });
        
        // Calculate averages and find best day
        let bestDay = null;
        let highestAverage = 0;
        
        Object.entries(days).forEach(([day, data]) => {
            if (data.scores.length > 0) {
                const average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
                data.average = average;
                
                if (average > highestAverage && data.count >= 2) {
                    highestAverage = average;
                    bestDay = day;
                }
            }
        });
        
        return {
            bestDay,
            average: highestAverage,
            allDays: days
        };
    }

    function analyzeProductivityPatterns(data) {
        // Look for patterns in high-energy sessions
        const highEnergyEntries = data.filter(entry => {
            const energy = entry.overall_energy || entry.energy_level || 5;
            return energy >= 7; // High energy threshold
        });
        
        const patterns = {
            commonMoods: {},
            energySources: {},
            bestConditions: []
        };
        
        highEnergyEntries.forEach(entry => {
            // Count mood frequencies
            if (entry.mood_state) {
                patterns.commonMoods[entry.mood_state] = (patterns.commonMoods[entry.mood_state] || 0) + 1;
            }
            
            // Count energy source frequencies
            if (entry.energy_source) {
                const sources = entry.energy_source.toLowerCase().split(/[,;]/).map(s => s.trim());
                sources.forEach(source => {
                    if (source) {
                        patterns.energySources[source] = (patterns.energySources[source] || 0) + 1;
                    }
                });
            }
        });
        
        return patterns;
    }

    function analyzeEnergyTrends(data) {
        // Group data by week to see trends
        const weeklyData = {};
        const today = new Date();
        
        data.forEach(entry => {
            const date = new Date(entry.timestamp);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Start of week
            const weekKey = weekStart.toISOString().split('T')[0];
            
            if (!weeklyData[weekKey]) {
                weeklyData[weekKey] = { scores: [], count: 0 };
            }
            
            const energyScore = entry.overall_energy || entry.energy_level || 5;
            weeklyData[weekKey].scores.push(energyScore);
            weeklyData[weekKey].count++;
        });
        
        // Calculate weekly averages
        const weeklyAverages = Object.entries(weeklyData)
            .map(([week, data]) => ({
                week,
                average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
                count: data.count
            }))
            .sort((a, b) => new Date(a.week) - new Date(b.week));
        
        return {
            weeklyAverages,
            trend: calculateTrend(weeklyAverages)
        };
    }

    function analyzeFocusPatterns(data) {
        // Analyze focus and clarity patterns
        const focusData = data.filter(entry => entry.focus_clarity);
        
        if (focusData.length === 0) return null;
        
        const avgFocus = focusData.reduce((sum, entry) => sum + entry.focus_clarity, 0) / focusData.length;
        const highFocusSessions = focusData.filter(entry => entry.focus_clarity >= 7);
        
        return {
            averageFocus: avgFocus,
            highFocusCount: highFocusSessions.length,
            totalSessions: focusData.length,
            focusPercentage: (highFocusSessions.length / focusData.length) * 100
        };
    }

    function calculateTrend(weeklyData) {
        if (weeklyData.length < 2) return 'insufficient_data';
        
        const recent = weeklyData.slice(-3); // Last 3 weeks
        const earlier = weeklyData.slice(0, -3);
        
        if (earlier.length === 0) return 'insufficient_data';
        
        const recentAvg = recent.reduce((sum, week) => sum + week.average, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, week) => sum + week.average, 0) / earlier.length;
        
        const difference = recentAvg - earlierAvg;
        
        if (difference > 0.5) return 'improving';
        if (difference < -0.5) return 'declining';
        return 'stable';
    }

    function displayEnergyAnalytics(analytics) {
        const container = document.getElementById('energy-insights-display');
        if (!container) return;
        
        container.innerHTML = `
            <div class="analytics-dashboard">
                <h3><i class="fas fa-chart-bar"></i> Your Productivity Analytics</h3>
                
                <div class="analytics-grid">
                    <div class="analytics-card">
                        <h4><i class="fas fa-clock"></i> Best Time for Big Projects</h4>
                        <div class="analytics-value">
                            ${analytics.bestTimeOfDay.bestTime || 'Not enough data'}
                        </div>
                        <div class="analytics-detail">
                            ${analytics.bestTimeOfDay.bestTime ? 
                                `Average energy: ${analytics.bestTimeOfDay.average.toFixed(1)}/10` : 
                                'Complete more sessions to see patterns'}
                        </div>
                    </div>
                    
                    <div class="analytics-card">
                        <h4><i class="fas fa-calendar-day"></i> Most Productive Day</h4>
                        <div class="analytics-value">
                            ${analytics.bestDayOfWeek.bestDay || 'Not enough data'}
                        </div>
                        <div class="analytics-detail">
                            ${analytics.bestDayOfWeek.bestDay ? 
                                `Average energy: ${analytics.bestDayOfWeek.average.toFixed(1)}/10` : 
                                'Complete more sessions to see patterns'}
                        </div>
                    </div>
                    
                    ${analytics.focusInsights ? `
                    <div class="analytics-card">
                        <h4><i class="fas fa-bullseye"></i> Focus Performance</h4>
                        <div class="analytics-value">
                            ${analytics.focusInsights.focusPercentage.toFixed(0)}%
                        </div>
                        <div class="analytics-detail">
                            High focus sessions (${analytics.focusInsights.highFocusCount}/${analytics.focusInsights.totalSessions})
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="analytics-card">
                        <h4><i class="fas fa-trending-up"></i> Energy Trend</h4>
                        <div class="analytics-value">
                            ${getTrendDisplay(analytics.energyTrends.trend)}
                        </div>
                        <div class="analytics-detail">
                            Based on recent weeks
                        </div>
                    </div>
                </div>
                
                ${displayProductivityInsights(analytics.productivityPatterns)}
            </div>
        `;
    }

    function getTrendDisplay(trend) {
        switch(trend) {
            case 'improving': return '📈 Improving';
            case 'declining': return '📉 Declining';
            case 'stable': return '➡️ Stable';
            default: return '📊 Tracking...';
        }
    }

    function displayProductivityInsights(patterns) {
        const insights = [];
        
        // Most common high-energy mood
        if (Object.keys(patterns.commonMoods).length > 0) {
            const topMood = Object.entries(patterns.commonMoods)
                .sort(([,a], [,b]) => b - a)[0];
            insights.push(`You're most productive when feeling <strong>${topMood[0]}</strong> ${getMoodEmoji(topMood[0])}`);
        }
        
        // Top energy sources
        if (Object.keys(patterns.energySources).length > 0) {
            const topSources = Object.entries(patterns.energySources)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([source]) => source);
            
            if (topSources.length > 0) {
                insights.push(`Your top energy boosters: <strong>${topSources.join(', ')}</strong>`);
            }
        }
        
        if (insights.length === 0) {
            return '<div class="insights-placeholder">Complete more energy check-ins to see personalized insights!</div>';
        }
        
        return `
            <div class="productivity-insights">
                <h4><i class="fas fa-lightbulb"></i> Productivity Insights</h4>
                <ul>
                    ${insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    function createAnalyticsCharts(data) {
        createTimeOfDayChart(data);
        createWeeklyTrendChart(data);
    }

    function createTimeOfDayChart(data) {
        const chartContainer = document.getElementById('energy-chart');
        if (!chartContainer) return;
        
        // Clear existing chart
        if (window.energyChart) {
            window.energyChart.destroy();
        }
        
        // Group data by hour
        const hourlyData = Array(24).fill(0).map(() => ({ total: 0, count: 0 }));
        
        data.forEach(entry => {
            const date = new Date(entry.timestamp);
            const hour = date.getHours();
            const energy = entry.overall_energy || entry.energy_level || 5;
            
            hourlyData[hour].total += energy;
            hourlyData[hour].count += 1;
        });
        
        // Calculate averages
        const chartData = hourlyData.map((data, hour) => ({
            x: hour,
            y: data.count > 0 ? data.total / data.count : null
        })).filter(point => point.y !== null);
        
        if (chartData.length === 0) {
            chartContainer.innerHTML = '<div class="empty-chart">No data available for time analysis</div>';
            return;
        }
        
        const ctx = chartContainer.getContext('2d');
        window.energyChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Average Energy by Hour',
                    data: chartData,
                    borderColor: '#4facfe',
                    backgroundColor: 'rgba(79, 172, 254, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: 23,
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        },
                        ticks: {
                            callback: function(value) {
                                return value + ':00';
                            }
                        }
                    },
                    y: {
                        min: 1,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Average Energy Level'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Your Energy Levels Throughout the Day',
                        font: { size: 16 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const hour = context.parsed.x;
                                const energy = context.parsed.y.toFixed(1);
                                return `${hour}:00 - Energy: ${energy}/10`;
                            }
                        }
                    }
                }
            }
        });
    }

    function createWeeklyTrendChart(data) {
        // This would create an additional chart showing weekly trends
        // Implementation could be added based on available space in the UI
    }

    function displayNoDataAnalytics() {
        const container = document.getElementById('energy-insights-display');
        if (!container) return;
        
        container.innerHTML = `
            <div class="no-analytics">
                <i class="fas fa-chart-line fa-3x"></i>
                <h3>Start Building Your Analytics</h3>
                <p>Complete a few energy check-ins and timer sessions to see your personalized productivity insights!</p>
                <div class="analytics-tips">
                    <h4>Tips to get started:</h4>
                    <ul>
                        <li>Use the "Add Energy Insight" button before work sessions</li>
                        <li>Track your energy when starting timers</li>
                        <li>Complete sessions over different days and times</li>
                        <li>Be honest about your energy and mood levels</li>
                    </ul>
                </div>
            </div>
        `;
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

    // Simple notification function to show status messages to users
    function showNotification(message, type = 'info') {
        // Create notification container if it doesn't exist
        let notificationArea = document.getElementById('notification-area');
        if (!notificationArea) {
            notificationArea = document.createElement('div');
            notificationArea.id = 'notification-area';
            notificationArea.style.position = 'fixed';
            notificationArea.style.bottom = '10px';
            notificationArea.style.right = '10px';
            notificationArea.style.zIndex = '9999';
            document.body.appendChild(notificationArea);
        }
        
        // Create the notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.padding = '10px 15px';
        notification.style.marginBottom = '10px';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        notification.style.transition = 'all 0.3s ease';
        
        // Style based on type
        if (type === 'error') {
            notification.style.backgroundColor = '#ff5252';
            notification.style.color = 'white';
        } else if (type === 'success') {
            notification.style.backgroundColor = '#4CAF50';
            notification.style.color = 'white';
        } else {
            notification.style.backgroundColor = '#2196F3';
            notification.style.color = 'white';
        }
        
        notification.textContent = message;
        
        // Add to page
        notificationArea.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }

    // Function to check timer status when page loads
    function checkTimerStatus() {
        document.querySelectorAll('.timer-item').forEach(timer => {
            const timerId = timer.getAttribute('data-timer-id');
            const isRunning = timer.getAttribute('data-running') === '1';
            const duration = parseInt(timer.getAttribute('data-duration'));
            const startTime = timer.getAttribute('data-start-time');
            const endTime = timer.getAttribute('data-end-time');
            
            // Check if this timer has an end time (which would mean it's stopped)
            const hasEndTimeDisplay = timer.querySelector('p i.fa-stop') !== null;
            const hasEndTimeAttr = endTime && endTime.trim() !== '';
            
            // If the timer has an end time, it should never be running
            if (hasEndTimeAttr || hasEndTimeDisplay) {
                console.log(`Timer ${timerId} has an end time, ensuring it stays stopped`);
                
                // Update data-running attribute to ensure consistency
                timer.setAttribute('data-running', '0');
                
                // Update UI to show timer is stopped
                timer.classList.remove('timer-running');
                timer.classList.add('timer-stopped');
                
                // Hide pause/resume buttons, show start button
                const startBtn = timer.querySelector('.start-timer-btn');
                const pauseBtn = timer.querySelector('.pause-timer-btn');
                const resumeBtn = timer.querySelector('.resume-timer-btn');
                const stopBtn = timer.querySelector('.stop-timer-btn');
                
                if (startBtn) startBtn.style.display = 'inline-flex';
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resumeBtn) resumeBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'none';
                
                // Clear any running intervals for this timer
                if (activeTimers[timerId]) {
                    clearInterval(activeTimers[timerId]);
                    delete activeTimers[timerId];
                }
                
                return; // Skip the rest of the processing for this timer
            }
            
            // Only process timers that are explicitly marked as running and have a start time
            if (isRunning && startTime && !hasEndTimeDisplay) {
                try {
                    // Convert to timestamp - make sure to handle the date format properly
                    let startTimestamp;
                    try {
                        // First try with Z (UTC)
                        startTimestamp = new Date(startTime.replace(' ', 'T') + 'Z').getTime();
                    } catch (e) {
                        // If that fails, try without Z
                        startTimestamp = new Date(startTime.replace(' ', 'T')).getTime();
                    }
                    
                    const durationMs = duration * 60 * 1000; // Convert minutes to milliseconds
                    const currentTime = Date.now();
                    
                    // Calculate remaining time
                    const elapsedTime = currentTime - startTimestamp;
                    const remainingTime = Math.max(0, durationMs - elapsedTime);
                    
                    if (remainingTime > 0) {
                        // Timer should still be running
                        console.log(`Resuming timer ${timerId} with ${Math.floor(remainingTime/1000)} seconds remaining`);
                        
                        // Set up UI
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
                        const endTimeMs = Date.now() + remainingTime;
                        
                        // Clear any existing intervals for this timer
                        if (activeTimers[timerId]) {
                            clearInterval(activeTimers[timerId]);
                        }
                        
                        activeTimers[timerId] = setInterval(() => {
                            updateCountdown(countdownEl, endTimeMs, timerId);
                        }, 1000);
                        
                        // Update countdown immediately
                        updateCountdown(countdownEl, endTimeMs, timerId);
                        
                        // Update the UI buttons
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
                    } else {
                        // Timer has expired, mark it as stopped on the server
                        console.log(`Timer ${timerId} has expired, stopping it`);
                        fetch(`/update_timer/${timerId}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ action: 'stop' })
                        })
                        .then(() => {
                            // Update UI to reflect stopped status
                            timer.setAttribute('data-running', '0');
                            timer.classList.remove('timer-running');
                            timer.classList.add('timer-stopped');
                            
                            // Update button visibility
                            const startBtn = timer.querySelector('.start-timer-btn');
                            const pauseBtn = timer.querySelector('.pause-timer-btn');
                            const stopBtn = timer.querySelector('.stop-timer-btn');
                            
                            if (startBtn) startBtn.style.display = 'inline-flex';
                            if (pauseBtn) pauseBtn.style.display = 'none';
                            if (stopBtn) stopBtn.style.display = 'none';
                            
                            // Clear interval if it exists
                            if (activeTimers[timerId]) {
                                clearInterval(activeTimers[timerId]);
                                delete activeTimers[timerId];
                            }
                        });
                    }
                } catch (error) {
                    console.error(`Error initializing timer ${timerId}:`, error);
                }
            }
        });
    }

    // Check timer status when page loads
    setTimeout(checkTimerStatus, 500); // Small delay to ensure DOM is fully loaded
    
    // Initialize energy insights functionality
    initializeEnergyInsights();
    loadEnergyInsights();
});

// Timer Dropdown Functions (Global scope for onclick handlers)

/*
 * DROPDOWN FUNCTIONALITY DISABLED - Timer dropdown buttons removed
 *
 * Toggle the timer dropdown menu
 * @param {string} timerId - The ID of the timer
 */
/*
function toggleTimerDropdown(timerId) {
    const dropdown = document.getElementById(`timer-dropdown-${timerId}`);
    if (!dropdown) return;
    
    // Close all other dropdowns first
    document.querySelectorAll('.timer-dropdown-content').forEach(otherDropdown => {
        if (otherDropdown.id !== `timer-dropdown-${timerId}`) {
            otherDropdown.classList.remove('show');
        }
    });
    
    // Toggle the current dropdown
    dropdown.classList.toggle('show');
    
    // If dropdown is now open, set up click-outside-to-close behavior
    if (dropdown.classList.contains('show')) {
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 0);
    } else {
        document.removeEventListener('click', handleClickOutside);
    }
}
*/

/*
 * Handle clicking outside of dropdown to close it
 * @param {Event} event - The click event
 */
/*
function handleClickOutside(event) {
    // Check if the click is outside any dropdown
    if (!event.target.closest('.timer-options-dropdown')) {
        // Close all dropdowns
        document.querySelectorAll('.timer-dropdown-content').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.removeEventListener('click', handleClickOutside);
    }
}
*/

/*
 * Edit timer function (placeholder for future implementation)
 * @param {string} timerId - The ID of the timer to edit
 */
/*
function editTimer(timerId) {
    // Close the dropdown
    const dropdown = document.getElementById(`timer-dropdown-${timerId}`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    // For now, show an alert indicating this feature is coming soon
    alert(`Edit Timer functionality for timer ${timerId} is coming soon!`);
    
    // TODO: Implement edit timer functionality
    // This could involve:
    // 1. Opening a modal with the timer's current settings
    // 2. Allowing the user to modify name, duration, and other settings
    // 3. Sending an update request to the server
    // 4. Refreshing the timer display with new settings
}
*/

/**
 * Delete timer with confirmation
 * @param {string} timerId - The ID of the timer to delete
 */
function deleteTimer(timerId) {
    // Close the dropdown (DISABLED - dropdown functionality removed)
    /*
    const dropdown = document.getElementById(`timer-dropdown-${timerId}`);
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    */
    
    // Get timer name for better confirmation message
    const timerElement = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
    const timerName = timerElement ? timerElement.querySelector('h3').textContent : `Timer ${timerId}`;
    
    // Show confirmation dialog
    if (confirm(`Are you sure you want to delete "${timerName}"? This action cannot be undone.`)) {
        // Check if timer is currently running
        if (timerElement && timerElement.classList.contains('timer-running')) {
            if (!confirm('This timer is currently running. Deleting it will stop the timer. Continue?')) {
                return;
            }
        }
        
        // Show loading state
        if (timerElement) {
            timerElement.style.opacity = '0.5';
            timerElement.style.pointerEvents = 'none';
        }
        
        // Send delete request
        fetch(`/delete_timer/${timerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (response.ok) {
                // Check if response is a redirect (for form-based deletion)
                if (response.redirected) {
                    window.location.reload();
                    return;
                }
                return response.json();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        })
        .then(data => {
            if (data && data.success) {
                // Remove timer from DOM with animation
                if (timerElement) {
                    timerElement.style.transition = 'all 0.3s ease';
                    timerElement.style.transform = 'translateX(-100%)';
                    timerElement.style.opacity = '0';
                    
                    setTimeout(() => {
                        timerElement.remove();
                        
                        // Check if timer list is now empty
                        const timerList = document.querySelector('.timer-list');
                        if (timerList && timerList.children.length === 0) {
                            timerList.innerHTML = `
                                <div class="empty-state">
                                    <i class="fas fa-clock"></i>
                                    <h3>No timers yet</h3>
                                    <p>Create your first timer to get started with managing your focus sessions.</p>
                                </div>
                            `;
                        }
                    }, 300);
                }
                
                // Show success message
                showNotification('Timer deleted successfully', 'success');
                
                // Clean up any active intervals for this timer
                if (window.activeTimers && window.activeTimers[timerId]) {
                    clearInterval(window.activeTimers[timerId]);
                    delete window.activeTimers[timerId];
                }
            } else {
                throw new Error(data ? data.error : 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error deleting timer:', error);
            
            // Restore timer element
            if (timerElement) {
                timerElement.style.opacity = '1';
                timerElement.style.pointerEvents = 'auto';
            }
            
            // Show error message
            showNotification(`Failed to delete timer: ${error.message}`, 'error');
        });
    }
}

/**
 * Show notification message to user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('success', 'error', 'info')
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        transform: translateX(100%);
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }
    
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Allow manual dismissal by clicking
    notification.addEventListener('click', () => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}

// Initialize dropdown functionality when DOM is loaded (DISABLED - dropdown functionality removed)
/*
document.addEventListener('DOMContentLoaded', function() {
    // Add keyboard support for dropdowns
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            // Close all dropdowns on Escape key
            document.querySelectorAll('.timer-dropdown-content').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
            document.removeEventListener('click', handleClickOutside);
        }
    });
});
*/

// Make functions available globally for onclick handlers (DISABLED - dropdown functionality removed)
/*
window.toggleTimerDropdown = toggleTimerDropdown;
window.editTimer = editTimer;
*/
window.deleteTimer = deleteTimer; // Keep delete function available
