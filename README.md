# CSC337 Lab 04 — Real-Time Order Tracker & Live Support System

A full-stack web application that combines **four communication protocols** in a single project:

| # | Protocol | Used For | Location |
|---|----------|----------|----------|
| 1 | **REST + GraphQL** | Resource management (orders & catalog) | `backend/src/routes/orders.js`, `routes/catalog.js`, `routes/graphql.js` |
| 2 | **WebSockets (Socket.io)** | Real-time order status + 1-on-1 customer↔support chat | `backend/src/realtime/socketHandler.js` |
| 3 | **JSON-RPC 2.0** | Action methods (`cancelOrder`, etc.) | `backend/src/routes/rpc.js` |
| 4 | **Server-Sent Events (SSE)** | Live system alert feed | `backend/src/sse/events.js` |

> A single in-memory event bus (`backend/src/eventBus.js`) is the integration
> spine: **every** mutation (via REST, GraphQL, or JSON-RPC) publishes to the
> bus, and both SSE and Socket.io subscribe to it — so live updates fan out
> identically regardless of which protocol triggered them.

---

## 🔗 Live URLs

| Service | URL |
|---------|-----|
| **Backend (Dokploy)** | `https://order.dev-link.cloud` |
| **Frontend (Dokploy)** | `https://order-tracker.dev-link.cloud` |
| **GitHub repository** | `https://github.com/atika-amjad/order-tracker` |

