import { useEffect, useState } from 'react';
import { rest } from '../api/rest';

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    try {
      setProducts(await rest.listCatalog());
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="panel">
      <h2>Catalog <span className="tag">REST /api/v1/catalog</span></h2>
      <button className="btn ghost" onClick={load}>↻ Refresh</button>
      {loading && <p className="muted">Loading…</p>}
      {err && <p className="error">{err}</p>}
      <div className="product-grid" style={{ marginTop: 8 }}>
        {products.map((p) => (
          <div className="product" key={p.id}>
            <strong>{p.name}</strong>
            <div className="small muted">{p.description}</div>
            <div className="price">${p.price.toFixed(2)}</div>
            <div className="stock">In stock: {p.stock}</div>
            <div className="tag">{p.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
