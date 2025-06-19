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
            window.location.reload();
        } else {
            alert(`Error: ${data.error}`);
        }
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
            window.location.reload();
        } else {
            alert(`Error: ${data.error}`);
        }
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