Deployment steps are in the **[Deployment](#-deployment)** section below.

---

## 🏗️ Architecture

```
                      ┌────────────────────────────────────────────┐
                      │            Browser (React + Vite)          │
                      │  Catalog · OrderForm · OrderTracker         │
                      │  AlertFeed (SSE) · SupportChat (WS) · Agent │
                      └───────────────┬────────────────────────────┘
         REST/GraphQL/RPC (HTTP)      │       WebSocket / SSE
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Express + http.Server (one port)                  │
│  /api/v1/*   /graphql   /rpc   /events(SSE)        Socket.io (/)      │
│       │           │       │        │                     │          │
│       └───────────┴───────┴────────┴──── all mutate ─────┤          │
│                                                            ▼          │
│                              ┌──────────────────────────────────────┐ │
│                              │   store/orders.js  +  store/catalog.js│ │
│                              │          (in-memory, seeded)          │ │
│                              └───────────────┬──────────────────────┘ │
│                                              │ emits                  │
│                                              ▼                        │
│                              ┌──────────────────────────────────────┐ │
│                              │     eventBus (Node EventEmitter)      │ │
│                              │ order:created / order:status /         │ │
│                              │ order:cancelled / alert               │ │
│                              └───────┬───────────────────┬───────────┘ │
│                            subscribe │                 subscribe │     │
│                                      ▼                            ▼     │
│                              /events (SSE)                Socket.io rooms│
└──────────────────────────────────────────────────────────────────────┘
```

**Tech stack:** Node.js + Express (CommonJS), `express-graphql` + `graphql`, `socket.io`
(server + client), React 18 + Vite 5. No database — in-memory store with seed data
(resets on every server restart; fine for a lab demo, noted in [Notes](#-notes)).

---

## 📦 Project Structure

```
order-tracker/
├── README.md                  ← this file
├── .gitignore  .nvmrc  package.json   (root convenience scripts)
├── backend/
│   ├── package.json  .env.example  Dockerfile  .dockerignore  .nvmrc  server.js
│   ├── src/
│   │   ├── app.js             ← express app, CORS, route mounting
│   │   ├── config.js          ← PORT, ALLOWED_ORIGINS
│   │   ├── eventBus.js        ← pub/sub spine
│   │   ├── store/{catalog,orders}.js
│   │   ├── routes/{catalog,orders,graphql,rpc}.js
│   │   ├── sse/events.js      ← /events
│   │   └── realtime/socketHandler.js
│   └── tests/smoke.mjs        ← automated test for all 4 protocols
└── frontend/
    ├── package.json  Dockerfile  nginx.conf  .dockerignore  .env.example  vite.config.js  index.html
    └── src/
        ├── main.jsx  App.jsx  config.js  styles.css
        ├── api/{rest,graphql,rpc,sse,socket}.js
        ├── context/AlertsContext.jsx   (SSE provider)
        └── components/{NavBar,Catalog,OrderForm,OrderTracker,AlertFeed,
                        SupportChat,AgentPanel}.jsx
```

---

## 🚀 Local Development Setup

**Prerequisites:** Node.js ≥ 20, npm.

```bash
# 1. Clone
git clone https://github.com/atika-amjad/order-tracker.git
cd order-tracker

# 2. Install dependencies for both apps
npm run install:all
#   (equivalent to:  npm --prefix backend install  &&  npm --prefix frontend install)

# 3. Configure backend env (defaults work for local dev)
cp backend/.env.example backend/.env      # PORT=4000, ALLOWED_ORIGINS=*

# 4. Configure frontend env
cp frontend/.env.example frontend/.env    # VITE_API_URL=http://localhost:4000

# 5. Start the backend (terminal A)
npm run dev:backend          # → http://localhost:4000  (GraphiQL at /graphql)

# 6. Start the frontend (terminal B)
npm run dev:frontend         # → http://localhost:5173

# 7. Open http://localhost:5173 in your browser
```

**Run the automated smoke test** (starts its own server or use the running one):

```bash
# Option A — run against the already-running backend on 4000:
BASE_URL=http://localhost:4000 npm --prefix backend run smoke

# Option B — start a throwaway instance on another port:
cd backend && PORT=4011 node server.js &
BASE_URL=http://localhost:4011 node tests/smoke.mjs
```

The smoke test asserts **all 16** checks across REST, GraphQL, JSON-RPC (incl.
batch + notification), SSE, and Socket.io (chat round-trip + live status update).

---

## 📡 Protocol Reference

### 1. REST — `/api/v1`

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/catalog` | — | List all products |
| GET | `/api/v1/catalog/:id` | — | One product |
| GET | `/api/v1/orders?status=pending` | — | List orders (optional status filter) |
| GET | `/api/v1/orders/:id` | — | One order |
| POST | `/api/v1/orders` | `{customerName, items:[{productId,qty}]}` | Create order |
| PATCH | `/api/v1/orders/:id/status` | `{status}` | Update order status |
| DELETE | `/api/v1/orders/:id` | — | Cancel order |
| GET | `/health` | — | Health check (`{status:"ok"}`) |

**Example:**
```bash
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Jane","items":[{"productId":"p1","qty":2}]}'
```

### 2. GraphQL — `/graphql`

Built with `express-graphql`; **GraphiQL UI** is served at `GET /graphql` in the
browser (great for grading — try queries interactively).

```graphql
type Query {
  catalog: [Product]
  product(id: ID!): Product
  orders(status: String): [Order]
  order(id: ID!): Order
}
type Mutation {
  createOrder(customerName: String!, items: [OrderItemInput]!): Order
  updateOrderStatus(orderId: ID!, status: String!): Order
  cancelOrder(orderId: ID!): Order
}
input OrderItemInput { productId: ID!, qty: Int! }
```

**Example:**
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ catalog { id name price stock } }"}'
```

### 3. JSON-RPC 2.0 — `/rpc`

`POST /rpc` accepts a single request object **or** a batch array. Requests
without an `id` are **notifications** (server replies `204 No Content`).

**Methods:**

| Method | Params | Returns |
|--------|--------|---------|
| `listCatalog` | — | `[Product]` |
| `getProduct` | `{id}` | `Product` |
| `listOrders` | `{status?}` | `[Order]` |
| `getOrder` | `{orderId}` | `Order` |
| `createOrder` | `{customerName, items:[{productId,qty}]}` | `Order` |
| `updateOrderStatus` | `{orderId, status}` | `Order` |
| `cancelOrder` | `{orderId}` | `Order` |

**Standard error codes:** `-32700` parse · `-32600` invalid request ·
`-32601` method not found · `-32602` invalid params · `-32603` internal.

**Example — cancel an order:**
```bash
curl -X POST http://localhost:4000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"cancelOrder","params":{"orderId":"<ORDER_ID>"},"id":1}'
# → {"jsonrpc":"2.0","result":{"id":"...","status":"cancelled",...},"id":1}
```

**Batch example:**
```json
[
  {"jsonrpc":"2.0","method":"listOrders","id":1},
  {"jsonrpc":"2.0","method":"listCatalog","id":2}
]
```

### 4. Server-Sent Events — `/events`

`GET /events` opens a `text/event-stream`. Optional `?topic=alerts|orders`
filters events. A `: ping` heartbeat keeps proxies from idle-closing.

```
event: hello
data: {"message":"connected to live alert stream","ts":"..."}

event: alert
data: {"type":"created","message":"New order a1b2c3d4 placed by Jane","ts":"...","orderId":"..."}

event: order
data: {"id":"...","status":"shipped",...}

: ping 1700000000000
```

**Test with curl:**
```bash
curl -N http://localhost:4000/events
# then, in another terminal, create/cancel an order to see alerts stream in
```

### 5. WebSocket Events — Socket.io (same origin as the backend)

Socket.io runs on the **same port** as the HTTP server. Rooms:
`order:<id>` (live status), `chat:<roomId>` (support chat), `agents` (agent pool).

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribeOrder` | `orderId` | Join an order's live status room |
| `unsubscribeOrder` | `orderId` | Leave an order's room |
| `chat:join` | `{roomId, role, name}` | Join a 1-on-1 chat room |
| `chat:message` | `{roomId, text}` | Send a chat message |
| `chat:typing` | `{roomId}` | Typing indicator |
| `support:joinAgents` | — | Register this socket as a support agent |
| `support:request` | `{orderId?, customerName, roomId?}` | Customer requests support |
| `support:accept` | `{roomId}` | Agent accepts a support request |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribed` | `{room}` | Confirms order room subscription |
| `order:statusUpdate` | `Order` | Live order status (relayed from event bus) |
| `order:created` / `order:updated` | `Order` | Broadcast to all clients (list refresh) |
| `chat:joined` | `{roomId, participant}` | Someone joined a chat room |
| `chat:message` | `{roomId, sender, name, text, ts}` | Incoming chat message |
| `chat:typing` | `{roomId, name, ts}` | Typing indicator |
| `support:request` | `{orderId, customerName, roomId, ts}` | New request → all agents |
| `support:queued` | `{roomId}` | Customer's request is queued |
| `support:accepted` | `{roomId, agent, ts}` | An agent accepted the chat |
| `support:taken` | `{roomId}` | Notify other agents the request is taken |
| `support:agentsReady` | `{message}` | Agent joined the pool |

**Status flow:** `pending → confirmed → preparing → shipped → delivered`
(or `cancelled` from any non-terminal state).

---

## 🔗 Frontend ↔ Protocol Map

| UI tab / component | Protocols exercised |
|--------------------|---------------------|
| **Shop → Catalog** | REST `GET /api/v1/catalog` |
| **Shop → OrderForm** | REST `POST /api/v1/orders` **and** GraphQL `createOrder` (toggle) |
| **Orders → OrderTracker** | REST (list/patch) · WebSocket `subscribeOrder`+`order:statusUpdate` · JSON-RPC `cancelOrder` |
| **Orders → AlertFeed** | SSE `/events` (live alerts) |
| **Live Support** | WebSocket `support:request` + `chat:*` (customer side) |
| **Agent** | REST (list/status) · WebSocket `support:joinAgents`+`accept`+`chat:*` |

---

## ☁️ Deployment (Dokploy — self-hosted server)

This project deploys as **two separate Dokploy Applications**, each built from
its own Dockerfile, with Dokploy's bundled Traefik giving each its own subdomain
+ automatic HTTPS (Let's Encrypt):

| App | Dockerfile | Domain | Port | Key env var |
|-----|-----------|--------|------|-------------|
| Backend | `backend/Dockerfile` | `order.dev-link.cloud` | `4000` | `ALLOWED_ORIGINS` (runtime) |
| Frontend | `frontend/Dockerfile` | `order-tracker.dev-link.cloud` | `80` | `VITE_API_URL` (build-time) |

> Traefik terminates TLS for both domains and proxies to the containers.
> WebSockets and SSE work out of the box — Traefik streams them without
> buffering. No nginx reverse proxy is needed in this two-domain setup; the
> frontend's JS calls the backend subdomain directly over HTTPS.

### Prerequisites
- A Dokploy server running on your own VPS with a public IP.
- Two DNS **A records** pointing at your server IP:
  - `order.dev-link.cloud` → server IP
  - `order-tracker.dev-link.cloud` → server IP
- Ports 80/443 open on the server (Dokploy needs them for the Let's Encrypt
  challenge and for incoming traffic).

### Step 0 — Push to the public GitHub repo
Already done: https://github.com/atika-amjad/order-tracker (keep it **Public** —
a private repo = 0 marks). Future updates:
```bash
git push origin main
```

### Step 1 — Create the backend Application in Dokploy
1. Dokploy → **Applications** → **Create** → choose the **Dockerfile** source.
2. Connect your GitHub and select the **`order-tracker`** repo, branch `main`.
3. Set **Build Path / Source Directory** to `backend` (Dokploy builds
   `backend/Dockerfile`).
4. Set the exposed **Port** to `4000`.
5. Attach the domain `order.dev-link.cloud` (Dokploy auto-creates the Traefik
   route + the Let's Encrypt certificate).
6. Add **Environment Variables**:
   - `NODE_ENV` = `production`
   - `ALLOWED_ORIGINS` = `https://order-tracker.dev-link.cloud`
7. **Deploy**. Watch the build logs; once "Live", verify:
   `https://order.dev-link.cloud/health` → `{"status":"ok"}`.

### Step 2 — Create the frontend Application in Dokploy
1. **Applications** → **Create** → **Dockerfile** source → same repo/branch.
2. Set **Build Path / Source Directory** to `frontend` (builds `frontend/Dockerfile`).
3. Set the exposed **Port** to `80` (nginx inside the container).
4. Attach the domain `order-tracker.dev-link.cloud`.
5. Add a **Build Environment Variable** (must be present at BUILD time — Vite
   bakes `VITE_API_URL` into the static bundle; a runtime-only var would NOT
   affect it):
   - `VITE_API_URL` = `https://order.dev-link.cloud`
   > The Dockerfile already defaults the `ARG VITE_API_URL` to
   > `https://order.dev-link.cloud`, so even if your Dokploy version only
   > injects runtime vars, the build still produces a working bundle.
6. **Deploy**. Once "Live", open `https://order-tracker.dev-link.cloud`.

### Step 3 — Verify the two are wired together
- On the frontend page, the **SSE** and **WS** status dots in the header should
  be green.
- **Shop** → place an order (REST or GraphQL). It should appear live in
  **Orders → AlertFeed** via SSE, and updating its status should push a
  WebSocket `order:statusUpdate`.
- If the dots stay red, double-check the backend's `ALLOWED_ORIGINS` matches
  `https://order-tracker.dev-link.cloud` exactly (no trailing slash), and that
  the frontend was built with `VITE_API_URL=https://order.dev-link.cloud`.

---

## 🧪 Verifying the Live Deployment

Confirm each protocol against the **backend** domain `https://order.dev-link.cloud`:

```bash
BE=https://order.dev-link.cloud
curl $BE/health
curl $BE/api/v1/catalog
curl -X POST $BE/api/v1/orders -H "Content-Type: application/json" \
  -d '{"customerName":"Live Test","items":[{"productId":"p1","qty":1}]}'
curl -N $BE/events          # SSE stream (create an order in another shell)
curl -X POST $BE/graphql -H "Content-Type: application/json" \
  -d '{"query":"{ catalog { id name } }"}'
curl -X POST $BE/rpc -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"listOrders","id":1}'
```

For WebSockets, open `https://order-tracker.dev-link.cloud` → **Live Support**
in one window and the **Agent** tab in another; request and accept support,
then chat.

---

## 📝 Notes

- **In-memory store:** Data resets on every container restart/redeploy. This is
  intentional for a lab demo and avoids DB provisioning.
- **Self-hosted (Dokploy):** Both apps run on your own server behind Dokploy's
  Traefik, which auto-provisions HTTPS via Let's Encrypt. No free-tier cold
  starts — the app is always live (subject only to your server's uptime).
- **Mixed content:** Both domains are HTTPS (Traefik). The frontend's
  `VITE_API_URL` is the `https://` backend domain — never `http://`, or
  browsers block SSE/WebSocket.
- **CORS:** Set the backend `ALLOWED_ORIGINS` to exactly the frontend domain.
  For local dev, `ALLOWED_ORIGINS=*` is fine.
- **WebSocket/SSE through Traefik:** Supported natively. If an SSE stream ever
  stalls in a custom reverse-proxy setup, ensure response buffering is off
  (Traefik streams by default).
- **Node version:** `engines: node >=20`; the Docker images use `node:20`;
  `.nvmrc` pins `20` for local dev.

---

## 📜 License

This project is coursework for **CSC337 — Lab Assignment 04**.
