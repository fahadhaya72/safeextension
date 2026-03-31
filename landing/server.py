#!/usr/bin/env python3
import http.server
import socketserver
import os

# Change to the directory containing this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"🚀 SafeExtension Landing Page Server")
    print(f"📍 Open: http://localhost:{PORT}")
    print(f"🛑 Press Ctrl+C to stop")
    print("-" * 50)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
