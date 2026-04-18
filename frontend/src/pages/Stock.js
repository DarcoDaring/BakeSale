import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  getStockStatus, searchProducts, getProductByBarcode,
  createStockAdjustment, createStockTransfer
} from '../services/api';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;
const LOW_STOCK_THRESHOLD = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Pending Stock Modal
// ─────────────────────────────────────────────────────────────────────────────
function PendingStockModal({ onClose }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [searching,setSearching]= useState(false);
  const [product,  setProduct]  = useState(null);
  const [physQty,  setPhysQty]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const debounceRef = useRef(); const resultsRef = useRef([]);
  resultsRef.current = results;

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await searchProducts(v);
        const seen = new Set();
        setResults(data.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
  };

  const selectProduct = p => { setProduct(p); setQuery(''); setResults([]); setPhysQty(''); };

  const handleKeyDown = async e => {
    if (e.key === 'Enter') {
      e.preventDefault(); clearTimeout(debounceRef.current);
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
    if (isNaN(phys) || phys < 0) { toast.error('Enter a valid count'); return; }
    setLoading(true);
    try {
      await createStockAdjustment({
        product: product.id,
        system_stock: parseFloat(product.stock_quantity),
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
          Scan or search a product and submit actual count for admin approval.
        </p>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Scan / Search Product</label>
          <input autoFocus value={query} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type product name…" />
          {searching && <div style={{ position: 'absolute', right: 14, top: 34, fontSize: 12, color: 'var(--text3)' }}>searching…</div>}
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', marginTop: 2, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              {results.map(p => (
                <div key={p.id} onClick={() => selectProduct(p)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {product && (
          <>
            <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{product.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{product.barcode}</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => { setProduct(null); setPhysQty(''); }}>✕</button>
            </div>
            <div className="form-group">
              <label>Actual Count ({product.selling_unit})</label>
              <input type="number" step="0.001" min="0" value={physQty}
                onChange={e => setPhysQty(e.target.value)}
                style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }}
                placeholder="Enter actual count…" />
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
// Stock Transfer Modal
// ─────────────────────────────────────────────────────────────────────────────
function StockTransferModal({ onClose }) {
  const [rows, setRows]     = useState([emptyTransferRow()]);
  const [loading, setLoading] = useState(false);
  const debounceTimers = useRef({});

  function emptyTransferRow() {
    return {
      _id: Date.now() + Math.random(),
      query: '', results: [], searching: false,
      existingProduct: null,
      name: '', barcode: '', mrp: '', purchase_price: '', tax: '0', quantity: '',
      isNew: true,
    };
  }

  const updateRow = (id, field, value) =>
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));

  const selectExisting = (rowId, product) => {
    setRows(prev => prev.map(r => r._id === rowId ? {
      ...r, existingProduct: product, query: product.name, results: [], searching: false,
      name: product.name, barcode: product.barcode, mrp: String(product.selling_price), isNew: false,
    } : r));
  };

  const clearExisting = rowId => {
    setRows(prev => prev.map(r => r._id === rowId ? {
      ...r, existingProduct: null, query: '', results: [], name: '', barcode: '', mrp: '', isNew: true,
    } : r));
  };

  const doSearch = async (rowId, q) => {
    if (!q.trim()) { updateRow(rowId, 'results', []); return; }
    updateRow(rowId, 'searching', true);
    try {
      const { data } = await searchProducts(q);
      const seen = new Set();
      const unique = data.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setRows(prev => prev.map(r => r._id === rowId ? { ...r, results: unique, searching: false } : r));
    } catch {
      setRows(prev => prev.map(r => r._id === rowId ? { ...r, results: [], searching: false } : r));
    }
  };

  const handleBarcodeScan = async (rowId, barcode) => {
    if (!barcode.trim()) return;
    try {
      const { data } = await getProductByBarcode(barcode);
      const rows_data = Array.isArray(data) ? data : [data];
      if (rows_data.length > 0) selectExisting(rowId, rows_data[0]);
    } catch {}
  };

  const handleSubmit = async () => {
    for (const row of rows) {
      if (row.isNew && !row.name.trim()) { toast.error('Enter product name for each row'); return; }
      if (!row.mrp || parseFloat(row.mrp) <= 0) { toast.error('Enter MRP for each row'); return; }
      if (!row.quantity || parseFloat(row.quantity) <= 0) { toast.error('Enter quantity for each row'); return; }
    }
    setLoading(true);
    try {
      for (const row of rows) {
        const payload = {
          mrp:            parseFloat(row.mrp),
          purchase_price: parseFloat(row.purchase_price) || 0,
          tax:            parseFloat(row.tax) || 0,
          quantity:       parseFloat(row.quantity),
        };
        if (row.existingProduct) payload.product = row.existingProduct.id;
        else {
          payload.new_product_name = row.name.trim();
          if (row.barcode.trim()) payload.new_barcode = row.barcode.trim();
        }
        await createStockTransfer(payload);
      }
      toast.success(`Stock transfer complete — ${rows.length} item${rows.length > 1 ? 's' : ''} added`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.new_product_name?.[0] || 'Failed to transfer stock');
    } finally { setLoading(false); }
  };

  const handleQueryChange = (rowId, value) => {
    updateRow(rowId, 'query', value);
    clearTimeout(debounceTimers.current[rowId]);
    debounceTimers.current[rowId] = setTimeout(() => doSearch(rowId, value), 300);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 860, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>🔄 Stock Transfer</h2>
            <p style={{ color: 'var(--text3)', fontSize: 12, margin: '4px 0 0' }}>
              Import existing stock. Items created here will be searchable in future purchases.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {rows.map((row, idx) => (
            <div key={row._id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12, background: 'var(--bg3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 13 }}>Item {idx + 1}</span>
                {rows.length > 1 && (
                  <button className="btn btn-danger btn-sm" onClick={() => setRows(prev => prev.filter(r => r._id !== row._id))}>✕ Remove</button>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
                  Search Existing Product (or fill below to create new)
                </label>
                {!row.existingProduct ? (
                  <div style={{ position: 'relative' }}>
                    <input value={row.query}
                      onChange={e => handleQueryChange(row._id, e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (row.results.length > 0) { selectExisting(row._id, row.results[0]); return; }
                          await handleBarcodeScan(row._id, row.query);
                        }
                      }}
                      placeholder="Scan barcode or type to search…" style={{ fontSize: 13 }} />
                    {row.results.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 2, maxHeight: 180, overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
                        {row.results.map(p => (
                          <div key={p.id} onClick={() => selectExisting(row._id, p)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
                            </div>
                            <span className="badge badge-green">Existing</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--green)' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--green)' }}>✓ {row.existingProduct.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginLeft: 10 }}>{row.existingProduct.barcode}</span>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => clearExisting(row._id)}>✕ Clear</button>
                  </div>
                )}
              </div>

              {!row.existingProduct && (
                <div className="form-row" style={{ marginBottom: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Item Name *</label>
                    <input value={row.name} onChange={e => updateRow(row._id, 'name', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="e.g. Bread Slice" style={{ fontSize: 13 }} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Barcode (or leave blank to auto-generate)</label>
                    <input value={row.barcode} onChange={e => updateRow(row._id, 'barcode', e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder="Scan or leave blank" style={{ fontSize: 13, fontFamily: 'var(--mono)' }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>MRP (₹) *</label>
                  <input type="number" step="0.01" min="0" value={row.mrp}
                    onChange={e => updateRow(row._id, 'mrp', e.target.value)} placeholder="0.00" style={{ fontSize: 13 }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Purchase Price (₹)</label>
                  <input type="number" step="0.01" min="0" value={row.purchase_price}
                    onChange={e => updateRow(row._id, 'purchase_price', e.target.value)} placeholder="0.00" style={{ fontSize: 13 }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Tax (%)</label>
                  <input type="number" step="0.01" min="0" value={row.tax}
                    onChange={e => updateRow(row._id, 'tax', e.target.value)} placeholder="0" style={{ fontSize: 13 }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Quantity *</label>
                  <input type="number" step="0.001" min="0" value={row.quantity}
                    onChange={e => updateRow(row._id, 'quantity', e.target.value)} placeholder="0" style={{ fontSize: 13 }} />
                </div>
              </div>
            </div>
          ))}

          <button className="btn btn-secondary btn-sm" onClick={() => setRows(prev => [...prev, emptyTransferRow()])}>
            + Add Another Item
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSubmit} disabled={loading}>
            {loading ? 'Transferring…' : `✓ Transfer ${rows.length} Item${rows.length > 1 ? 's' : ''} to Stock`}
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
  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterTab,    setFilterTab]    = useState('all');
  const [showPending,  setShowPending]  = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try { const { data } = await getStockStatus(); setProducts(data); }
    catch { toast.error('Failed to load stock'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  // Filter by search text first
  const searchFiltered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)
  );

  // Then filter by tab
  const filtered = searchFiltered.filter(p => {
    const qty = parseFloat(p.stock_quantity);
    if (filterTab === 'all')      return true;
    if (filterTab === 'instock')  return qty > LOW_STOCK_THRESHOLD;
    if (filterTab === 'out')      return qty <= 0;
    if (filterTab === 'low')      return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
    if (filterTab === 'damaged')  return parseFloat(p.damaged_quantity) > 0;
    if (filterTab === 'expired')  return parseFloat(p.expired_quantity) > 0;
    return true;
  });

  const totalProducts = products.length;
  const outOfStock    = products.filter(p => parseFloat(p.stock_quantity) <= 0).length;
  const lowStock      = products.filter(p => { const q = parseFloat(p.stock_quantity); return q > 0 && q <= LOW_STOCK_THRESHOLD; }).length;

  const FILTER_TABS = [
    { k: 'all',      label: 'All',          count: products.length },
    { k: 'instock',  label: 'In Stock',     count: products.filter(p => parseFloat(p.stock_quantity) > LOW_STOCK_THRESHOLD).length },
    { k: 'low',      label: `Low Stock`,    count: lowStock },
    { k: 'out',      label: 'Out of Stock', count: outOfStock },
    { k: 'damaged',  label: 'Damaged',      count: products.filter(p => parseFloat(p.damaged_quantity) > 0).length },
    { k: 'expired',  label: 'Expired',      count: products.filter(p => parseFloat(p.expired_quantity) > 0).length },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>📦 Stock</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchStock}>🔄 Refresh</button>
          <button className="btn btn-secondary" onClick={() => setShowTransfer(true)}
            style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>
            🔄 Stock Transfer
          </button>
          <button className="btn btn-primary" onClick={() => setShowPending(true)}>
            📋 Opening Stock
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">Total Products</div>
          <div className="value" style={{ color: 'var(--accent)' }}>{totalProducts}</div>
        </div>
        <div className="stat-card" style={{ border: outOfStock > 0 ? '1px solid var(--red)' : undefined }}>
          <div className="label">Out of Stock</div>
          <div className="value" style={{ color: outOfStock > 0 ? 'var(--red)' : 'var(--text3)' }}>{outOfStock}</div>
        </div>
        <div className="stat-card" style={{ border: lowStock > 0 ? '1px solid var(--yellow)' : undefined }}>
          <div className="label">Low Stock (≤{LOW_STOCK_THRESHOLD})</div>
          <div className="value" style={{ color: lowStock > 0 ? 'var(--yellow)' : 'var(--text3)' }}>{lowStock}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(f => (
          <button key={f.k} onClick={() => setFilterTab(f.k)} className="btn btn-sm" style={{
            background: filterTab === f.k ? 'var(--accent)' : 'var(--surface)',
            color:      filterTab === f.k ? '#fff'          : 'var(--text2)',
            border:    `1px solid ${filterTab === f.k ? 'var(--accent)' : 'var(--border)'}`,
            fontWeight: filterTab === f.k ? 700 : 400,
          }}>
            {f.label}
            <span style={{
              marginLeft: 6, fontSize: 11, padding: '1px 6px',
              borderRadius: 10, background: filterTab === f.k ? 'rgba(255,255,255,0.25)' : 'var(--bg3)',
            }}>{f.count}</span>
          </button>
        ))}
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
                  <th>Barcode</th><th>Product</th><th>Unit</th>
                  <th>Stock</th><th>Damaged</th><th>Expired</th>
                  <th>MRP</th><th>Status</th><th>Batches</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const qty     = parseFloat(p.stock_quantity);
                  const damaged = parseFloat(p.damaged_quantity);
                  const expired = parseFloat(p.expired_quantity);
                  const isOut   = qty <= 0;
                  const isLow   = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
                  const batches = p.batches || [];
                  return (
                    <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.barcode}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</td>
                      <td><span className="badge badge-blue">{p.selling_unit}</span></td>
                      <td>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700,
                          color: isOut ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)' }}>
                          {qty.toFixed(p.selling_unit === 'kg' ? 3 : 0)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', color: damaged > 0 ? 'var(--red)' : 'var(--text3)' }}>
                        {damaged > 0 ? damaged.toFixed(p.selling_unit === 'kg' ? 3 : 0) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', color: expired > 0 ? 'var(--yellow)' : 'var(--text3)' }}>
                        {expired > 0 ? expired.toFixed(p.selling_unit === 'kg' ? 3 : 0) : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(p.selling_price)}</td>
                      <td>
                        {isOut ? <span className="badge badge-red">Out of Stock</span>
                          : isLow ? <span className="badge badge-yellow">Low Stock</span>
                          : <span className="badge badge-green">In Stock</span>}
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
                        ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state">
                <div className="icon">📦</div>
                {search ? `No products matching "${search}"` : `No products in "${FILTER_TABS.find(f => f.k === filterTab)?.label}" filter`}
              </div>
            )}
          </div>
        )}
      </div>

      {showPending  && <PendingStockModal  onClose={() => { setShowPending(false);  fetchStock(); }} />}
      {showTransfer && <StockTransferModal onClose={() => { setShowTransfer(false); fetchStock(); }} />}
    </div>
  );
}