import { useEffect, useState } from 'react';
import { getSocket } from './api/socket';
import NavBar from './components/NavBar';
import Catalog from './components/Catalog';
import OrderForm from './components/OrderForm';
import OrderTracker from './components/OrderTracker';
import AlertFeed from './components/AlertFeed';
import SupportChat from './components/SupportChat';
import AgentPanel from './components/AgentPanel';
import { useAlerts } from './context/AlertsContext';

export default function App() {
  const [tab, setTab] = useState('shop');
  const [socketConnected, setSocketConnected] = useState(false);
  const { connected: sseConnected } = useAlerts();

  useEffect(() => {
    const s = getSocket();
    const onConn = () => setSocketConnected(true);
    const onDisc = () => setSocketConnected(false);
    s.on('connect', onConn);
    s.on('disconnect', onDisc);
    if (s.connected) onConn();
    return () => { s.off('connect', onConn); s.off('disconnect', onDisc); };
  }, []);

  return (
    <div className="app">
      <h1>🛒 Order Tracker & Live Support</h1>
      <p className="subtitle">
        CSC337 Lab 04 · REST + GraphQL · JSON-RPC 2.0 · WebSocket (Socket.io) · SSE
        <span style={{ marginLeft: 12 }}>
          <span className={`status-dot ${sseConnected ? '' : 'off'}`} title="SSE" />SSE
          <span className={`status-dot ${socketConnected ? '' : 'off'}`} style={{ marginLeft: 10 }} title="WebSocket" />WS
        </span>
      </p>

      <NavBar tab={tab} setTab={setTab} />

      {tab === 'shop' && (
        <div className="grid grid-2">
          <Catalog />
          <OrderForm />
        </div>
      )}
      {tab === 'orders' && (
        <div className="grid grid-2">
          <OrderTracker />
          <AlertFeed />
        </div>
      )}
      {tab === 'support' && <SupportChat />}
      {tab === 'agent' && <AgentPanel />}
    </div>
  );
}
