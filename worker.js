// Cloudflare Worker for Weather AI Agent

// Weather API configuration
const WEATHER_API_KEY = '9B8SF4ZFZMKZGQYZP25EDKMTS';
const WEATHER_BASE_URL = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';

// OpenAI configuration (use your Cloudflare AI Gateway)
const OPENAI_BASE_URL = 'https://gateway.ai.cloudflare.com/v1/b15ec51cdf96746b05cb3983874d65a2/openapi-test/openai';
const CF_ACCESS_CLIENT_ID = 'Ajfw-xLw4lwqC0ZGEDi9YeHx6SIiqJfra4O72-vM';

class WeatherAgent {
  constructor(env) {
    this.env = env;
    this.conversationHistory = [];
    this.userPreferences = {};
  }

  async getWeatherData(location) {
    try {
      const url = `${WEATHER_BASE_URL}/${encodeURIComponent(location)}?unitGroup=us&contentType=json&key=${WEATHER_API_KEY}`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
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

User input: "${userInput}"

Return only valid JSON.`;

    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "system", content: systemPrompt }],
          temperature: 0.1,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      // Fallback to basic parsing
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
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "system", content: systemPrompt }],
          temperature: 0.7,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
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
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (path === '/health' && request.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'Weather AI Agent API',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Main weather query endpoint
  if (path === '/weather' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { query, location } = body;

      if (!query && !location) {
        return new Response(JSON.stringify({
          error: 'Missing required parameter',
          message: 'Please provide either "query" or "location" in the request body'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const weatherAgent = new WeatherAgent(env);
      const userInput = query || location;
      const response = await weatherAgent.handleUserInput(userInput);

      return new Response(JSON.stringify({
        success: true,
        query: userInput,
        response: response,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to process weather request',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Raw weather data endpoint
  if (path.startsWith('/weather/raw/') && request.method === 'GET') {
    try {
      const location = decodeURIComponent(path.split('/weather/raw/')[1]);
      const weatherAgent = new WeatherAgent(env);
      const weatherData = await weatherAgent.getWeatherData(location);

      return new Response(JSON.stringify({
        success: true,
        location: location,
        data: weatherData,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch weather data',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // API documentation endpoint
  if (path === '/' && request.method === 'GET') {
    return new Response(JSON.stringify({
      name: 'Weather AI Agent API',
      version: '1.0.0',
      description: 'An intelligent AI-powered weather API that understands natural language queries',
      endpoints: {
        'GET /health': 'Health check',
        'POST /weather': 'Natural language weather queries (body: {query: "string"})',
        'GET /weather/raw/:location': 'Raw weather data for location',
        'GET /': 'This documentation'
      },
      examples: {
        naturalLanguage: {
          method: 'POST',
          url: '/weather',
          body: { query: 'Should I bring an umbrella in NYC today?' }
        },
        rawData: {
          method: 'GET',
          url: '/weather/raw/New York'
        }
      },
      integration: {
        curl: 'curl -X POST https://your-worker.your-subdomain.workers.dev/weather -H "Content-Type: application/json" -d \'{"query":"What should I wear in Miami?"}\'',
        javascript: 'fetch("/weather", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({query: "Is it cold today?"})}).then(r => r.json())'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 404 for unknown paths
  return new Response(JSON.stringify({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Export the fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};