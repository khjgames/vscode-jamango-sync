# Jamango Sync WebSocket Proxy for Railway

This is a WebSocket proxy server that bridges HTTPS websites (like GitHub Pages) to local VS Code extension WebSocket servers.

## 🚀 Deploy to Railway

### Option 1: Deploy from GitHub (Recommended)

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login with GitHub**
3. **Click "New Project" → "Deploy from GitHub repo"**
4. **Select your repository**: `vscode-jamango-sync`
5. **Select the `railway-proxy` folder**
6. **Railway will automatically deploy!**

### Option 2: Deploy from CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy the proxy
cd railway-proxy
railway up
```

## 🔗 Your Proxy URL

After deployment, Railway will give you a URL like:
```
https://your-project-name.railway.app
```

Your WebSocket proxy will be available at:
```
wss://your-project-name.railway.app
```

## 📊 Status Endpoints

- **Status**: `https://your-project-name.railway.app/`
- **Health**: `https://your-project-name.railway.app/health`

## 🔧 Update Website

Update your website to use the new Railway proxy:

```javascript
const wsUrls = [
    'wss://your-project-name.railway.app',  // Your Railway proxy
    'ws://localhost:8080',                  // Local fallback
    'ws://127.0.0.1:8080',                 // Alternative local
];
```

## 💰 Cost

- **Free tier**: $5/month credit
- **Small WebSocket server**: ~$2-3/month
- **Covered by free tier** ✅

## ⚡ Features

- ✅ **Real WebSocket support**
- ✅ **HTTPS by default**
- ✅ **CORS enabled**
- ✅ **Always online** (no sleep)
- ✅ **Auto-restart on failure**
- ✅ **Health monitoring**

## 🐛 Troubleshooting

- **Check logs**: Railway dashboard → your project → Logs
- **Restart**: Railway dashboard → your project → Settings → Restart
- **Monitor usage**: Railway dashboard → your project → Usage 