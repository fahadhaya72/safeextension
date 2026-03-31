# SafeExtension Landing Page

## 🚀 Quick Start

To avoid security issues when viewing the landing page locally, use one of these methods:

### Method 1: Python Server (Recommended)
```bash
# Open terminal/command prompt in the landing folder
cd landing
python server.py
```

Then open: http://localhost:8000

### Method 2: Batch File (Windows)
Double-click `start-server.bat` file in the landing folder.

### Method 3: Manual Python Server
```bash
cd landing
python -m http.server 8000
```

### Method 4: VS Code Live Server
If using VS Code, install the "Live Server" extension and right-click `index.html` → "Open with Live Server".

## � Common Error

If you see this error:
```
Unsafe attempt to load URL file:///... from frame with URL file:///...
'file:' URLs are treated as unique security origins.
```

This is normal when opening HTML files directly. The API still works (as you can see in console logs), but some browser features are restricted.

**Solution:** Use one of the server methods above instead of opening index.html directly.

When opening HTML files directly (`file://`), browsers enforce security restrictions that prevent:
- External API calls to your backend
- Proper font loading
- Some CSS/JS features

Using a local server provides a proper `http://` origin that resolves these issues.

## 📱 Features

- ✅ Modern, responsive design
- ✅ Live URL checking functionality
- ✅ Smooth animations and interactions
- ✅ Mobile-friendly interface
- ✅ Real API integration with backend

## 🌐 Deployment

For production deployment, the landing page can be hosted on:
- Netlify
- Vercel
- GitHub Pages
- Any static web host
