/**
 * Toggle Button Functionality for DeepFlow Timer Buttons
 * 
 * This script adds enhanced toggle functionality between start/pause/resume buttons
 * to create a more streamlined user experience.
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Timer Toggle JS loaded!'); // Debug log
    
    // Initialize the toggle functionality for all timers
    initializeTimerToggles();
    
    /**
     * Initialize toggle functionality for all timer buttons
     */
    function initializeTimerToggles() {
        const timerItems = document.querySelectorAll('.timer-item');
        console.log(`Found ${timerItems.length} timer items to enhance`); // Debug log
        
        // Enhance all existing timer controls
        timerItems.forEach(timerItem => {
            enhanceTimerControls(timerItem);
        });
        
        // Add click handlers to start buttons
        document.querySelectorAll('.start-timer-btn').forEach(button => {
            button.addEventListener('click', function() {
                const timerId = this.getAttribute('data-timer-id');
                console.log(`Start button clicked for timer ${timerId}`);
                
                // Find all buttons in this timer's controls
                const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
                
                if (timer) {
                    const startBtn = timer.querySelector('.start-timer-btn');
                    const pauseBtn = timer.querySelector('.pause-timer-btn');
                    
                    // Toggle visibility - handled by deepflow.js but we'll ensure it
                    if (startBtn) startBtn.style.display = 'none';
                    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
                }
            });
        });

        // Add click handlers to pause buttons
        document.querySelectorAll('.pause-timer-btn').forEach(button => {
            button.addEventListener('click', function() {
                const timerId = this.getAttribute('data-timer-id');
                console.log(`Pause button clicked for timer ${timerId}`);
                
                // Find all buttons in this timer's controls
                const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
                
                if (timer) {
                    const pauseBtn = timer.querySelector('.pause-timer-btn');
                    const resumeBtn = timer.querySelector('.resume-timer-btn');
                    
                    // Toggle visibility
                    if (pauseBtn) pauseBtn.style.display = 'none';
                    if (resumeBtn) resumeBtn.style.display = 'inline-flex';
                }
            });
        });

        // Add click handlers to resume buttons
        document.querySelectorAll('.resume-timer-btn').forEach(button => {
            button.addEventListener('click', function() {
                const timerId = this.getAttribute('data-timer-id');
                console.log(`Resume button clicked for timer ${timerId}`);
                
                // Find all buttons in this timer's controls
                const timer = document.querySelector(`.timer-item[data-timer-id="${timerId}"]`);
                
                if (timer) {
                    const pauseBtn = timer.querySelector('.pause-timer-btn');
                    const resumeBtn = timer.querySelector('.resume-timer-btn');
                    
                    // Toggle visibility
                    if (pauseBtn) pauseBtn.style.display = 'inline-flex';
                    if (resumeBtn) resumeBtn.style.display = 'none';
                }
            });
        });
    }
    
    /**
     * Enhances a single timer's controls with accessibility features
     * @param {HTMLElement} timerItem - The timer container element
     */
    function enhanceTimerControls(timerItem) {
        const timerId = timerItem.getAttribute('data-timer-id');
        console.log(`Enhancing timer controls for timer ID: ${timerId}`);
        
        const startBtn = timerItem.querySelector('.start-timer-btn');
        const pauseBtn = timerItem.querySelector('.pause-timer-btn');
        const resumeBtn = timerItem.querySelector('.resume-timer-btn');
        const stopBtn = timerItem.querySelector('.stop-timer-btn');
        
        // Add aria labels for better accessibility
        if (startBtn) {
            startBtn.setAttribute('aria-label', 'Start timer');
            startBtn.setAttribute('title', 'Start timer');
        }
        if (pauseBtn) {
            pauseBtn.setAttribute('aria-label', 'Pause timer');
            pauseBtn.setAttribute('title', 'Pause timer');
        }
        if (resumeBtn) {
            resumeBtn.setAttribute('aria-label', 'Resume timer');
            resumeBtn.setAttribute('title', 'Resume timer');
            // Ensure resume button always starts hidden unless specifically shown
            if (!timerItem.classList.contains('timer-paused')) {
                resumeBtn.style.display = 'none';
            }
        }
        if (stopBtn) {
            stopBtn.setAttribute('aria-label', 'Stop timer');
            stopBtn.setAttribute('title', 'Stop timer');
        }
    }
    
    // Expose the functions globally so they can be used by the main deepflow.js
    window.timerToggle = {
        enhanceTimerControls: enhanceTimerControls,
        initializeTimerToggles: initializeTimerToggles
    };
});
