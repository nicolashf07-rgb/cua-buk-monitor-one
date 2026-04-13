FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src/ ./src/
USER node
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget -q --spider http://localhost:4007/health || exit 1
CMD ["node", "src/index.js"]
