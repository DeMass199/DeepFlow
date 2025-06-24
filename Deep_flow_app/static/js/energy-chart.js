document.addEventListener('DOMContentLoaded', function () {
    const chartContainer = document.getElementById('energy-chart');
    if (!chartContainer) return;

    console.log('Energy chart script loaded, fetching data...');

    let currentChart = null; // Store reference to current chart instance
    let currentWeekOffset = 0; // 0 = current week, -1 = last week, etc.
    let currentDataRange = 'week'; // 'week', 'month', 'all'

    // Make refresh function globally available
    window.refreshEnergyChart = loadAndRenderChart;

    // Set up event listeners for navigation
    setupNavigationListeners();

    // Listen for country preference changes from settings page
    window.addEventListener('message', function(event) {
        if (event.data.type === 'countryChanged') {
            console.log('Country changed to:', event.data.country);
            // Refresh the chart with new country preference
            loadAndRenderChart();
        }
    });

    // Listen for storage changes (when localStorage is updated from another tab/window)
    window.addEventListener('storage', function(event) {
        if (event.key === 'deepflow_country_preference') {
            console.log('Country preference changed in localStorage:', event.newValue);
            loadAndRenderChart();
        }
    });

    // Initial chart load
    loadAndRenderChart();

    function setupNavigationListeners() {
        // Week navigation
        const prevWeekBtn = document.getElementById('prev-week-btn');
        const nextWeekBtn = document.getElementById('next-week-btn');
        
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => {
                currentWeekOffset--;
                updateWeekNavigation();
                loadAndRenderChart();
            });
        }
        
        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => {
                currentWeekOffset++;
                updateWeekNavigation();
                loadAndRenderChart();
            });
        }

        // Data range selection
        const rangeButtons = document.querySelectorAll('.range-btn');
        rangeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons
                rangeButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                btn.classList.add('active');
                
                currentDataRange = btn.dataset.range;
                currentWeekOffset = 0; // Reset to current period
                updateWeekNavigation();
                loadAndRenderChart();
            });
        });

        // Reset energy data button
        const resetBtn = document.getElementById('reset-energy-data-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to reset all energy data? This action cannot be undone.')) {
                    resetEnergyData();
                }
            });
        }
    }

    function updateWeekNavigation() {
        const nextWeekBtn = document.getElementById('next-week-btn');
        const currentWeekDisplay = document.getElementById('current-week-display');
        
        // Disable next week button if at current week
        if (nextWeekBtn) {
            nextWeekBtn.disabled = (currentWeekOffset >= 0);
        }
        
        // Update week display
        if (currentWeekDisplay) {
            if (currentDataRange === 'week') {
                if (currentWeekOffset === 0) {
                    currentWeekDisplay.textContent = 'This Week';
                } else if (currentWeekOffset === -1) {
                    currentWeekDisplay.textContent = 'Last Week';
                } else {
                    currentWeekDisplay.textContent = `${Math.abs(currentWeekOffset)} Weeks Ago`;
                }
            } else if (currentDataRange === 'month') {
                currentWeekDisplay.textContent = 'This Month';
            } else {
                currentWeekDisplay.textContent = 'All Time';
            }
        }
    }

    function loadAndRenderChart() {
        let dataPromise;
        
        if (currentDataRange === 'week') {
            // Fetch weekly data with insights
            dataPromise = Promise.all([
                fetch(`/get_weekly_insights?week_offset=${currentWeekOffset}`).then(response => response.json()),
                fetch('/get_user_preferences').then(response => response.json())
            ]).then(([weeklyData, preferencesData]) => {
                // Show weekly feedback if available
                showWeeklyFeedback(weeklyData.insights);
                return { energyData: weeklyData, preferencesData };
            });
        } else {
            // Fetch all data (existing behavior)
            dataPromise = Promise.all([
                fetch('/get_energy_logs').then(response => response.json()),
                fetch('/get_user_preferences').then(response => response.json())
            ]).then(([energyData, preferencesData]) => {
                // Hide weekly feedback for non-weekly views
                hideWeeklyFeedback();
                return { energyData, preferencesData };
            });
        }
        
        dataPromise
        .then(({ energyData, preferencesData }) => {
            console.log('Energy data response:', energyData);
            console.log('User preferences:', preferencesData);
            
            const userCountry = preferencesData.success ? preferencesData.country : 
                               localStorage.getItem('deepflow_country_preference') || 'US';
            
            const timezoneInfo = preferencesData.success ? {
                timezone: preferencesData.timezone,
                timezone_offset: preferencesData.timezone_offset
            } : null;
            
            if (energyData.success && energyData.logs && energyData.logs.length > 0) {
                renderEnergyChart(energyData.logs, userCountry, timezoneInfo);
                chartContainer.style.display = 'block';
                const emptyInsights = document.getElementById('empty-insights');
                if (emptyInsights) {
                    emptyInsights.style.display = 'none';
                }
            } else {
                console.log('No energy logs to display or data.success is false.');
                hideWeeklyFeedback();
            }
        })
        .catch(error => console.error('Error fetching data:', error));
    }

    function showWeeklyFeedback(insights) {
        const feedbackContainer = document.getElementById('weekly-feedback');
        if (!feedbackContainer || !insights) return;
        
        // Update feedback stats
        document.getElementById('avg-energy').textContent = insights.avg_energy || '--';
        document.getElementById('total-sessions').textContent = insights.total_sessions || '--';
        document.getElementById('best-day').textContent = insights.best_day || '--';
        document.getElementById('energy-trend').textContent = insights.energy_trend || '--';
        document.getElementById('weekly-insight').textContent = insights.insight_message || '';
        
        // Show feedback container
        feedbackContainer.classList.remove('hidden');
    }

    function hideWeeklyFeedback() {
        const feedbackContainer = document.getElementById('weekly-feedback');
        if (feedbackContainer) {
            feedbackContainer.classList.add('hidden');
        }
    }

    function getLocaleSettings(country) {
        const settings = {
            'US': { 
                locale: 'en-US', 
                font: 'Arial, sans-serif',
                timezone: 'America/New_York',
                offset: -5
            },
            'UK': { 
                locale: 'en-GB', 
                font: 'Georgia, serif',
                timezone: 'Europe/London',
                offset: 0
            },
            'AU': { 
                locale: 'en-AU', 
                font: 'Arial, sans-serif',
                timezone: 'Australia/Sydney',
                offset: 10
            },
            'CA': { 
                locale: 'en-CA', 
                font: 'Arial, sans-serif',
                timezone: 'America/Toronto',
                offset: -5
            },
            'DE': { 
                locale: 'de-DE', 
                font: 'Helvetica, sans-serif',
                timezone: 'Europe/Berlin',
                offset: 1
            },
            'FR': { 
                locale: 'fr-FR', 
                font: 'Helvetica, sans-serif',
                timezone: 'Europe/Paris',
                offset: 1
            },
            'ES': { 
                locale: 'es-ES', 
                font: 'Helvetica, sans-serif',
                timezone: 'Europe/Madrid',
                offset: 1
            },
            'IT': { 
                locale: 'it-IT', 
                font: 'Helvetica, sans-serif',
                timezone: 'Europe/Rome',
                offset: 1
            },
            'JP': { 
                locale: 'ja-JP', 
                font: 'Hiragino Sans, Arial, sans-serif',
                timezone: 'Asia/Tokyo',
                offset: 9
            },
            'CN': { 
                locale: 'zh-CN', 
                font: 'SimSun, Arial, sans-serif',
                timezone: 'Asia/Shanghai',
                offset: 8
            },
            'IN': { 
                locale: 'en-IN', 
                font: 'Arial, sans-serif',
                timezone: 'Asia/Kolkata',
                offset: 5.5
            },
            'BR': { 
                locale: 'pt-BR', 
                font: 'Arial, sans-serif',
                timezone: 'America/Sao_Paulo',
                offset: -3
            }
        };
        return settings[country] || settings['US'];
    }

    function convertToTimezone(dateString, timezoneOffset) {
        // Parse the original date (assuming it's in UTC or server time)
        const originalDate = new Date(dateString);
        
        // Apply timezone offset (offset is in hours)
        const offsetMs = timezoneOffset * 60 * 60 * 1000;
        const adjustedDate = new Date(originalDate.getTime() + offsetMs);
        
        return adjustedDate;
    }

    function renderEnergyChart(logs, userCountry, timezoneInfo) {
        const ctx = chartContainer.getContext('2d');
        const localeSettings = getLocaleSettings(userCountry);
        
        // Use timezone info from server if available, otherwise use locale settings
        const timezone = timezoneInfo ? timezoneInfo.timezone : localeSettings.timezone;
        const timezoneOffset = timezoneInfo ? timezoneInfo.timezone_offset : localeSettings.offset;
        
        // Destroy existing chart if it exists
        if (currentChart) {
            currentChart.destroy();
        }
        
        // Convert timestamps to the user's timezone and format them
        const labels = logs.map(log => {
            const adjustedDate = convertToTimezone(log.timestamp, timezoneOffset);
            
            // Try to use Intl.DateTimeFormat with timezone if supported
            try {
                return new Intl.DateTimeFormat(localeSettings.locale, {
                    timeZone: timezone,
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false  // Always use 24-hour format
                }).format(new Date(log.timestamp));
            } catch (e) {
                // Fallback to manual timezone conversion if Intl.DateTimeFormat fails
                // Ensure 24-hour format in fallback as well
                return adjustedDate.toLocaleString(localeSettings.locale, { hour12: false });
            }
        });
        
        const energyLevels = logs.map(log => log.energy_level);

        console.log('Rendering chart with data:', { 
            labels, 
            energyLevels, 
            locale: localeSettings.locale,
            timezone: timezone,
            offset: timezoneOffset
        });

        // Apply country-specific font to the chart container
        chartContainer.style.fontFamily = localeSettings.font;

        currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Energy Level',
                    data: energyLevels,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            font: {
                                family: localeSettings.font
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Energy Levels Over Time',
                        font: {
                            family: localeSettings.font,
                            size: 16
                        }
                    }
                },
                scales: {
                    y: {
                        min: 1,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Energy Level',
                            font: {
                                family: localeSettings.font
                            }
                        },
                        ticks: {
                            stepSize: 1,
                            font: {
                                family: localeSettings.font
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Time',
                            font: {
                                family: localeSettings.font
                            }
                        },
                        ticks: {
                            font: {
                                family: localeSettings.font
                            }
                        }
                    }
                }
            }
        });
    }

    function resetEnergyData() {
        console.log('Resetting energy data...');
        
        fetch('/reset_energy_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Energy data reset successfully:', data);
                alert(`Energy data reset successfully! Deleted ${data.deleted_logs} energy logs and ${data.deleted_insights} energy insights.`);
                
                // Hide the chart and show empty state
                const chartContainer = document.getElementById('energy-chart');
                const emptyInsights = document.getElementById('empty-insights');
                
                if (chartContainer) {
                    chartContainer.style.display = 'none';
                }
                if (emptyInsights) {
                    emptyInsights.style.display = 'block';
                }
                
                // Destroy current chart if it exists
                if (currentChart) {
                    currentChart.destroy();
                    currentChart = null;
                }
                
                // Hide weekly feedback
                hideWeeklyFeedback();
                
                // Reset to current week view
                currentWeekOffset = 0;
                currentDataRange = 'week';
                updateWeekNavigation();
                
                // Update active button
                const rangeButtons = document.querySelectorAll('.range-btn');
                rangeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.range === 'week') {
                        btn.classList.add('active');
                    }
                });
                
            } else {
                console.error('Failed to reset energy data:', data.error);
                alert('Failed to reset energy data: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error resetting energy data:', error);
            alert('An error occurred while resetting energy data. Please try again.');
        });
    }
});