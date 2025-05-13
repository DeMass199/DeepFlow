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
        
        if (logs.length === 0) {
            // No logs yet, show placeholder
            const container = document.getElementById('energy-chart-container');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <p>No energy data yet. Start tracking when you use timers.</p>
                </div>
            `;
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
});
