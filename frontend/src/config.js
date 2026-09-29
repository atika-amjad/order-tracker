// API base URL. In production this is the deployed Render backend URL set via
// the VITE_API_URL environment variable. In dev it defaults to the Vite proxy
// (empty string -> relative URLs proxied to the backend on :4000).
const raw = import.meta.env.VITE_API_URL;
export const API_URL = raw ? raw.replace(/\/$/, '') : '';

export const SOCKET_URL = raw
  ? raw.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:').replace(/\/$/, '')
  : ''; // empty -> same origin in dev (proxied)

// Fallback local backend for display when nothing is configured.
export const LOCAL_BACKEND = 'http://localhost:4000';
