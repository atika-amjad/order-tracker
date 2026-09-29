// Server-Sent Events client for /events. Returns the EventSource so the
// caller can close it. Pass callbacks for 'alert' and 'order' events.
import { API_URL } from '../config';

export function openSSE({ onAlert, onOrder, onHello, onError }) {
  const url = `${API_URL}/events`;
  const es = new EventSource(url);

  es.addEventListener('hello', (e) => onHello && onHello(JSON.parse(e.data)));
  es.addEventListener('alert', (e) => onAlert && onAlert(JSON.parse(e.data)));
  es.addEventListener('order', (e) => onOrder && onOrder(JSON.parse(e.data)));
  es.onerror = (err) => onError && onError(err);

  return es;
}
