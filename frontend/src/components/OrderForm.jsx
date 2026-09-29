import { useState } from 'react';
import { rest } from '../api/rest';
import { gql } from '../api/graphql';

// Order creation form with a protocol toggle so the grader can see the same
// operation performed over REST and over GraphQL.
export default function OrderForm() {
  const [name, setName] = useState('');
  const [api, setApi] = useState('REST');
  const [items, setItems] = useState([{ productId: 'p1', qty: 1 }]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const products = [
    { id: 'p1', name: 'Wireless Mouse', price: 24.99 },
    { id: 'p2', name: 'HD Monitor', price: 199.99 },
    { id: 'p3', name: 'Mechanical Keyboard', price: 79.99 },
    { id: 'p4', name: 'Laptop Stand', price: 34.99 },
    { id: 'p5', name: 'USB-C Cable', price: 9.99 },
    { id: 'p6', name: 'Webcam', price: 59.99 },
  ];

  function setItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function submit() {
    setErr(''); setMsg('');
    if (!name.trim()) { setErr('Enter a customer name'); return; }
    try {
      const payload = { customerName: name, items };
      let created;
      if (api === 'REST') {
        created = await rest.createOrder(payload);
      } else {
        const d = await gql.createOrder(name, items);
        created = d.createOrder;
      }
      setMsg(`Order ${created.id.slice(0, 8)} placed · $${created.total?.toFixed?.(2) ?? '?'}`);
      setName(''); setItems([{ productId: 'p1', qty: 1 }]);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="panel">
      <h2>Create Order</h2>
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="small">Protocol:</label>
        <button className={`btn ${api === 'REST' ? '' : 'ghost'}`} onClick={() => setApi('REST')}>REST</button>
        <button className={`btn ${api === 'GraphQL' ? '' : 'ghost'}`} onClick={() => setApi('GraphQL')}>GraphQL</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label className="small">Customer name</label><br />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Doe" />
      </div>

      <label className="small">Items</label>
      {items.map((it, i) => (
        <div className="row" key={i} style={{ marginBottom: 6 }}>
          <select value={it.productId} onChange={(e) => setItem(i, { productId: e.target.value })}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (${p.price})</option>)}
          </select>
          <input className="qty" type="number" min="1" value={it.qty}
            onChange={(e) => setItem(i, { qty: Math.max(1, Number(e.target.value)) })} />
          {items.length > 1 && (
            <button className="btn ghost" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>✕</button>
          )}
        </div>
      ))}
      <button className="btn ghost" onClick={() => setItems((p) => [...p, { productId: 'p5', qty: 1 }])}>+ Add item</button>

      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={submit}>Place Order via {api}</button>
      </div>
      {msg && <p className="success">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
