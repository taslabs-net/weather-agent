const axios = require('axios');
const readlineSync = require('readline-sync');
const OpenAI = require('openai');

class WeatherAgent {
  constructor() {
    this.weatherApiKey = '9B8SF4ZFZMKZGQYZP25EDKMTS';
    this.weatherBaseUrl = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';
    this.openai = null;
    this.conversationHistory = [];
    this.userPreferences = {};
    this.defaultOpenAIKey = process.env.OPENAI_API_KEY || null;
  }

  setOpenAIKey(apiKey) {
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://gateway.ai.cloudflare.com/v1/b15ec51cdf96746b05cb3983874d65a2/openapi-test/openai',
      defaultHeaders: {
        'CF-Access-Client-Id': 'Ajfw-xLw4lwqC0ZGEDi9YeHx6SIiqJfra4O72-vM'
      }
    });
  }

  async getWeatherData(location) {
    try {
      const url = `${this.weatherBaseUrl}/${encodeURIComponent(location)}?unitGroup=us&contentType=json&key=${this.weatherApiKey}`;

      const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' }
      });

      const data = response.data;
      const today = data.days[0];

      return {
        location: data.resolvedAddress,
        date: today.datetime,
        temperature: Math.round(today.temp),
        feelsLike: Math.round(today.feelslike),
        description: today.conditions,
        humidity: today.humidity,
        windSpeed: today.windspeed,
        precipitation: today.precip || 0,
        uvIndex: today.uvindex,
        visibility: today.visibility,
        forecast: data.days.slice(0, 7).map(day => ({
          date: day.datetime,
          tempMax: Math.round(day.tempmax),
          tempMin: Math.round(day.tempmin),
          conditions: day.conditions,
          precipChance: day.precipprob,
          description: day.description
        }))
      };
    } catch (error) {
      throw new Error(`Unable to fetch weather for "${location}". Please check the location and try again.`);
    }
  }

  async analyzeUserIntent(userInput) {
    const systemPrompt = `You are a weather AI agent that analyzes user requests about weather.

Extract and return a JSON object with:
- "intent": one of ["current_weather", "forecast", "weather_advice", "clothing_suggestion", "activity_suggestion", "comparison", "general_chat"]
- "location": extracted location (city, zip, etc.) or null if not specified
- "timeframe": "today", "tomorrow", "this_week", "specific_date", or null
- "specific_date": if mentioned (YYYY-MM-DD format) or null
- "context": any additional context like activities, clothing, travel plans

Examples:
"What's the weather in NYC?" -> {"intent": "current_weather", "location": "NYC", "timeframe": "today", "specific_date": null, "context": null}
"Should I bring an umbrella tomorrow?" -> {"intent": "weather_advice", "location": null, "timeframe": "tomorrow", "specific_date": null, "context": "umbrella"}
"What should I wear in Boston this weekend?" -> {"intent": "clothing_suggestion", "location": "Boston", "timeframe": "this_week", "specific_date": null, "context": "weekend"}

User input: "${userInput}"

Return only valid JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 200
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return { intent: "current_weather", location: userInput, timeframe: "today", specific_date: null, context: null };
    }
  }

  async generateResponse(intent, weatherData, userInput, context = null) {
    const systemPrompt = `You are a helpful weather AI agent. Be conversational, proactive, and provide practical advice.

Available weather data:
${JSON.stringify(weatherData, null, 2)}

User's intent: ${intent}
User's input: "${userInput}"
Additional context: ${context}

Conversation history (last 3 messages):
${this.conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Based on the intent, provide a helpful response:
- For current_weather: Give current conditions with relevant advice
- For forecast: Provide forecast with planning suggestions
- For weather_advice: Give specific advice about their question
- For clothing_suggestion: Suggest appropriate clothing
- For activity_suggestion: Suggest activities based on weather
- For comparison: Compare weather between locations/times
- For general_chat: Be conversational while staying weather-focused

Be concise but helpful. Use emojis sparingly. Always end with a follow-up question or suggestion.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 300
      });

      return response.choices[0].message.content;
    } catch (error) {
      return this.formatBasicWeatherResponse(weatherData);
    }
  }

  formatBasicWeatherResponse(weatherData) {
    return `🌤️ Current weather for ${weatherData.location}:
${weatherData.temperature}°F (feels like ${weatherData.feelsLike}°F)
Conditions: ${weatherData.description}
Wind: ${weatherData.windSpeed} mph | Humidity: ${weatherData.humidity}%

Is there anything specific you'd like to know about the weather?`;
  }

  addToHistory(role, content) {
    this.conversationHistory.push({ role, content, timestamp: new Date() });
    if (this.conversationHistory.length > 10) {
      this.conversationHistory.shift();
    }
  }

  async handleUserInput(userInput) {
    this.addToHistory('user', userInput);

    if (!this.openai) {
      const analysis = { intent: "current_weather", location: userInput, timeframe: "today" };
      try {
        const weatherData = await this.getWeatherData(analysis.location);
        const response = this.formatBasicWeatherResponse(weatherData);
        this.addToHistory('assistant', response);
        return response;
      } catch (error) {
        console.log('Debug - Error details:', error.message);
        return `I couldn't fetch weather data for "${userInput}". Error: ${error.message}`;
      }
    }

    try {
      const analysis = await this.analyzeUserIntent(userInput);

      let weatherData = null;
      if (analysis.location) {
        weatherData = await this.getWeatherData(analysis.location);
      } else if (this.userPreferences.lastLocation) {
        weatherData = await this.getWeatherData(this.userPreferences.lastLocation);
      }

      if (analysis.location) {
        this.userPreferences.lastLocation = analysis.location;
      }

      const response = await this.generateResponse(
        analysis.intent,
        weatherData,
        userInput,
        analysis.context
      );

      this.addToHistory('assistant', response);
      return response;

    } catch (error) {
      return "I'm having trouble processing your request. Could you rephrase that or try a specific location?";
    }
  }

  getVersion() {
    return require('./package.json').version;
  }

  async start() {
    console.log('🤖 Welcome to your AI Weather Agent!');
    console.log('I can understand natural language and provide intelligent weather insights.');
    console.log(`📦 Version: ${this.getVersion()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const useOpenAI = readlineSync.question('Do you have an OpenAI API key for enhanced AI features? (y/n): ');

    if (useOpenAI.toLowerCase() === 'y' || useOpenAI.toLowerCase() === 'yes') {
      const openaiKey = readlineSync.question('Enter your OpenAI API key: ');
      this.setOpenAIKey(openaiKey);
      console.log('✅ AI features enabled! I can now understand complex queries and provide intelligent advice.\n');
    } else {
      console.log('📝 Running in basic mode. I can still get weather data but with limited AI features.\n');
    }

    console.log('Try asking me things like:');
    console.log('• "What\'s the weather in NYC?"');
    console.log('• "Should I bring an umbrella tomorrow?"');
    console.log('• "What should I wear in Boston this weekend?"');
    console.log('• "Is it good beach weather in Miami?"');
    console.log('• Type "version" to see version info');
    console.log('• Type "quit" to exit\n');

    while (true) {
      const input = readlineSync.question('You: ');

      if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
        console.log('👋 Thanks for using Weather Agent! Stay weather-aware!');
        break;
      }

      if (input.toLowerCase() === 'version' || input.toLowerCase() === '--version') {
        console.log(`Weather AI Agent v${this.getVersion()}`);
        continue;
      }

      if (input.trim() === '') {
        console.log('Please ask me something about the weather!');
        continue;
      }

      try {
        console.log('\n🤔 Thinking...');
        const response = await this.handleUserInput(input.trim());
        console.log(`\nAgent: ${response}\n`);
      } catch (error) {
        console.log(`❌ Something went wrong: ${error.message}\n`);
      }
    }
  }
}

module.exports = WeatherAgent;

if (require.main === module) {
  const agent = new WeatherAgent();
  agent.start();
}