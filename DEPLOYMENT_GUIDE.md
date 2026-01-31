# Safe Extension - Complete Deployment Guide

**Simple Explanation**: We're uploading your backend to Render (a cloud server) so it runs 24/7, then connecting your extension to that server.

---

## PART 1: BACKEND DEPLOYMENT TO RENDER

### Step 1: Get a Render Account (Free)
1. Go to https://render.com
2. Click **"Sign Up"**
3. Sign up with your email or GitHub account (GitHub is easier)
4. Verify your email
5. Done! You now have a Render account.

---

### Step 2: Prepare Your Backend for Render

Your backend is already ready! But we need to make sure Render knows how to start it.

**Check your `package.json`** - It should have this in the **scripts** section:
```json
"start": "node src/index.js"
```

✅ If it's there, you're good!
❌ If it's missing, let me know and I'll add it.

---

### Step 3: Create a New Service on Render

1. **Log into Render** (render.com)
2. Click the **"New +"** button (top right)
3. Select **"Web Service"**
4. You'll see a form asking for "Repository"

---

### Step 4: Connect Your GitHub (or Upload Manually)

**Option A: If you use GitHub (Easiest)**
1. Click **"Connect GitHub"**
2. Let Render access your GitHub
3. Find and select your `safeextension` repository
4. Click **"Connect"**

**Option B: If you don't use GitHub**
- Just fill in the fields manually (we'll skip to next steps)

---

### Step 5: Configure Your Web Service

Fill in these fields:

| Field | Value |
|-------|-------|
| **Name** | `safeextension-backend` |
| **Region** | Choose closest to you (e.g., `United States`) |
| **Branch** | `main` (or your branch) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

---

### Step 6: Add Environment Variables

This is **VERY IMPORTANT**. These are your API keys that the backend needs.

1. Scroll down to **"Environment"**
2. Click **"Add Environment Variable"**
3. Add each of these (copy the exact names):

```
Key: SAFE_BROWSING_API_KEY
Value: YOUR_GOOGLE_API_KEY_HERE

Key: WHOIS_NINJA_API_KEY
Value: YOUR_API_NINJAS_KEY_HERE

Key: PORT
Value: 10000
```

**Where to get these keys:**
- **SAFE_BROWSING_API_KEY**: Google Cloud Console (https://console.cloud.google.com/)
- **WHOIS_NINJA_API_KEY**: API Ninjas (https://rapidapi.com/Major/api/whois/pricing)

🚨 **Don't have keys yet?** Don't worry! You can add them later. For now, just skip this step.

---

### Step 7: Deploy!

1. Click **"Create Web Service"** button (bottom right)
2. Wait... Render will start building and deploying automatically
3. You'll see a log of what's happening (green text = good, red = error)
4. **Wait 2-3 minutes** for it to finish

✅ When you see: `"Your service is live"` - **SUCCESS!**

---

### Step 8: Get Your Backend URL

1. Go to your Render dashboard
2. Click on your service name (`safeextension-backend`)
3. Look for a URL like: `https://safeextension-backend-xxxxx.onrender.com`
4. **COPY THIS URL** - You'll need it next!

---

## PART 2: UPDATE YOUR EXTENSION

### Step 9: Update API URL in Extension

Your extension currently looks for the backend at `http://localhost:4000` (your computer).
Now we need to tell it to use the **Render URL** instead.

**File 1: `extension/background.js`**

Find this line:
```javascript
const API_BASE_URL = 'http://localhost:4000';
```

Replace it with:
```javascript
const API_BASE_URL = 'https://safeextension-backend-xxxxx.onrender.com';
```
(Use YOUR actual Render URL)

---

**File 2: `extension/popup.js`**

Find this line:
```javascript
const API_BASE_URL = 'http://localhost:4000';
```

Replace it with:
```javascript
const API_BASE_URL = 'https://safeextension-backend-xxxxx.onrender.com';
```

---

### Step 10: Test the Connection

1. Open Chrome
2. Go to `chrome://extensions/`
3. Turn on **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select your `extension` folder
6. Open your extension popup
7. Try checking a URL - it should work now! ✅

---

## PART 3: PACKAGE YOUR EXTENSION FOR USERS

### Step 11: Create a ZIP File

1. Open your `safeextension` folder
2. Right-click on the `extension` folder
3. Select **"Send to"** → **"Compressed folder"**
4. A `extension.zip` file will appear
5. Rename it to `safeextension-final.zip`

**Users can now:**
- Extract the ZIP
- Load it as an unpacked extension (for personal use)

---

### Step 12: (Optional) Publish to Chrome Web Store

**This is for public distribution:**

1. Go to https://chrome.google.com/webstore/developer
2. Sign in with your Google account
3. Click **"New Item"**
4. Upload your `extension.zip` file
5. Fill in:
   - Extension name
   - Description
   - Icons (256x256 image)
   - Screenshots
6. Set price: **Free**
7. Click **"Publish"**
8. Wait for Google approval (usually 1-3 hours)

---

## TROUBLESHOOTING

### "Backend not responding" Error
- Check if Render URL is correct in background.js and popup.js
- Make sure you added environment variables to Render
- Check Render logs for errors

### "Permission denied" in Chrome
- Make sure extension has `storage` permission in manifest.json
- Check if you're testing `https` URLs (not `http`)

### Extension works locally but not on Render
- Check Render logs: https://render.com → Your service → Logs
- Look for red error messages

---

## QUICK SUMMARY

1. ✅ Create Render account
2. ✅ Deploy backend to Render
3. ✅ Add API keys to Render environment
4. ✅ Get Render URL
5. ✅ Update extension with Render URL
6. ✅ Test extension
7. ✅ Package and share extension

**You're DONE!** 🎉

