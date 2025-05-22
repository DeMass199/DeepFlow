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
});
