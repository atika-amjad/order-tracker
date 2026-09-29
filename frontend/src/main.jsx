import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AlertsProvider } from './context/AlertsContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AlertsProvider>
      <App />
    </AlertsProvider>
  </React.StrictMode>,
);
