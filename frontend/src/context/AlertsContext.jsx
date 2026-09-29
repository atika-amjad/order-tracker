import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { openSSE } from '../api/sse';

const AlertsContext = createContext({ alerts: [], connected: false });

// Provides SSE-driven alerts to the whole app. Also surfaces the SSE
// connection status so the AlertFeed can show a live indicator.
export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const es = openSSE({
      onHello: () => setConnected(true),
      onAlert: (a) => setAlerts((prev) => [{ ...a, uid: Math.random().toString(36).slice(2) }, ...prev].slice(0, 50)),
      onOrder: () => setConnected(true), // any order event means the stream is live
      onError: () => setConnected(false),
    });
    esRef.current = es;
    return () => es.close();
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, connected, clear: () => setAlerts([]) }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  return useContext(AlertsContext);
}
