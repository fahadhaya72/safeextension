# Quick Start Guide for SafeExtension

## 🚀 5-Minute Setup

### 1. Get API Keys (5 minutes)

**Google Safe Browsing API:**
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Search for "Safe Browsing API" and enable it
4. Go to Credentials → Create Credentials → API Key
5. Copy the API key

**API Ninjas WHOIS (Optional):**
1. Go to https://api-ninjas.com/api/whois
2. Sign up for free account
3. Copy your API key from dashboard

### 2. Setup Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and paste your API keys:
```env
SAFE_BROWSING_API_KEY=your_key_here
WHOIS_NINJA_API_KEY=your_key_here
```

Start the server:
```bash
npm run dev
```

✅ Backend running at `http://localhost:4000`

### 3. Setup Extension

1. Open Chrome: `chrome://extensions/`
2. Toggle "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder
5. Done! 🎉

---

## 🧪 Quick Test

1. Click the SafeExtension icon in Chrome toolbar
2. Enter a URL: `https://google.com`
3. Click "Check URL"
4. Should show "Safe" with score 95+

---

## 🐛 Troubleshooting

**Backend won't start:**
```bash
npm install  # Reinstall dependencies
npm run dev   # Try again
```

**Extension not working:**
- Check `http://localhost:4000/api/health` in browser (should show `{"ok":true}`)
- Reload extension: Click reload icon on `chrome://extensions/`

**API key errors:**
- Check API keys are correctly pasted in `.env`
- Ensure APIs are enabled in Google Cloud Console
- Check browser console for CORS errors

---

## 📚 Full Documentation

See [README.md](README.md) for complete documentation.

---

## 🎯 Next Steps

- [ ] Test with different URLs
- [ ] Check risk factors and recommendations
- [ ] Explore API documentation
- [ ] Deploy with Docker (see README.md)
