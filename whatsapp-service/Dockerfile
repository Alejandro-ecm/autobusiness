FROM node:20-slim

# Chromium del sistema + fuentes (whatsapp-web.js corre WhatsApp Web real)
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libasound2 \
      libpangocairo-1.0-0 \
      libpango-1.0-0 \
      libcairo2 \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Puppeteer NO descarga su propio Chromium — usamos el del sistema
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV SESSIONS_DIR=/data/sessions
EXPOSE 8002

CMD ["node", "index.js"]
