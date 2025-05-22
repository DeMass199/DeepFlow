/**
 * Timer Display Helper
 * This script provides additional functions to help display timers accurately
 */

// Function to format time remaining in a readable format
function formatTimeRemaining(remainingSeconds) {
    if (remainingSeconds <= 0) {
        return "00:00:00";
    }
    
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Calculate remaining time for a paused timer
function calculatePausedTimeRemaining(startTimeStr, pausedAtStr, durationSeconds) {
    try {
        const startTime = new Date(startTimeStr.replace(' ', 'T'));
        const pausedAt = new Date(pausedAtStr.replace(' ', 'T'));
        
        if (isNaN(startTime.getTime()) || isNaN(pausedAt.getTime())) {
            console.error('Invalid date format for time calculation');
            return null;
        }
        
        const elapsedSeconds = Math.floor((pausedAt - startTime) / 1000);
        const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
        
        return {
            elapsedSeconds,
            remainingSeconds,
            formattedTime: formatTimeRemaining(remainingSeconds)
        };
    } catch (error) {
        console.error('Error calculating paused time remaining:', error);
        return null;
    }
}

// Function to debug paused timer display
function debugPausedTimer(timerId) {
    const timerElement = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
    if (!timerElement) {
        console.error(`Timer with ID ${timerId} not found`);
        return;
    }
    
    const countdownEl = timerElement.querySelector('.timer-countdown');
    if (!countdownEl) {
        console.error(`Countdown element for timer ${timerId} not found`);
        return;
    }
    
    const startTime = countdownEl.getAttribute('data-started');
    const pausedAt = countdownEl.getAttribute('data-paused');
    const duration = parseInt(countdownEl.getAttribute('data-duration') || '0', 10);
    
    console.log('Timer Debug Info:');
    console.log('- Timer ID:', timerId);
    console.log('- Start Time:', startTime);
    console.log('- Paused At:', pausedAt);
    console.log('- Duration (seconds):', duration);
    
    if (startTime && pausedAt && duration) {
        const timeInfo = calculatePausedTimeRemaining(startTime, pausedAt, duration);
        console.log('- Calculated Time Info:', timeInfo);
        
        if (timeInfo) {
            console.log('- Elapsed Seconds:', timeInfo.elapsedSeconds);
            console.log('- Remaining Seconds:', timeInfo.remainingSeconds);
            console.log('- Formatted Time:', timeInfo.formattedTime);
        }
    } else {
        console.error('Missing required attributes for time calculation');
    }
}

// Add to window object for console access
window.formatTimeRemaining = formatTimeRemaining;
window.calculatePausedTimeRemaining = calculatePausedTimeRemaining;
window.debugPausedTimer = debugPausedTimer;

// When the document is ready, attach this script to all timers
document.addEventListener('DOMContentLoaded', function() {
    console.log('Timer Display Helper loaded');
    
    // Add debug button to each timer
    document.querySelectorAll('.timer-item').forEach(function(timer) {
        const timerId = timer.getAttribute('data-timer-id');
        if (!timerId) return;
        
        // Add a hidden debug function to each timer
        timer.debugTimer = function() {
            debugPausedTimer(timerId);
        };
    });
});
