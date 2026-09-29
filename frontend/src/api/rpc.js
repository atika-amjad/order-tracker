// JSON-RPC 2.0 client for /rpc. Supports single calls; id auto-increments.
import { API_URL } from '../config';

let nextId = 1;

export async function rpc(method, params, opts = {}) {
  const id = opts.id !== undefined ? opts.id : nextId++;
  const body = { jsonrpc: '2.0', method, params: params || {}, id };
  const res = await fetch(`${API_URL}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 204) return null; // notification acknowledgement
  const data = await res.json();
  if (data.error) throw new Error(`RPC ${data.error.code}: ${data.error.message}`);
  return data.result;
}

// Send a notification (no id -> server must not reply).
export async function rpcNotify(method, params) {
  const res = await fetch(`${API_URL}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params: params || {} }),
  });
  return res.status === 204;
}
