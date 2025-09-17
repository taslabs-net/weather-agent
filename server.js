const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const WeatherAgent = require('./weatherAgent');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize weather agent
const weatherAgent = new WeatherAgent();
weatherAgent.setOpenAIKey(weatherAgent.defaultOpenAIKey);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Weather AI Agent API',
    version: weatherAgent.getVersion(),
    timestamp: new Date().toISOString()
  });
});

// Main weather query endpoint
app.post('/weather', async (req, res) => {
  try {
    const { query, location } = req.body;

    if (!query && !location) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'Please provide either "query" or "location" in the request body'
      });
    }

    // Use query if provided, otherwise use location
    const userInput = query || location;

    const response = await weatherAgent.handleUserInput(userInput);

    res.json({
      success: true,
      query: userInput,
      response: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process weather request',
      timestamp: new Date().toISOString()
    });
  }
});

// Raw weather data endpoint (for developers)
app.get('/weather/raw/:location', async (req, res) => {
  try {
    const { location } = req.params;
    const weatherData = await weatherAgent.getWeatherData(location);

    res.json({
      success: true,
      location: location,
      data: weatherData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Raw Weather API Error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API documentation endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Weather AI Agent API',
    version: weatherAgent.getVersion(),
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
      curl: 'curl -X POST http://localhost:3000/weather -H "Content-Type: application/json" -d \'{"query":"What should I wear in Miami?"}\'',
      javascript: 'fetch("/weather", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({query: "Is it cold today?"})}).then(r => r.json())'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Weather AI Agent API running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`🤖 Agent Version: ${weatherAgent.getVersion()}`);
});

module.exports = app;