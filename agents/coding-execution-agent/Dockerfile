# Generic Dockerfile for Node.js agents
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Health check (override in docker-compose for specific ports)
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "console.log('OK')" || exit 1

# Start application
CMD ["node", "index.js"]
