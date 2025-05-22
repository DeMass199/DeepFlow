/**
 * Timer Fix - Ensures timers are properly initialized on page load
 * This file helps manage timers properly after page reloads
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Timer Fix script loaded');

    // Wait for all other scripts to initialize
    setTimeout(function() {
        // Override the checkTimerStatus function to ensure timers don't restart
        // if they were previously stopped
        if (window.checkTimerStatus) {
            console.log('Patching checkTimerStatus function...');
            
            // Store the original function
            const originalCheckTimerStatus = window.checkTimerStatus;
            
            // Override with our fixed version
            window.checkTimerStatus = function() {
                console.log('Running enhanced checkTimerStatus...');
                
                // Fix inconsistent timer states first
                document.querySelectorAll('.timer-item').forEach(timer => {
                    const timerId = timer.getAttribute('data-timer-id');
                    const isRunning = timer.getAttribute('data-running') === '1';
                    const endTime = timer.getAttribute('data-end-time');
                    const hasEndTimeDisplay = timer.querySelector('p i.fa-stop') !== null;
                    
                    // Case 1: Timer has an end time but is marked as running
                    if ((endTime || hasEndTimeDisplay) && isRunning) {
                        console.log(`Found inconsistent timer ${timerId}: marked as running but has end time. Fixing...`);
                        timer.setAttribute('data-running', '0');
                        
                        // Update the server state
                        fetch(`/update_timer/${timerId}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ action: 'stop' })
                        });
                    }
                    
                    // Case 2: Timer is marked as not running but lacks an end time display
                    if (!isRunning && !hasEndTimeDisplay) {
                        // Check if there's an active interval
                        if (window.activeTimers && window.activeTimers[timerId]) {
                            console.log(`Clearing interval for stopped timer ${timerId}`);
                            clearInterval(window.activeTimers[timerId]);
                            delete window.activeTimers[timerId];
                        }
                        
                        // Ensure stop buttons are properly hidden
                        const stopBtn = timer.querySelector('.stop-timer-btn');
                        if (stopBtn) {
                            stopBtn.style.display = 'none';
                        }
                    }
                });
                
                // Call original function but catch any errors
                try {
                    originalCheckTimerStatus();
                } catch (err) {
                    console.error('Error in original checkTimerStatus:', err);
                }
            };
            
            // Run our enhanced version
            window.checkTimerStatus();
        } else {
            console.warn('checkTimerStatus function not found');
        }
    }, 300); // Short delay to ensure other scripts have initialized
    
    // Fix timer controls by adding direct event handlers
    fixTimerControls();
});

// Fix start, pause and stop buttons by adding our own reliable handlers
function fixTimerControls() {
    console.log('Fixing timer controls...');
    
    // Fix for timer start functionality
    document.querySelectorAll('.start-timer-btn').forEach(button => {
        // Remove existing click handlers by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our fixed event handler
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const timerId = this.getAttribute('data-timer-id');
            console.log(`Starting timer ${timerId} with fixed handler`);
            
            // Visual feedback that button was clicked
            this.classList.add('btn-loading');
            
            // Make the AJAX request to start the timer
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'start' }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log('Timer started successfully');
                    // Instead of reloading the page, call the updateTimer function if it exists
                    if (typeof updateTimer === 'function') {
                        updateTimer(timerId, 'start');
                    } else {
                        // Fallback to reload if updateTimer doesn't exist
                        window.location.reload();
                    }
                } else {
                    console.error('Error starting timer:', data.error);
                    alert('Error starting timer: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error starting timer:', error);
                alert('Failed to start timer. Please try again.');
            })
            .finally(() => {
                this.classList.remove('btn-loading');
            });
        });
    });
    
    // Fix for timer pause functionality
    document.querySelectorAll('.pause-timer-btn').forEach(button => {
        // Remove existing click handlers by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our fixed event handler
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const timerId = this.getAttribute('data-timer-id');
            console.log(`Pausing timer ${timerId} with fixed handler`);
            
            // Visual feedback that button was clicked
            this.classList.add('btn-loading');
            
            // Make the AJAX request to pause the timer
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'pause' }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log('Timer paused successfully');
                    // Instead of reloading the page, call the updateTimer function if it exists
                    if (typeof updateTimer === 'function') {
                        updateTimer(timerId, 'pause');
                    } else {
                        // Fallback to reload if updateTimer doesn't exist
                        window.location.reload();
                    }
                } else {
                    console.error('Error pausing timer:', data.error);
                    alert('Error pausing timer: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error pausing timer:', error);
                alert('Failed to pause timer. Please try again.');
            })
            .finally(() => {
                this.classList.remove('btn-loading');
            });
        });
    });
    
    // Fix for timer resume functionality
    document.querySelectorAll('.resume-timer-btn').forEach(button => {
        // Remove existing click handlers by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our fixed event handler
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const timerId = this.getAttribute('data-timer-id');
            console.log(`Resuming timer ${timerId} with fixed handler`);
            
            // Visual feedback that button was clicked
            this.classList.add('btn-loading');
            
            // Make the AJAX request to resume the timer
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'resume' }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log('Timer resumed successfully');
                    // Instead of reloading the page, call the updateTimer function if it exists
                    if (typeof updateTimer === 'function') {
                        updateTimer(timerId, 'resume');
                    } else {
                        // Fallback to reload if updateTimer doesn't exist
                        window.location.reload();
                    }
                } else {
                    console.error('Error resuming timer:', data.error);
                    alert('Error resuming timer: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error resuming timer:', error);
                alert('Failed to resume timer. Please try again.');
            })
            .finally(() => {
                this.classList.remove('btn-loading');
            });
        });
    });
    
    // Fix for timer stop functionality
    document.querySelectorAll('.stop-timer-btn').forEach(button => {
        // Remove existing click handlers by cloning the button
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Add our fixed event handler
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const timerId = this.getAttribute('data-timer-id');
            console.log(`Stopping timer ${timerId} with fixed handler`);
            
            // Visual feedback that button was clicked
            this.classList.add('btn-loading');
            
            // Make the AJAX request to stop the timer
            fetch(`/update_timer/${timerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'stop' }),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    console.log('Timer stopped successfully');
                    // Instead of reloading the page, call the updateTimer function if it exists
                    if (typeof updateTimer === 'function') {
                        updateTimer(timerId, 'stop');
                    } else {
                        // Fallback to reload if updateTimer doesn't exist
                        window.location.reload();
                    }
                } else {
                    console.error('Error stopping timer:', data.error);
                    alert('Error stopping timer: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error stopping timer:', error);
                alert('Failed to stop timer. Please try again.');
            })
            .finally(() => {
                this.classList.remove('btn-loading');
            });
        });
    });
    
    // Add button loading indicator CSS
    const style = document.createElement('style');
    style.textContent = `
        .btn-loading {
            position: relative;
            color: transparent !important;
            pointer-events: none;
        }
        
        .btn-loading:after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            top: 50%;
            left: 50%;
            margin-top: -8px;
            margin-left: -8px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Add utility function to safely add event handlers only once
function addEventListenerOnce(element, eventType, handler, options) {
    if (!element) return;
    
    // First, remove any existing handlers
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
    
    // Then, add the new handler
    newElement.addEventListener(eventType, handler, options);
    
    return newElement;
}
