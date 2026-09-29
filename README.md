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

## 🔗 Live URLs (fill in after you deploy)

| Service | URL |
|---------|-----|
| **Backend (Render)** | `https://<your-backend-name>.onrender.com` |
| **Frontend (Vercel)** | `https://<your-frontend>.vercel.app` |
| **GitHub repository** | `https://github.com/<your-github-username>/order-tracker` |

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
│   ├── package.json  .env.example  render.yaml  .nvmrc  server.js
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
    ├── package.json  vercel.json  .env.example  vite.config.js  index.html
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
git clone https://github.com/<your-github-username>/order-tracker.git
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

## ☁️ Deployment

The app is split into two deployable units: **backend → Render**, **frontend → Vercel**.
Config files (`backend/render.yaml`, `frontend/vercel.json`) are already included.

> ⚠️ **You must perform the actual deploy with your own accounts** — I cannot
> access Render/Vercel/GitHub. The steps below are copy-paste ready. After
> deploying, paste the live URLs into the table at the top of this README.

### Step 0 — Push to a public GitHub repository

```bash
# from the project root
git init
git add .
git commit -m "CSC337 Lab 04: Real-Time Order Tracker & Live Support System"
# create an empty PUBLIC repo on GitHub named "order-tracker", then:
git branch -M main
git remote add origin https://github.com/<your-github-username>/order-tracker.git
git push -u origin main
# ⚠️ ensure the repo is PUBLIC — a private repo = 0 marks per the assignment.
```

### Step 1 — Deploy the backend to Render

1. Go to <https://dashboard.render.com> → **New +** → **Web Service**.
2. Connect your GitHub account and select the **`order-tracker`** repo.
3. Render reads `backend/render.yaml`. Confirm:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Add an environment variable (Environment tab):
   - `NODE_ENV` = `production`
   - `ALLOWED_ORIGINS` = *(leave empty for now — set in Step 3 after the frontend URL exists)*
5. Click **Create Web Service**. Wait for the build + "Live" status.
6. Note the backend URL, e.g. `https://order-tracker-backend.onrender.com`.
7. Verify: open `https://<backend>.onrender.com/health` → `{"status":"ok"}`,
   and `https://<backend>.onrender.com/graphql` → GraphiQL UI.

> Render's free tier spins down after inactivity; the first request after idle
> may take ~30–60s to wake. That is expected (see [Notes](#-notes)).

### Step 2 — Deploy the frontend to Vercel

1. Go to <https://vercel.com> → **Add New…** → **Project**.
2. Import the **`order-tracker`** repo. Vercel reads `frontend/vercel.json`. Set:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add an **Environment Variable** (Project → Settings → Environment Variables):
   - `VITE_API_URL` = `https://order-tracker-backend.onrender.com` *(your Render URL)*
4. Click **Deploy**. Once finished, note the URL, e.g.
   `https://order-tracker.vercel.app`.

### Step 3 — Lock down CORS (wire the two together)

1. Back in Render, edit the backend's environment variable:
   - `ALLOWED_ORIGINS` = `https://order-tracker.vercel.app` *(your Vercel URL)*
2. Trigger a redeploy (or it applies on next service restart).
3. Open the Vercel URL — the SSE dot (green) and WS dot (green) in the header
   should light up; create an order and watch it appear in the AlertFeed.

### Step 4 — Update the README live-URL table

Paste your final URLs into the **Live URLs** table at the top of this file,
commit, and push:
```bash
git add README.md && git commit -m "docs: add live deployment URLs" && git push
```

---

## 🧪 Verifying the Live Deployment

Once deployed, confirm each protocol against the **backend** Render URL:

```bash
BE=https://order-tracker-backend.onrender.com
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

For WebSockets, open the Vercel frontend → **Live Support** tab in one window and
the **Agent** tab in another; request and accept support, then chat.

---

## 📝 Notes

- **In-memory store:** Data resets on every server restart/redeploy. This is
  intentional for a lab demo and avoids DB provisioning on free tiers.
- **Render free-tier cold starts:** The backend sleeps after ~15 min idle. The
  first request wakes it (~30–60s). For a smoother grading experience, "ping"
  the `/health` URL shortly before submitting.
- **Mixed content:** Both services use HTTPS. Always set `VITE_API_URL` to the
  `https://` Render URL (never `http://`), or browsers block SSE/WebSocket.
- **Sticky sessions:** A single Render instance keeps WebSocket sessions stable.
  Scaling to multiple instances would require a sticky-session load balancer or
  a Redis adapter (out of scope for this lab).
- **Node version:** `engines: node >=20`; `.nvmrc` pins `20` for both apps.

---

## 📜 License

This project is coursework for **CSC337 — Lab Assignment 04**.
