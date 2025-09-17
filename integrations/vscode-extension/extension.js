const vscode = require('vscode');
const https = require('https');
const http = require('http');

function activate(context) {
    console.log('Weather AI Assistant is now active!');

    // Get API URL from configuration
    function getApiUrl() {
        const config = vscode.workspace.getConfiguration('weatherAI');
        return config.get('apiUrl', 'http://localhost:3000');
    }

    // Make API request to weather service
    async function queryWeatherAPI(query) {
        return new Promise((resolve, reject) => {
            const apiUrl = getApiUrl();
            const url = new URL('/weather', apiUrl);
            const client = url.protocol === 'https:' ? https : http;

            const postData = JSON.stringify({ query });

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    // Main weather command
    const getWeatherCommand = vscode.commands.registerCommand('weatherAI.getWeather', async () => {
        try {
            const query = await vscode.window.showInputBox({
                prompt: 'Ask the Weather AI anything!',
                placeHolder: 'e.g., "Should I bring an umbrella in NYC?" or "What to wear in Miami?"',
                value: ''
            });

            if (!query) return;

            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Weather AI is thinking...",
                cancellable: false
            }, async () => {
                try {
                    const response = await queryWeatherAPI(query);

                    if (response.success) {
                        // Show response in information message
                        const action = await vscode.window.showInformationMessage(
                            response.response,
                            'Ask Another Question',
                            'Insert Into Editor'
                        );

                        if (action === 'Ask Another Question') {
                            vscode.commands.executeCommand('weatherAI.getWeather');
                        } else if (action === 'Insert Into Editor') {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                const position = editor.selection.active;
                                editor.edit(editBuilder => {
                                    editBuilder.insert(position, `// Weather: ${response.response}\n`);
                                });
                            }
                        }
                    } else {
                        vscode.window.showErrorMessage(`Weather AI Error: ${response.message || 'Unknown error'}`);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Connection Error: ${error.message}`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Weather AI Error: ${error.message}`);
        }
    });

    // Quick weather command
    const quickWeatherCommand = vscode.commands.registerCommand('weatherAI.quickWeather', async () => {
        try {
            const config = vscode.workspace.getConfiguration('weatherAI');
            const defaultLocation = config.get('defaultLocation', '');

            if (!defaultLocation) {
                vscode.window.showWarningMessage(
                    'No default location set. Please configure weatherAI.defaultLocation in settings.',
                    'Open Settings'
                ).then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'weatherAI.defaultLocation');
                    }
                });
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Getting weather for ${defaultLocation}...`,
                cancellable: false
            }, async () => {
                try {
                    const response = await queryWeatherAPI(`What's the weather in ${defaultLocation}?`);

                    if (response.success) {
                        vscode.window.showInformationMessage(response.response);
                    } else {
                        vscode.window.showErrorMessage(`Weather Error: ${response.message || 'Unknown error'}`);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Connection Error: ${error.message}`);
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Weather AI Error: ${error.message}`);
        }
    });

    context.subscriptions.push(getWeatherCommand, quickWeatherCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};