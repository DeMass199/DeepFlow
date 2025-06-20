document.addEventListener('DOMContentLoaded', function () {
    const chartContainer = document.getElementById('energy-chart');
    if (!chartContainer) return;

    console.log('Energy chart script loaded, fetching data...');

    let currentChart = null; // Store reference to current chart instance

    // Make refresh function globally available
    window.refreshEnergyChart = loadAndRenderChart;

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

    function loadAndRenderChart() {
        // Fetch user preferences first
        Promise.all([
            fetch('/get_energy_logs').then(response => response.json()),
            fetch('/get_user_preferences').then(response => response.json())
        ])
        .then(([energyData, preferencesData]) => {
            console.log('Energy logs response:', energyData);
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
            }
        })
        .catch(error => console.error('Error fetching data:', error));
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
                    hour12: localeSettings.locale.startsWith('en-US')
                }).format(new Date(log.timestamp));
            } catch (e) {
                // Fallback to manual timezone conversion if Intl.DateTimeFormat fails
                return adjustedDate.toLocaleString(localeSettings.locale);
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
                        beginAtZero: true,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Energy Level',
                            font: {
                                family: localeSettings.font
                            }
                        },
                        ticks: {
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
});