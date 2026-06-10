FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV SESSIONS_DIR=/data/sessions
EXPOSE 8002

CMD ["node", "index.js"]
