# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Önce sadece package dosyaları — layer cache'i maximize eder
COPY package*.json ./
RUN npm ci

COPY . .

# Build-time env (TURN server opsiyonel)
ARG VITE_SERVER_URL=""
ARG VITE_TURN_URL=""
ARG VITE_TURN_USER=""
ARG VITE_TURN_PASS=""
ENV VITE_SERVER_URL=$VITE_SERVER_URL \
    VITE_TURN_URL=$VITE_TURN_URL \
    VITE_TURN_USER=$VITE_TURN_USER \
    VITE_TURN_PASS=$VITE_TURN_PASS

RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx varsayılan config'i kaldır
RUN rm -f /etc/nginx/conf.d/default.conf.orig

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
