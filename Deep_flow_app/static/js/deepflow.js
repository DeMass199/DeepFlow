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
            showEnergyCheckinModal(timerId, 'start');
        });
    });

    document.querySelectorAll('.stop-timer-btn').forEach(button => {
        button.addEventListener('click', function() {
            const timerId = this.dataset.timerId;
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
});
