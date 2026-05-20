FROM node:20-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl gettext

COPY --from=build /app/dist /usr/share/nginx/html

# Local dev config (SSL)
COPY nginx.conf /etc/nginx/conf.d/default.conf.local

# Railway/production config (HTTP, envsubst for PORT + BACKEND_URL)
COPY nginx.railway.conf /etc/nginx/templates/default.conf.template

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=80
ENV BACKEND_URL=https://autobusiness-backend.onrender.com
EXPOSE ${PORT}

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
