# Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Use .env.production para o build
# Vite automaticamente lê .env.production em production mode
RUN if [ -f .env.production ]; then cp .env.production .env; fi

RUN npm run build

# Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri /index.html; } }\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
