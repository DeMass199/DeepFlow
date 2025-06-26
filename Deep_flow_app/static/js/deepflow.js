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
        if (energyCheckinModal) {
            energyCheckinModal.style.display = 'block';
            energyCheckinModal.dataset.timerId = timerId;
            energyCheckinModal.dataset.stage = stage;
        } else {
            console.error('Energy check-in modal not found!');
        }
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
            
            // Check if energy logging is enabled before showing modal
            if (window.userPreferences && window.userPreferences.enable_energy_log) {
                showEnergyCheckinModal(timerId, 'start');
            } else {
                // If energy logging is disabled, start timer directly
                startTimerDirectly(timerId);
            }
        });
    });

    document.querySelectorAll('.stop-timer-btn').forEach(button => {
        button.addEventListener('click', function() {
            const timerId = this.dataset.timerId;
            
            // Check if energy logging is enabled before showing modal
            if (window.userPreferences && window.userPreferences.enable_energy_log) {
                showEnergyCheckinModal(timerId, 'end');
            } else {
                // If energy logging is disabled, stop timer directly
                stopTimerDirectly(timerId);
            }
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
