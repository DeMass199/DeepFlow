// Function to update the hidden duration value when dropdown changes
function updateDurationValue(value) {
    document.getElementById('duration').value = value;
}

// Function to populate dropdown with 5-minute intervals
document.addEventListener('DOMContentLoaded', function() {
    const dropdown = document.getElementById('duration-dropdown');
    if (!dropdown) return;
    
    // Clear existing options
    dropdown.innerHTML = '';
    
    // Add options from 30 minutes to 4 hours in 5-minute intervals
    for (let minutes = 30; minutes <= 240; minutes += 5) {
        const option = document.createElement('option');
        option.value = minutes;
        
        // Format the display text
        if (minutes < 60) {
            option.textContent = `${minutes} minutes`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            
            if (remainingMinutes === 0) {
                option.textContent = `${hours} hour${hours > 1 ? 's' : ''}`;
            } else {
                option.textContent = `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} min`;
            }
        }
        
        // Set default selected option (1 hour 30 min)
        if (minutes === 90) {
            option.selected = true;
        }
        
        dropdown.appendChild(option);
    }
});
