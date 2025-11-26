# Multi-stage build for Orchestrator
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 50051

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "console.log('OK')" || exit 1

CMD ["node", "index.js"]
