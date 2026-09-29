// REST client for /api/v1.
import { API_URL } from '../config';

async function req(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.error) || res.statusText);
  return data;
}

export const rest = {
  health: () => req('/health'),
  listCatalog: () => req('/api/v1/catalog'),
  getProduct: (id) => req(`/api/v1/catalog/${id}`),
  listOrders: (status) => req(`/api/v1/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  getOrder: (id) => req(`/api/v1/orders/${id}`),
  createOrder: (body) => req('/api/v1/orders', { method: 'POST', body: JSON.stringify(body) }),
  updateOrderStatus: (id, status) => req(`/api/v1/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancelOrder: (id) => req(`/api/v1/orders/${id}`, { method: 'DELETE' }),
};
