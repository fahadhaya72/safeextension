@echo off
echo Starting local server for SafeExtension landing page...
echo.
echo Your landing page will be available at: http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
python -m http.server 8000
