function startTimer(timerId) {
    console.log(`Attempting to start timer with ID: ${timerId}`);

    // Make a request to the backend to start the timer
    fetch(`/start_timer/${timerId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Include any necessary headers, like CSRF tokens if required
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`Timer ${timerId} started successfully on the server.`);
            // Reload the page to update the timer's state and start the countdown
            window.location.reload();
        } else {
            console.error(`Failed to start timer ${timerId}:`, data.error);
            alert(`Could not start the timer: ${data.error}`);
        }
    })
    .catch(error => {
        console.error(`Error starting timer ${timerId}:`, error);
        alert('An error occurred while starting the timer.');
    });
}

function pauseTimer(timerId) {
    fetch(`/pause_timer/${timerId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Stop the countdown and update UI to show paused state
            if (window.timerCountdowns && window.timerCountdowns[timerId]) {
                clearInterval(window.timerCountdowns[timerId]);
                delete window.timerCountdowns[timerId];
            }
            
            // Update timer UI to show paused state
            updateTimerUI(timerId, 'paused');
            
            // Get the current timer state from backend to show accurate remaining time
            refreshTimerState(timerId);
        } else {
            alert(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        console.error(`Error pausing timer ${timerId}:`, error);
        alert('An error occurred while pausing the timer.');
    });
}

function resumeTimer(timerId) {
    fetch(`/resume_timer/${timerId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update timer UI to show running state
            updateTimerUI(timerId, 'running');
            
            // Get the current timer state from backend and start countdown with accurate remaining time
            refreshTimerState(timerId);
        } else {
            alert(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        console.error(`Error resuming timer ${timerId}:`, error);
        alert('An error occurred while resuming the timer.');
    });
}

function stopTimer(timerId) {
    fetch(`/stop_timer/${timerId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.reload();
        } else {
            alert(`Error: ${data.error}`);
        }
    });
}

/**
 * Update the timer UI to reflect the current state
 * @param {string} timerId - ID of the timer
 * @param {string} state - Current state ('running', 'paused', or 'stopped')
 */
function updateTimerUI(timerId, state) {
    const timerItem = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
    if (!timerItem) return;
    
    // Update data attributes
    if (state === 'running') {
        timerItem.setAttribute('data-running', '1');
        timerItem.className = timerItem.className.replace(/(timer-running|timer-paused|timer-stopped)/g, '').trim() + ' timer-running';
    } else if (state === 'paused') {
        timerItem.setAttribute('data-running', '2');
        timerItem.className = timerItem.className.replace(/(timer-running|timer-paused|timer-stopped)/g, '').trim() + ' timer-paused';
    } else {
        timerItem.setAttribute('data-running', '0');
        timerItem.className = timerItem.className.replace(/(timer-running|timer-paused|timer-stopped)/g, '').trim() + ' timer-stopped';
    }
    
    // Update button visibility
    const startBtn = timerItem.querySelector('.start-timer-btn');
    const pauseBtn = timerItem.querySelector('.pause-timer-btn');
    const resumeBtn = timerItem.querySelector('.resume-timer-btn');
    const stopBtn = timerItem.querySelector('.stop-timer-btn');
    
    if (state === 'running') {
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-block';
    } else if (state === 'paused') {
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'inline-block';
        if (stopBtn) stopBtn.style.display = 'inline-block';
    } else {
        if (startBtn) startBtn.style.display = 'inline-block';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

/**
 * Refresh timer state from backend and update display
 * @param {string} timerId - ID of the timer
 */
function refreshTimerState(timerId) {
    fetch(`/get_timer_state/${timerId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.timer) {
                const countdownEl = document.querySelector(`#countdown-${timerId} .time-display`);
                if (!countdownEl) return;
                
                if (data.timer.is_running === 1) {
                    // Timer is running - start countdown with remaining time
                    if (window.startCountdownFromRemaining) {
                        window.startCountdownFromRemaining(timerId, data.timer.remaining_time);
                    }
                } else {
                    // Timer is paused - show remaining time without countdown
                    if (window.displayRemainingTime) {
                        window.displayRemainingTime(countdownEl, data.timer.remaining_time);
                    }
                }
            } else {
                console.error(`Failed to refresh timer state for timer ${timerId}:`, data.error);
            }
        })
        .catch(error => {
            console.error(`Error refreshing timer state for timer ${timerId}:`, error);
        });
}
