document.addEventListener('DOMContentLoaded', function () {
    console.log('deepflow.js loaded and DOM fully parsed');

    const energyCheckinModal = document.getElementById('energyCheckinModal');
    const closeButton = document.querySelector('.close-button');
    const energySlider = document.getElementById('energySlider');
    const energyValue = document.getElementById('energyValue');
    const submitEnergyButton = document.getElementById('submitEnergy');

    if (energySlider && energyValue) {
        energySlider.oninput = function() {
            energyValue.textContent = this.value;
        };
    }

    if (closeButton) {
        closeButton.onclick = function() {
            energyCheckinModal.style.display = 'none';
        };
    }

    window.onclick = function(event) {
        if (event.target == energyCheckinModal) {
            energyCheckinModal.style.display = 'none';
        }
    };

    window.showEnergyCheckinModal = function(timerId, stage) {
        // First check if rate limit has been reached
        if (window.energyCheckinRateLimit && !window.energyCheckinRateLimit.isAllowed) {
            console.log('Energy check-in blocked: Daily rate limit reached, skipping to timer action');
            
            // Perform the timer action directly without energy check-in
            // No need for intrusive alert since this is expected behavior
            if (stage === 'start') {
                startTimerDirectly(timerId);
            } else if (stage === 'end') {
                stopTimerDirectly(timerId);
            }
            return;
        }
        
        // Check user preferences before showing modal
        checkUserPreferences().then(prefs => {
            let shouldShow = false;
            
            if (stage === 'start' && prefs.enable_start_checkin) {
                shouldShow = true;
            } else if (stage === 'mid' && prefs.enable_mid_checkin) {
                shouldShow = true;
            } else if (stage === 'end' && prefs.enable_end_checkin) {
                shouldShow = true;
            }
            
            if (shouldShow && energyCheckinModal) {
                energyCheckinModal.style.display = 'block';
                energyCheckinModal.dataset.timerId = timerId;
                energyCheckinModal.dataset.stage = stage;
            } else if (!shouldShow) {
                // If check-in is disabled, perform the timer action directly
                if (stage === 'start') {
                    startTimerDirectly(timerId);
                } else if (stage === 'end') {
                    stopTimerDirectly(timerId);
                }
            } else {
                console.error('Energy check-in modal not found!');
            }
        }).catch(error => {
            console.error('Error checking user preferences:', error);
            // Fallback to showing modal if preferences check fails
            if (energyCheckinModal) {
                energyCheckinModal.style.display = 'block';
                energyCheckinModal.dataset.timerId = timerId;
                energyCheckinModal.dataset.stage = stage;
            }
        });
    };

    if (submitEnergyButton) {
        submitEnergyButton.onclick = function() {
            const energyLevel = energySlider.value;
            const timerId = energyCheckinModal.dataset.timerId;
            const stage = energyCheckinModal.dataset.stage;

            if (!timerId || !stage) {
                console.error('No timerId or stage stored in modal dataset.');
                energyCheckinModal.style.display = 'none';
                return;
            }

            energyCheckinModal.style.display = 'none';

            fetch('/log_energy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ energy_level: energyLevel, timer_id: timerId, stage: stage }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.reload();
                } else {
                    alert(`Error: ${data.error}`);
                }
            });
        };
    }

    document.querySelectorAll('.start-timer-btn').forEach(button => {
        button.addEventListener('click', function() {
            const timerId = this.dataset.timerId;
            
            // Always check for start check-in preferences (not general energy logging)
            showEnergyCheckinModal(timerId, 'start');
        });
    });

    document.querySelectorAll('.stop-timer-btn').forEach(button => {
        button.addEventListener('click', function() {
            const timerId = this.dataset.timerId;
            
            // Always check for end check-in preferences (not general energy logging)
            showEnergyCheckinModal(timerId, 'end');
        });
    });

    document.querySelectorAll('.pause-timer-btn').forEach(button => {
        button.addEventListener('click', function() {
            const timerId = this.dataset.timerId;
            pauseTimer(timerId);
        });
    });

    document.querySelectorAll('.resume-timer-btn').forEach(button => {
        button.addEventListener('click', function() {
            const timerId = this.dataset.timerId;
            resumeTimer(timerId);
        });
    });

    // Flow Shelf functionality
    initializeFlowShelf();
});

