FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application files
COPY src ./src

# Health check (use PORT env at runtime, default 4000)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p = process.env.PORT || 4000; require('http').get('http://localhost:' + p + '/api/health', (r) => { if (r.statusCode !== 200) throw new Error(r.statusCode) })"

# Expose port
EXPOSE 4000

# Start application
CMD ["npm", "start"]
