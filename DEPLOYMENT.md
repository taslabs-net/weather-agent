# Weather AI Agent - Hosting & IDE Integration Guide

## 🚀 Hosting Your Weather AI Agent

### Cloudflare Workers (Recommended - Free)

1. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Deploy to Cloudflare Workers:**
   ```bash
   wrangler deploy
   ```

3. **Set up required secrets:**
   ```bash
   # Weather API key (get from https://www.visualcrossing.com/weather-api)
   wrangler secret put WEATHER_API_KEY

   # OpenAI API key
   wrangler secret put OPENAI_API_KEY

   # Your Cloudflare AI Gateway URL
   wrangler secret put OPENAI_BASE_URL

   # Cloudflare Gateway access client ID
   wrangler secret put CF_ACCESS_CLIENT_ID
   ```

4. **Your API will be available at:**
   ```
   https://weather-ai-agent.your-subdomain.workers.dev
   ```

5. **Test the deployment:**
   ```bash
   curl https://weather-ai-agent.your-subdomain.workers.dev/health
   ```

### Alternative Options

**Railway:**
1. Connect GitHub repo to Railway
2. Use `server.js` for Node.js deployment
3. Set environment variables if needed

**Heroku:**
```bash
heroku create your-weather-api
git push heroku main
```

**DigitalOcean/Linode VPS:**
- Upload `server.js` and run with PM2
- Configure reverse proxy with Nginx

## 🔌 IDE Integration

### VS Code Extension

1. **Install the extension files:**
   ```
   integrations/vscode-extension/
   ├── package.json
   └── extension.js
   ```

2. **Package and install:**
   ```bash
   cd integrations/vscode-extension
   npm install -g vsce
   vsce package
   code --install-extension weather-ai-assistant-1.0.0.vsix
   ```

3. **Configure in VS Code:**
   - Open Settings (Ctrl+,)
   - Search "Weather AI"
   - Set API URL to your deployed endpoint

4. **Usage:**
   - **Ctrl+Shift+W** - Ask Weather AI
   - **Command Palette** → "Ask Weather AI"
   - Set default location for quick checks

### Windsurf Integration

1. **Install the plugin:**
   ```bash
   cp integrations/windsurf-plugin/weather-ai.js ~/.windsurf/plugins/
   ```

2. **Configure:**
   - Update `apiUrl` in the plugin file
   - Set default location in settings

3. **Usage:**
   - **Ctrl+Shift+W** - Ask Weather AI
   - **Ctrl+Alt+W** - Quick weather check
   - Click weather icon in status bar

## 📡 API Endpoints

### Base URL
```
https://weather-ai-agent.your-subdomain.workers.dev
```

### Endpoints

**Health Check:**
```http
GET /health
```

**Natural Language Weather Query:**
```http
POST /weather
Content-Type: application/json

{
  "query": "Should I bring an umbrella in NYC today?"
}
```

**Raw Weather Data:**
```http
GET /weather/raw/New York
```

**API Documentation:**
```http
GET /
```

## 🛠️ Integration Examples

### JavaScript/TypeScript
```javascript
async function askWeatherAI(query) {
  const response = await fetch('https://weather-ai-agent.your-subdomain.workers.dev/weather', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  return data.response;
}

// Usage
const advice = await askWeatherAI("What should I wear in Miami?");
```

### Python
```python
import requests

def ask_weather_ai(query):
    response = requests.post(
        'https://weather-ai-agent.your-subdomain.workers.dev/weather',
        json={'query': query}
    )
    return response.json()['response']

# Usage
advice = ask_weather_ai("Is it good beach weather in San Diego?")
```

### cURL
```bash
curl -X POST https://weather-ai-agent.your-subdomain.workers.dev/weather \
  -H "Content-Type: application/json" \
  -d '{"query": "Will it rain tomorrow in Boston?"}'
```

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (production/development)

### VS Code Settings
- `weatherAI.apiUrl` - Your deployed API URL
- `weatherAI.defaultLocation` - Default location for quick checks

### Windsurf Settings
- `weatherAI.defaultLocation` - Default location

## 🌟 Usage Examples

**IDE Integration Use Cases:**
- Quick weather check while coding
- Insert weather info as comments
- Check conditions before outdoor meetings
- Travel planning assistance
- Clothing advice for remote work

**Sample Queries:**
- "Should I work from the coffee shop today?"
- "Is it good weather for a walking meeting?"
- "Do I need a jacket for lunch?"
- "Will it be too hot to work outside?"

## 🚦 Testing Your Deployment

```bash
# Test health endpoint
curl https://your-api.vercel.app/health

# Test weather query
curl -X POST https://your-api.vercel.app/weather \
  -H "Content-Type: application/json" \
  -d '{"query": "Test query"}'

# Test raw weather data
curl https://your-api.vercel.app/weather/raw/NYC
```

Your Weather AI Agent is now ready for global use! 🌍