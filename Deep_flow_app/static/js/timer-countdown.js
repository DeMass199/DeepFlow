/**
 * Timer Countdown functionality
 * Manages the display and functionality of timer countdowns
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Timer countdown script loaded');
    
    // Global storage for active countdowns
    window.timerCountdowns = window.timerCountdowns || {};
    
    // Initialize all timer countdowns on page load
    initializeCountdowns();
    
    // Make functions available globally
    window.startCountdownFromRemaining = startCountdownFromRemaining;
    window.displayRemainingTime = displayRemainingTime;
    window.initializeTimer = initializeTimer;
    
    /**
     * Initialize all countdown timers on the page
     */
    function initializeCountdowns() {
        document.querySelectorAll('.timer-countdown').forEach(function(countdownEl) {
            const timerId = countdownEl.id.replace('countdown-', '');
            initializeTimer(timerId);
        });
    }
    
    /**
     * Initialize a specific timer by getting its state from the backend
     */
    function initializeTimer(timerId) {
        // Get timer state from backend for accurate elapsed time and remaining time
        fetch(`/get_timer_state/${timerId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const countdownEl = document.querySelector(`#countdown-${timerId} .time-display`);
                    if (!countdownEl) return;
                    
                    if (data.is_running === 1) {
                        // Timer is running - start countdown with remaining time
                        startCountdownFromRemaining(timerId, data.remaining_ms);
                    } else {
                        // Timer is paused or stopped - show remaining time
                        displayRemainingTime(countdownEl, data.remaining_ms);
                    }
                } else {
                    console.error(`Failed to get timer state for timer ${timerId}:`, data.error);
                }
            })
            .catch(error => {
                console.error(`Error getting timer state for timer ${timerId}:`, error);
                // Fallback to old logic if backend fails
                initializeTimerFallback(timerId);
            });
    }
    
    /**
     * Fallback initialization using old DOM-based logic
     */
    function initializeTimerFallback(timerId) {
        const countdownEl = document.querySelector(`#countdown-${timerId}`);
        if (!countdownEl) return;
        
        const timerItem = countdownEl.closest('.timer-item');
        if (!timerItem) return;
        
        const isRunning = timerItem.getAttribute('data-running');
        const duration = parseInt(countdownEl.getAttribute('data-duration') || '0', 10);
        const startTime = countdownEl.getAttribute('data-started');
        const pausedAt = countdownEl.getAttribute('data-paused');
        
        if (isRunning === '1' && startTime && duration) {
            // Timer is running - calculate remaining time and start countdown
            startCountdown(timerId, duration, startTime);
        } else if (isRunning === '2' && pausedAt) {
            // Timer is paused - show paused state with the remaining time
            const timeDisplay = countdownEl.querySelector('.time-display');
            if (timeDisplay) {
                // Calculate the elapsed time until the pause
                const startDate = new Date(startTime.replace(' ', 'T'));
                const pauseDate = new Date(pausedAt.replace(' ', 'T'));
                const elapsedSeconds = Math.floor((pauseDate - startDate) / 1000);
                const remainingSeconds = Math.max(0, duration - elapsedSeconds);
                
                displayRemainingTime(timeDisplay, remainingSeconds * 1000);
            }
        }
    }
    
    /**
     * Start countdown for a specific timer using remaining milliseconds
     * @param {string} timerId - ID of the timer
     * @param {number} remainingMs - Remaining time in milliseconds
     */
    function startCountdownFromRemaining(timerId, remainingMs) {
        // Clear any existing countdown for this timer
        if (window.timerCountdowns[timerId]) {
            clearInterval(window.timerCountdowns[timerId]);
        }
        
        const countdownEl = document.querySelector(`#countdown-${timerId} .time-display`);
        if (!countdownEl) return;
        
        // Calculate end time based on current time and remaining milliseconds
        const endTime = new Date(Date.now() + remainingMs);
        
        // Update immediately
        updateCountdownDisplay(countdownEl, endTime, timerId);
        
        // Set interval to update countdown
        window.timerCountdowns[timerId] = setInterval(function() {
            const isComplete = updateCountdownDisplay(countdownEl, endTime, timerId);
            
            // If countdown is complete, clear interval and show energy check-in
            if (isComplete) {
                clearInterval(window.timerCountdowns[timerId]);
                delete window.timerCountdowns[timerId];
                
                // Show the energy check-in modal instead of reloading
                console.log(`Timer ${timerId} finished. Showing energy check-in modal.`);
                if (window.showEnergyCheckinModal) {
                    window.showEnergyCheckinModal(timerId, 'end');
                } else {
                    console.error('showEnergyCheckinModal function not found. Reloading as a fallback.');
                    window.location.reload();
                }
            }
        }, 1000);
    }
    
    /**
     * Display remaining time without starting a countdown
     * @param {Element} timeDisplay - The time display element
     * @param {number} remainingMs - Remaining time in milliseconds
     */
    function displayRemainingTime(timeDisplay, remainingMs) {
        const remainingSeconds = Math.floor(remainingMs / 1000);
        const hours = Math.floor(remainingSeconds / 3600);
        const minutes = Math.floor((remainingSeconds % 3600) / 60);
        const seconds = remainingSeconds % 60;
        
        // Format the time display
        let timeString = '';
        if (hours > 0) {
            timeString += `${hours}:`;
        }
        timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        timeDisplay.textContent = timeString;
    }

    /**
     * Start countdown for a specific timer
     * @param {string} timerId - ID of the timer
     * @param {number} durationSeconds - Total duration in seconds
     * @param {string} startTimeStr - Start time string from the database
     */
    function startCountdown(timerId, durationSeconds, startTimeStr) {
        // Clear any existing countdown for this timer
        if (window.timerCountdowns[timerId]) {
            clearInterval(window.timerCountdowns[timerId]);
        }
        
        const countdownEl = document.querySelector(`#countdown-${timerId} .time-display`);
        if (!countdownEl) return;
        
        // Parse start time 
        const startTime = new Date(startTimeStr.replace(' ', 'T'));
        if (isNaN(startTime.getTime())) {
            console.error(`Invalid start time: ${startTimeStr}`);
            countdownEl.textContent = 'Error: Invalid start time';
            return;
        }
        
        // Calculate end time based on start time and duration
        const endTime = new Date(startTime.getTime() + (durationSeconds * 1000));
        
        // Update immediately
        updateCountdownDisplay(countdownEl, endTime, timerId);
        
        // Set interval to update countdown
        window.timerCountdowns[timerId] = setInterval(function() {
            const isComplete = updateCountdownDisplay(countdownEl, endTime, timerId);
            
            // If countdown is complete, clear interval and show energy check-in
            if (isComplete) {
                clearInterval(window.timerCountdowns[timerId]);
                delete window.timerCountdowns[timerId];
                
                // Show the energy check-in modal instead of reloading
                console.log(`Timer ${timerId} finished. Showing energy check-in modal.`);
                if (window.showEnergyCheckinModal) {
                    window.showEnergyCheckinModal(timerId, 'end');
                } else {
                    console.error('showEnergyCheckinModal function not found. Reloading as a fallback.');
                    window.location.reload();
                }
            }
        }, 1000);
    }
    
    /**
     * Update the display of a countdown timer
     * @param {Element} countdownEl - The countdown display element
     * @param {Date} endTime - The target end time
     * @param {string} [timerId] - ID of the timer (optional, will try to infer if not provided)
     * @returns {boolean} - True if countdown is complete
     */
    function updateCountdownDisplay(countdownEl, endTime, timerId) {
        const now = new Date();
        const timeLeft = endTime - now;
        
        // If timerId is not provided, try to infer it from the DOM
        if (!timerId) {
            try {
                const countdownElId = countdownEl.closest('.timer-countdown').id;
                timerId = countdownElId.replace('countdown-', '');
            } catch (e) {
                console.error('Could not determine timer ID:', e);
            }
        }
        
        if (timeLeft <= 0) {
            // Timer is complete
            countdownEl.textContent = 'Complete!';
            return true;
        }
        
        // Calculate hours, minutes, seconds
        const totalSeconds = Math.floor(timeLeft / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Format the time display in clear HH:MM:SS format
        let timeString = '';
        if (hours > 0) {
            timeString += `${hours}:`;
        }
        timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update the timer card display with just the time
        countdownEl.textContent = timeString;
        
        return false;
    }
    
    /**
     * Get the name of a timer
     * @param {string} timerId - ID of the timer
     * @returns {string} - Name of the timer, or 'Timer' if not found
     */
    function getTimerName(timerId) {
        const timerItem = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
        if (timerItem) {
            const nameElement = timerItem.querySelector('.timer-name');
            if (nameElement) {
                return nameElement.textContent;
            }
        }
        return 'Timer';
    }
    
    // Make stopTimerDirectly globally available for timer completion
    window.stopTimerDirectly = function(timerId) {
        fetch(`/stop_timer/${timerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.location.reload();
            } else {
                console.error(`Error stopping timer: ${data.error}`);
                window.location.reload(); // Fallback
            }
        })
        .catch(error => {
            console.error('Error stopping timer:', error);
            window.location.reload(); // Fallback
        });
    };
});
