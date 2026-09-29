import { useAlerts } from '../context/AlertsContext';

export default function AlertFeed() {
  const { alerts, connected, clear } = useAlerts();
  return (
    <div className="panel">
      <div className="row">
        <h2 style={{ marginBottom: 0 }}>Live Alerts</h2>
        <span className={`status-dot ${connected ? '' : 'off'}`} />
        <span className="small muted">{connected ? 'connected' : 'connecting…'}</span>
        <span className="tag" style={{ marginLeft: 'auto' }}>SSE /events</span>
      </div>
      <p className="small muted">Server-Sent Events push live system alerts in real time. Trigger one by creating or cancelling an order on the Shop/Orders tabs.</p>
      {alerts.length > 0 && <button className="btn ghost" onClick={clear} style={{ marginTop: 6 }}>Clear</button>}
      <div style={{ marginTop: 8 }}>
        {alerts.length === 0 && <p className="empty">No alerts yet. Create or update an order to see one appear here.</p>}
        {alerts.map((a) => (
          <div className="alert" key={a.uid}>
            <div className="row">
              <span className="a-type">{a.type}</span>
              <span className="a-ts">{new Date(a.ts).toLocaleTimeString()}</span>
              {a.orderId && <span className="tag">order {a.orderId.slice(0, 8)}</span>}
            </div>
            <div className="small">{a.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
