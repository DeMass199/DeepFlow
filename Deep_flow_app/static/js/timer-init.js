/**
 * Timer Initialization - Ensures timers are properly initialized
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Timer Init script loaded');
    
    // Helper function to safely check if an element contains text
    function elementContainsText(element, text) {
        return element && element.textContent && element.textContent.includes(text);
    }
    
    // Function to find elements that contain specific text within a parent element
    function findElementWithText(parentElement, selector, text) {
        const elements = parentElement.querySelectorAll(selector);
        for (let i = 0; i < elements.length; i++) {
            if (elementContainsText(elements[i], text)) {
                return elements[i];
            }
        }
        return null;
    }
    
    // Function to stop any running timers that should actually be stopped
    // This helps ensure the server state is consistent
    function fixTimerInconsistencies() {
        console.log('Checking for timer inconsistencies...');
        
        document.querySelectorAll('.timer-item').forEach(timer => {
            const timerId = timer.getAttribute('data-timer-id');
            const isRunning = timer.getAttribute('data-running') === '1';
            const hasEndTimeAttr = timer.getAttribute('data-end-time');
            const hasEndTimeDisplay = findElementWithText(timer, 'p', 'Ended:');
            
            // Case 1: Timer has an end time but is marked as running
            if ((hasEndTimeAttr || hasEndTimeDisplay) && isRunning) {
                console.log(`Found inconsistent timer ${timerId}: marked as running but has end time. Fixing...`);
                
                // Update UI first
                timer.setAttribute('data-running', '0');
                timer.classList.remove('timer-running');
                timer.classList.add('timer-stopped');
                
                // Update button visibility
                const startBtn = timer.querySelector('.start-timer-btn');
                const pauseBtn = timer.querySelector('.pause-timer-btn');
                const resumeBtn = timer.querySelector('.resume-timer-btn');
                const stopBtn = timer.querySelector('.stop-timer-btn');
                
                if (startBtn) startBtn.style.display = 'inline-flex';
                if (pauseBtn) pauseBtn.style.display = 'none';
                if (resumeBtn) resumeBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'none';
                
                // Clear any intervals
                if (window.activeTimers && window.activeTimers[timerId]) {
                    clearInterval(window.activeTimers[timerId]);
                    delete window.activeTimers[timerId];
                }
                
                // Send request to server to ensure it's marked as stopped
                fetch(`/update_timer/${timerId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: 'stop' })
                })
                .then(response => response.json())
                .then(data => {
                    console.log(`Fixed timer ${timerId} state:`, data);
                })
                .catch(err => {
                    console.error(`Failed to fix timer ${timerId}:`, err);
                });
            }
            
            // Case 2: Timer is running but doesn't have a countdown display
            if (isRunning && !timer.querySelector('.timer-countdown')) {
                console.log(`Timer ${timerId} is running but missing countdown display. Adding...`);
                
                // Will be handled by checkTimerStatus, no action needed here
            }
        });
    }
    
    // Wait for all other scripts to initialize
    setTimeout(fixTimerInconsistencies, 1000);
});
});
