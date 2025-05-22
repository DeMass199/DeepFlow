// This file contains test functions to help diagnose timer functionality issues
// It's loaded in the dashboard to provide debug capabilities

function testTimerFunctionality() {
    console.log("Testing timer functionality...");
    
    // Test 1: Check if the duration dropdown is properly initialized
    const dropdown = document.getElementById('duration-dropdown');
    const durationInput = document.getElementById('duration');
    
    console.log("Test 1: Duration dropdown");
    console.log(`- Dropdown exists: ${!!dropdown}`);
    console.log(`- Dropdown options count: ${dropdown ? dropdown.options.length : 0}`);
    console.log(`- Current dropdown value: ${dropdown ? dropdown.value : 'N/A'}`);
    console.log(`- Hidden duration input value: ${durationInput ? durationInput.value : 'N/A'}`);
    
    // Test 2: Check if timer display functionality works
    console.log("\nTest 2: Timer display functions");
    const runningTimers = document.querySelectorAll('.timer-running');
    console.log(`- Running timers found: ${runningTimers.length}`);
    
    runningTimers.forEach((timer, index) => {
        const timerId = timer.dataset.timerId;
        const duration = timer.dataset.duration;
        const startTime = timer.dataset.startTime;
        console.log(`\n- Timer #${index + 1} (ID: ${timerId}):`);
        console.log(`  Duration: ${duration} seconds`);
        console.log(`  Start time: ${startTime}`);
        
        // Check if countdown element exists
        const countdownElement = document.querySelector(`#countdown-${timerId} .time-display`);
        console.log(`  Countdown element exists: ${!!countdownElement}`);
        console.log(`  Current display: ${countdownElement ? countdownElement.textContent : 'N/A'}`);
    });
    
    // Test 3: Test timer controls
    console.log("\nTest 3: Timer controls");
    const startButtons = document.querySelectorAll('.start-timer-btn');
    const pauseButtons = document.querySelectorAll('.pause-timer-btn');
    const stopButtons = document.querySelectorAll('.stop-timer-btn');
    
    console.log(`- Start buttons: ${startButtons.length}`);
    console.log(`- Pause buttons: ${pauseButtons.length}`);
    console.log(`- Stop buttons: ${stopButtons.length}`);
    
    // Debug test function to verify pause button is working correctly
    console.log('=== Testing Timer Functionality ===');
    
    // Find a timer to test on
    const timers = document.querySelectorAll('.timer-item');
    if (timers.length === 0) {
        alert('No timers found to test. Please create a timer first.');
        return;
    }
    
    const timer = timers[0]; // Use the first timer for testing
    const timerId = timer.getAttribute('data-timer-id');
    const startBtn = timer.querySelector('.start-timer-btn');
    const pauseBtn = timer.querySelector('.pause-timer-btn');
    const resumeBtn = timer.querySelector('.resume-timer-btn');
    const stopBtn = timer.querySelector('.stop-timer-btn');
    const countdownEl = timer.querySelector('.timer-countdown');
    
    console.log(`Testing timer ${timerId}`);
    console.log('- Timer state classes:', Array.from(timer.classList));
    console.log('- Timer data-running attribute:', timer.getAttribute('data-running'));
    console.log('- Start button exists:', !!startBtn);
    console.log('- Pause button exists:', !!pauseBtn);
    console.log('- Resume button exists:', !!resumeBtn);
    console.log('- Stop button exists:', !!stopBtn);
    console.log('- Countdown element exists:', !!countdownEl);
    
    if (countdownEl) {
        console.log('- Countdown element content:', countdownEl.textContent);
    }
    
    if (pauseBtn) {
        console.log('- Pause button display style:', pauseBtn.style.display);
        console.log('- Pause button data-timer-id:', pauseBtn.getAttribute('data-timer-id'));
        console.log('- Pause button dataset.timerId:', pauseBtn.dataset.timerId);
        
        console.log('- Testing if updateTimer function exists:', typeof updateTimer === 'function');
        if (typeof updateTimer === 'function') {
            console.log('- updateTimer function is properly defined');
        }
    }
    
    if (window.activeTimers) {
        console.log('- Active timers:', Object.keys(window.activeTimers).length);
        if (window.activeTimers[timerId]) {
            console.log('- This timer has an active interval');
        } else {
            console.log('- This timer does not have an active interval');
        }
    } else {
        console.log('- activeTimers object not found in window scope');
    }
    
    console.log('=== Timer Testing Complete ===');
    alert('Timer debugging complete. Check the console for results.');
    
    // Display results in a more user-friendly way
    showTestResults();
}

function showTestResults() {
    // Create a modal to display test results
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = '#fff';
    modal.style.padding = '20px';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    modal.style.maxWidth = '80%';
    modal.style.maxHeight = '80%';
    modal.style.overflow = 'auto';
    modal.style.zIndex = '1000';
    
    const title = document.createElement('h3');
    title.textContent = 'Timer Functionality Test Results';
    title.style.marginTop = '0';
    title.style.color = '#4f46e5';
    
    const content = document.createElement('pre');
    content.style.backgroundColor = '#f9fafb';
    content.style.padding = '10px';
    content.style.borderRadius = '4px';
    content.style.overflowX = 'auto';
    content.style.fontSize = '14px';
    content.style.color = '#111827';
    
    // Extract console logs
    const logs = [];
    const originalConsoleLog = console.log;
    console.log = function() {
        logs.push(Array.from(arguments).join(' '));
        originalConsoleLog.apply(console, arguments);
    };
    
    // Re-run the tests to capture logs
    testTimerFunctionality();
    
    // Restore original console.log
    console.log = originalConsoleLog;
    
    // Display logs
    content.textContent = logs.join('\n');
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.marginTop = '15px';
    closeButton.style.padding = '8px 16px';
    closeButton.style.backgroundColor = '#4f46e5';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '4px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = function() {
        document.body.removeChild(modal);
        document.body.removeChild(overlay);
    };
    
    modal.appendChild(title);
    modal.appendChild(content);
    modal.appendChild(closeButton);
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '999';
    
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}
