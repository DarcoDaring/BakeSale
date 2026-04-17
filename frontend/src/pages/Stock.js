import React, { useState, useEffect } from 'react';
import { getStockStatus } from '../services/api';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    getStockStatus().then(r => { setProducts(r.data); setLoading(false); });
  }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    if (filter === 'in_stock') return matchSearch && p.stock_quantity > 0;
    if (filter === 'out_of_stock') return matchSearch && p.stock_quantity === 0;
    if (filter === 'low_stock') return matchSearch && p.stock_quantity > 0 && p.stock_quantity <= 5;
    if (filter === 'damaged') return matchSearch && p.damaged_quantity > 0;
    if (filter === 'expired') return matchSearch && p.expired_quantity > 0;
    return matchSearch;
  });

  const totalProducts = products.length;
  const outOfStock = products.filter(p => p.stock_quantity === 0).length;
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
  const totalDamaged = products.reduce((s, p) => s + p.damaged_quantity, 0);
  const totalExpired = products.reduce((s, p) => s + p.expired_quantity, 0);

  return (
    <div>
      <div className="page-header">
        <h1>🗃️ Stock Status</h1>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Products', value: totalProducts, color: 'var(--text)' },
          { label: 'Out of Stock', value: outOfStock, color: 'var(--red)' },
          { label: 'Low Stock (≤5)', value: lowStock, color: 'var(--yellow)' },
          { label: 'Damaged Units', value: totalDamaged, color: 'var(--accent)' },
          { label: 'Expired Units', value: totalExpired, color: 'var(--purple)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="label">{s.label}</div>
            <div className="value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products…" style={{ maxWidth: 280 }} />
        {[
          { k: 'all', l: 'All' }, { k: 'in_stock', l: '✅ In Stock' },
          { k: 'out_of_stock', l: '❌ Out of Stock' }, { k: 'low_stock', l: '⚠️ Low Stock' },
          { k: 'damaged', l: '🔧 Damaged' }, { k: 'expired', l: '🗑️ Expired' },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} className="btn btn-sm" style={{
            background: filter === f.k ? 'var(--accent-dim)' : 'var(--surface)',
            color: filter === f.k ? 'var(--accent)' : 'var(--text2)',
            border: `1px solid ${filter === f.k ? 'var(--accent)' : 'var(--border)'}`,
          }}>{f.l}</button>
        ))}
      </div>

      {loading ? <div className="spinner" /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr><th>Barcode</th><th>Product Name</th><th>Selling Price</th><th>Stock</th><th>Damaged</th><th>Expired</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.barcode}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</td>
                  <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(p.selling_price)}</td>
                  <td>
                    <span className={`badge ${p.stock_quantity === 0 ? 'badge-red' : p.stock_quantity <= 5 ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td><span className={`badge ${p.damaged_quantity > 0 ? 'badge-orange' : ''}`} style={{ color: p.damaged_quantity > 0 ? undefined : 'var(--text3)' }}>{p.damaged_quantity}</span></td>
                  <td><span className={`badge ${p.expired_quantity > 0 ? 'badge-purple' : ''}`} style={{ color: p.expired_quantity > 0 ? undefined : 'var(--text3)' }}>{p.expired_quantity}</span></td>
                  <td>
                    {p.stock_quantity === 0
                      ? <span className="badge badge-red">Out of Stock</span>
                      : p.stock_quantity <= 5
                      ? <span className="badge badge-yellow">Low Stock</span>
                      : <span className="badge badge-green">In Stock</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="icon">🗃️</div>No products match</div>}
        </div>
      )}
    </div>
  );
}
