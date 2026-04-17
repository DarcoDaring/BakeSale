import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getStockStatus, searchProducts, getProductByBarcode,
  createStockAdjustment
} from '../services/api';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;
const LOW_STOCK_THRESHOLD = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Pending Stock Modal
// ─────────────────────────────────────────────────────────────────────────────
function PendingStockModal({ onClose }) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [product,   setProduct]   = useState(null);
  const [physQty,   setPhysQty]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const debounceRef = useRef();
  const resultsRef  = useRef([]);
  resultsRef.current = results;

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await searchProducts(v);
        // deduplicate
        const seen = new Set();
        setResults(data.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const selectProduct = p => {
    setProduct(p);
    setQuery('');
    setResults([]);
    setPhysQty('');
  };

  const handleKeyDown = async e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceRef.current);
      if (resultsRef.current.length > 0) { selectProduct(resultsRef.current[0]); return; }
      const q = query.trim(); if (!q) return;
      try {
        const { data } = await getProductByBarcode(q);
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length > 0) selectProduct(rows[0]);
      } catch { toast.error('Product not found'); }
    }
    if (e.key === 'Escape') { setResults([]); setQuery(''); }
  };

  const handleSubmit = async () => {
    if (!product) { toast.error('Select a product'); return; }
    const phys = parseFloat(physQty);
    if (isNaN(phys) || phys < 0) { toast.error('Enter a valid physical stock number'); return; }
    const systemStock = parseFloat(product.stock_quantity);
    
    setLoading(true);
    try {
      await createStockAdjustment({
        product:        product.id,
        system_stock:   systemStock,
        physical_stock: phys,
      
      });
      toast.success('Stock adjustment request submitted for admin approval');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally { setLoading(false); }
  };



  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <h2>📋 Opening Stock / Adjust Stock</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
          Scan or search a product, verify physical stock, and submit for admin approval.
        </p>

        {/* Product search */}
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Scan / Search Product</label>
          <input autoFocus value={query} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type product name…" />
          {searching && (
            <div style={{ position: 'absolute', right: 14, top: 34, fontSize: 12, color: 'var(--text3)' }}>
              searching…
            </div>
          )}
          {results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', marginTop: 2, overflow: 'hidden', boxShadow: 'var(--shadow)'
            }}>
              {results.map(p => (
                <div key={p.id} onClick={() => selectProduct(p)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
                  </div>
                  <span className="badge badge-blue">
                    System: {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} {p.selling_unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected product */}
        {product && (
          <>
            <div style={{
              background: 'var(--bg3)', borderRadius: 'var(--radius)',
              padding: 14, marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{product.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{product.barcode}</div>
                
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => { setProduct(null); setPhysQty(''); }}>✕</button>
            </div>

            {/* Physical stock input */}
            <div className="form-group">
              <label>Actual Count ({product.selling_unit})</label>
              <input
                type="number" step="0.001" min="0"
                value={physQty}
                onChange={e => setPhysQty(e.target.value)}
                style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }}
                placeholder="Enter actual count…"
              />
            </div>

            

            

            
          </>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSubmit}
            disabled={loading || !product || physQty === '' || isNaN(parseFloat(physQty)) || parseFloat(physQty) < 0}>
            {loading ? 'Submitting…' : '📤 Submit for Approval'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Stock Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Stock() {
  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState('');
  const [showPending,    setShowPending]    = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getStockStatus();
      setProducts(data);
    } catch { toast.error('Failed to load stock'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search)
  );

  const totalProducts  = products.length;
  const outOfStock     = products.filter(p => parseFloat(p.stock_quantity) <= 0).length;
  const lowStock       = products.filter(p => {
    const qty = parseFloat(p.stock_quantity);
    return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
  }).length;

  return (
    <div>
      <div className="page-header">
        <h1>📦 Stock</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchStock}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowPending(true)}
            style={{ background: 'var(--accent)', color: '#fff' }}>
            📋 Opening Stock
          </button>
        </div>
      </div>

      {/* Simplified stat cards — only 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="label">Total Products</div>
          <div className="value" style={{ color: 'var(--accent)' }}>{totalProducts}</div>
        </div>
        <div className="stat-card" style={{
          cursor: outOfStock > 0 ? 'pointer' : 'default',
          border: outOfStock > 0 ? '1px solid var(--red)' : undefined,
        }}>
          <div className="label">Out of Stock</div>
          <div className="value" style={{ color: outOfStock > 0 ? 'var(--red)' : 'var(--text3)' }}>
            {outOfStock}
          </div>
        </div>
        <div className="stat-card" style={{
          cursor: lowStock > 0 ? 'pointer' : 'default',
          border: lowStock > 0 ? '1px solid var(--yellow)' : undefined,
        }}>
          <div className="label">Low Stock (≤{LOW_STOCK_THRESHOLD})</div>
          <div className="value" style={{ color: lowStock > 0 ? 'var(--yellow)' : 'var(--text3)' }}>
            {lowStock}
          </div>
        </div>
      </div>

      {/* Search + table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍  Search by name or barcode…" />
        </div>
        {loading ? <div className="spinner" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>MRP</th>
                  <th>Status</th>
                  <th>Batches</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const qty      = parseFloat(p.stock_quantity);
                  const isOut    = qty <= 0;
                  const isLow    = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
                  const batches  = p.batches || [];
                  return (
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                      <td>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.barcode}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</td>
                      <td><span className="badge badge-blue">{p.selling_unit}</span></td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--mono)', fontWeight: 700,
                          color: isOut ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)',
                        }}>
                          {qty.toFixed(p.selling_unit === 'kg' ? 3 : 0)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                        {fmt(p.selling_price)}
                      </td>
                      <td>
                        {isOut
                          ? <span className="badge badge-red">Out of Stock</span>
                          : isLow
                          ? <span className="badge badge-yellow">Low Stock</span>
                          : <span className="badge badge-green">In Stock</span>
                        }
                      </td>
                      <td>
                        {batches.filter(b => parseFloat(b.quantity) > 0).length > 1 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {batches.filter(b => parseFloat(b.quantity) > 0).map(b => (
                              <span key={b.id} style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                                ₹{parseFloat(b.mrp).toFixed(2)} × {parseFloat(b.quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <div className="icon">📦</div>
                {search ? `No products matching "${search}"` : 'No products in stock'}
              </div>
            )}
          </div>
        )}
      </div>

      {showPending && <PendingStockModal onClose={() => { setShowPending(false); fetchStock(); }} />}
    </div>
  );
}