// Windsurf Weather AI Plugin
// Place this file in your Windsurf plugins directory

class WeatherAIPlugin {
    constructor() {
        this.name = 'Weather AI Assistant';
        this.version = '1.0.0';
        this.apiUrl = 'http://localhost:3000'; // Change to your deployed URL
    }

    // Initialize the plugin
    async init(windsurf) {
        this.windsurf = windsurf;

        // Register commands
        windsurf.commands.register('weather.ask', this.askWeather.bind(this));
        windsurf.commands.register('weather.quick', this.quickWeather.bind(this));

        // Add to status bar
        windsurf.statusBar.add({
            id: 'weather-ai',
            text: '🌤️ Weather AI',
            tooltip: 'Ask Weather AI',
            command: 'weather.ask'
        });

        // Add keyboard shortcuts
        windsurf.keybindings.add('Ctrl+Shift+W', 'weather.ask');
        windsurf.keybindings.add('Ctrl+Alt+W', 'weather.quick');

        console.log('Weather AI Plugin initialized');
    }

    // Main weather query function
    async askWeather() {
        try {
            const query = await this.windsurf.dialogs.input({
                title: 'Weather AI Assistant',
                prompt: 'Ask me anything about the weather!',
                placeholder: 'e.g., "Should I bring an umbrella?" or "What to wear today?"'
            });

            if (!query) return;

            // Show loading
            const loading = this.windsurf.notifications.show({
                type: 'info',
                message: 'Weather AI is thinking...',
                timeout: 0
            });

            try {
                const response = await this.queryAPI(query);
                loading.close();

                if (response.success) {
                    const action = await this.windsurf.dialogs.choice({
                        title: 'Weather AI Response',
                        message: response.response,
                        choices: [
                            { id: 'insert', label: 'Insert into Editor' },
                            { id: 'copy', label: 'Copy to Clipboard' },
                            { id: 'ask', label: 'Ask Another Question' }
                        ]
                    });

                    switch (action) {
                        case 'insert':
                            this.insertIntoEditor(`// Weather: ${response.response}`);
                            break;
                        case 'copy':
                            this.windsurf.clipboard.write(response.response);
                            this.windsurf.notifications.show({
                                type: 'success',
                                message: 'Weather response copied to clipboard!'
                            });
                            break;
                        case 'ask':
                            this.askWeather();
                            break;
                    }
                } else {
                    this.windsurf.notifications.show({
                        type: 'error',
                        message: `Weather AI Error: ${response.message || 'Unknown error'}`
                    });
                }
            } catch (error) {
                loading.close();
                this.windsurf.notifications.show({
                    type: 'error',
                    message: `Connection Error: ${error.message}`
                });
            }

        } catch (error) {
            this.windsurf.notifications.show({
                type: 'error',
                message: `Weather AI Error: ${error.message}`
            });
        }
    }

    // Quick weather for current location
    async quickWeather() {
        try {
            // Get location from settings or prompt
            let location = this.windsurf.settings.get('weatherAI.defaultLocation');

            if (!location) {
                location = await this.windsurf.dialogs.input({
                    title: 'Quick Weather',
                    prompt: 'Enter your location:',
                    placeholder: 'e.g., "New York" or "90210"'
                });

                if (!location) return;

                // Save for next time
                this.windsurf.settings.set('weatherAI.defaultLocation', location);
            }

            const loading = this.windsurf.notifications.show({
                type: 'info',
                message: `Getting weather for ${location}...`,
                timeout: 0
            });

            try {
                const response = await this.queryAPI(`What's the weather in ${location}?`);
                loading.close();

                if (response.success) {
                    this.windsurf.notifications.show({
                        type: 'info',
                        message: response.response,
                        timeout: 10000
                    });
                } else {
                    this.windsurf.notifications.show({
                        type: 'error',
                        message: `Weather Error: ${response.message || 'Unknown error'}`
                    });
                }
            } catch (error) {
                loading.close();
                this.windsurf.notifications.show({
                    type: 'error',
                    message: `Connection Error: ${error.message}`
                });
            }

        } catch (error) {
            this.windsurf.notifications.show({
                type: 'error',
                message: `Weather AI Error: ${error.message}`
            });
        }
    }

    // Query the Weather AI API
    async queryAPI(query) {
        const response = await fetch(`${this.apiUrl}/weather`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    // Insert text into the active editor
    insertIntoEditor(text) {
        const editor = this.windsurf.editor.getActive();
        if (editor) {
            const position = editor.getCursorPosition();
            editor.insertText(position, text + '\n');
        }
    }

    // Cleanup when plugin is disabled
    destroy() {
        this.windsurf.commands.unregister('weather.ask');
        this.windsurf.commands.unregister('weather.quick');
        this.windsurf.statusBar.remove('weather-ai');
        console.log('Weather AI Plugin destroyed');
    }
}

// Export the plugin
module.exports = WeatherAIPlugin;