// Functions to start/stop timers directly without energy check-in
function startTimerDirectly(timerId) {
    fetch(`/start_timer/${timerId}`, {
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
            alert(`Error starting timer: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error starting timer:', error);
        alert('Failed to start timer. Please try again.');
    });
}

function stopTimerDirectly(timerId) {
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
            alert(`Error stopping timer: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error stopping timer:', error);
        alert('Failed to stop timer. Please try again.');
    });
}

// Function to check user preferences from backend
function checkUserPreferences() {
    return fetch('/get_user_preferences')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Store preferences globally for other functions to use
                window.userPreferences = data.preferences;
                return data.preferences;
            } else {
                throw new Error('Failed to get user preferences');
            }
        })
        .catch(error => {
            console.error('Error fetching user preferences:', error);
            // Return default preferences if fetch fails
            const defaults = {
                enable_start_checkin: true,
                enable_mid_checkin: true,
                enable_end_checkin: true,
                enable_energy_log: true,
                enable_sound: false
            };
            window.userPreferences = defaults;
            return defaults;
        });
}

// Flow Shelf Functions
function initializeFlowShelf() {
    console.log('Initializing Flow Shelf...');
    
    // Load existing items
    loadFlowShelfItems();
    
    // Add event listener for the Add button
    const addButton = document.getElementById('add-to-shelf');
    const textInput = document.getElementById('flow-shelf-text');
    
    if (addButton && textInput) {
        addButton.addEventListener('click', function() {
            const text = textInput.value.trim();
            if (text) {
                addFlowShelfItem(text);
            }
        });
        
        // Allow Enter key to add items
        textInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const text = textInput.value.trim();
                if (text) {
                    addFlowShelfItem(text);
                }
            }
        });
    }
}

function loadFlowShelfItems() {
    fetch('/get_shelf_items')
        .then(response => response.json())
        .then(data => {
            if (data.items) {
                displayFlowShelfItems(data.items);
            }
        })
        .catch(error => {
            console.error('Error loading flow shelf items:', error);
        });
}

function addFlowShelfItem(text) {
    fetch('/add_shelf_item', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Clear the input
            document.getElementById('flow-shelf-text').value = '';
            // Reload the items
            loadFlowShelfItems();
        } else {
            alert(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error adding flow shelf item:', error);
        alert('Failed to add item to Flow Shelf');
    });
}

function removeFlowShelfItem(itemId) {
    fetch('/remove_shelf_item', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: itemId }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload the items
            loadFlowShelfItems();
        } else {
            alert(`Error: ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Error removing flow shelf item:', error);
        alert('Failed to remove item from Flow Shelf');
    });
}

function displayFlowShelfItems(items) {
    const container = document.getElementById('flow-shelf-items');
    const emptyState = document.getElementById('empty-shelf');
    
    if (!container) return;
    
    // Clear existing items (except empty state)
    const existingItems = container.querySelectorAll('.flow-shelf-item');
    existingItems.forEach(item => item.remove());
    
    if (items.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    } else {
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        items.forEach(item => {
            const itemElement = createFlowShelfItemElement(item);
            container.appendChild(itemElement);
        });
    }
}

function createFlowShelfItemElement(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flow-shelf-item';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'flow-shelf-item-text';
    textDiv.textContent = item.text;
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'flow-shelf-item-controls';
    
    const removeButton = document.createElement('button');
    removeButton.className = 'btn btn-delete';
    removeButton.innerHTML = '<i class="fas fa-trash"></i>';
    removeButton.title = 'Remove item';
    removeButton.onclick = () => removeFlowShelfItem(item.id);
    
    controlsDiv.appendChild(removeButton);
    itemDiv.appendChild(textDiv);
    itemDiv.appendChild(controlsDiv);
    
    return itemDiv;
}
