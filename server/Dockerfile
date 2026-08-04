# SHIN SEKAI WebSocket room server — Cloud Run container
FROM node:20-slim

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy server code
COPY index.js ./
COPY server-core.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
