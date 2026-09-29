# ── Frontend image for Dokploy (or any Docker host) ──────────────────────────
# Multi-stage: build the Vite app, then serve the static bundle with nginx.

# ---- Stage 1: build -------------------------------------------------------
# bookworm-slim (glibc) so Vite/esbuild's native binary runs correctly;
# alpine (musl) can fail esbuild. The serve stage below still uses nginx:alpine.
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# VITE_API_URL is baked into the JS bundle at BUILD time. Default is the
# backend subdomain; override with a Dokploy build env var if your domains
# differ. (Runtime env vars do NOT affect a static bundle, so it must be set
# at build time.)
ARG VITE_API_URL=https://order.dev-link.cloud
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# ---- Stage 2: serve static files -----------------------------------------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
