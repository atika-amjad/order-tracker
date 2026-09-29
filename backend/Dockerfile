# ── Backend image for Dokploy (or any Docker host) ──────────────────────────
# Express + express-graphql + Socket.io + SSE + JSON-RPC, one Node process.
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only (devDeps like socket.io-client are
# only used by the local smoke test and are not needed at runtime).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application source.
COPY . .

# The server reads PORT from the environment (process.env.PORT || 4000).
# In Dokploy, set the application's exposed port to 4000 to match.
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Run as the non-root `node` user that ships with the node image.
USER node

CMD ["node", "server.js"]
