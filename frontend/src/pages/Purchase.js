import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  createProduct, updateProduct, getProducts,
  getProductByBarcode, searchProducts,
  createPurchaseBill, getPurchases, getVendors, createVendor, updateVendor,
  createPurchaseReturn
} from '../services/api';

const UNITS = ['nos', 'kg', 'carton'];
const fmt   = n => `₹${parseFloat(n || 0).toFixed(2)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Master Modal
// ─────────────────────────────────────────────────────────────────────────────
function VendorMasterModal({ onClose }) {
  const [vendors,  setVendors]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);

  const fetchVendors = async () => {
    setLoading(true);
    const { data } = await getVendors();
    setVendors(data);
    setLoading(false);
  };
  useEffect(() => { fetchVendors(); }, []);

  const toggleActive = async v => {
    try {
      await updateVendor(v.id, { is_active: !v.is_active });
      toast.success(`Vendor ${v.is_active ? 'disabled' : 'enabled'}`);
      fetchVendors();
    } catch { toast.error('Failed to update vendor'); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 700, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>🏪 Vendor Master</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>+ Add Vendor</button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        {loading ? <div className="spinner" /> : (
          <div style={{ overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: v.is_active ? 'var(--text)' : 'var(--text3)' }}>{v.name}</td>
                    <td style={{ color: 'var(--text3)' }}>{v.phone || '—'}</td>
                    <td><span className={`badge ${v.is_active ? 'badge-green' : 'badge-red'}`}>{v.is_active ? 'Active' : 'Disabled'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal(v)}>✏️ Edit</button>
                        <button className={`btn btn-sm ${v.is_active ? 'btn-danger' : 'btn-green'}`} onClick={() => toggleActive(v)}>
                          {v.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {vendors.length === 0 && <div className="empty-state"><div className="icon">🏪</div>No vendors yet</div>}
          </div>
        )}
        {modal && <VendorFormModal vendor={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={fetchVendors} />}
      </div>
    </div>
  );
}

function VendorFormModal({ vendor, onClose, onSaved }) {
  const [name,    setName]    = useState(vendor?.name  || '');
  const [phone,   setPhone]   = useState(vendor?.phone || '');
  const [loading, setLoading] = useState(false);
  const isEdit = !!vendor;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Vendor name required'); return; }
    setLoading(true);
    try {
      if (isEdit) { await updateVendor(vendor.id, { name, phone: phone || null }); toast.success('Vendor updated'); }
      else        { await createVendor({ name, phone: phone || null });             toast.success('Vendor created'); }
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.name?.[0] || 'Failed to save vendor');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <h2>{isEdit ? '✏️ Edit Vendor' : '+ Add Vendor'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vendor Name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fresh Foods Pvt Ltd" />
          </div>
          <div className="form-group">
            <label>Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9876543210" type="tel" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Saving…' : isEdit ? '✓ Update' : '✓ Create'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Master Modal — wider, no horizontal scroll
// ─────────────────────────────────────────────────────────────────────────────
function ProductMasterModal({ onClose }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(null);
  const [printing, setPrinting] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await getProducts();
    setProducts(data);
    setLoading(false);
  };
  useEffect(() => { fetchProducts(); }, []);

  const toggleActive = async p => {
    try {
      await updateProduct(p.id, { is_active: !p.is_active });
      toast.success(`Product ${p.is_active ? 'disabled' : 'enabled'}`);
      fetchProducts();
    } catch { toast.error('Failed to update product'); }
  };

  const printBarcode = p => {
    setPrinting(p);
    setTimeout(() => {
      let el = document.getElementById('barcode-print-area');
      if (!el) { el = document.createElement('div'); el.id = 'barcode-print-area'; document.body.appendChild(el); }
      el.innerHTML = `
        <div style="font-family:monospace;padding:20px;text-align:center;background:#fff;color:#000">
          <div style="font-size:16px;font-weight:700;margin-bottom:4px">${p.name}</div>
          <div style="font-size:13px;letter-spacing:4px;margin-bottom:4px">${p.barcode}</div>
          <div style="font-size:32px;letter-spacing:2px;font-weight:900;margin-bottom:4px">|||||||||||||||</div>
          <div style="font-size:14px;font-weight:600">${fmt(p.selling_price)}</div>
        </div>`;
      const root = document.getElementById('root');
      root.style.display = 'none';
      window.print();
      root.style.display = '';
      el.innerHTML = '';
      setPrinting(null);
    }, 200);
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)
  );

  return (
    <div className="modal-overlay">
      {/* FIX: maxWidth increased to 1100px so all columns are visible */}
      <div className="modal" style={{ maxWidth: 1100, width: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>📦 Product Master</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>+ Add Product</button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
          </div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search by name or barcode…" style={{ marginBottom: 16 }} />
        {loading ? <div className="spinner" /> : (
          <div style={{ overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>Barcode</th>
                  <th style={{ minWidth: 200 }}>Product Name</th>
                  <th style={{ minWidth: 120 }}>Selling Price</th>
                  <th style={{ minWidth: 80 }}>Unit</th>
                  <th style={{ minWidth: 100 }}>Stock</th>
                  <th style={{ minWidth: 80 }}>Status</th>
                  <th style={{ minWidth: 220, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                    <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.barcode}</span></td>
                    <td style={{ fontWeight: 600, color: p.is_active ? 'var(--text)' : 'var(--text3)' }}>{p.name}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(p.selling_price)}</td>
                    <td><span className="badge badge-blue">{p.selling_unit}</span></td>
                    <td style={{ fontFamily: 'var(--mono)' }}>
                      {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)}
                    </td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                        {p.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal(p)}>✏️ Edit</button>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => printBarcode(p)}
                          style={{ color: 'var(--purple)', borderColor: 'var(--purple)' }}
                          disabled={printing?.id === p.id}>
                          🖨️ Barcode
                        </button>
                        <button className={`btn btn-sm ${p.is_active ? 'btn-danger' : 'btn-green'}`} onClick={() => toggleActive(p)}>
                          {p.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty-state"><div className="icon">📦</div>No products found</div>}
          </div>
        )}
        {modal && (
          <ProductFormModal product={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={fetchProducts} />
        )}
      </div>
    </div>
  );
}

function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         product?.name    || '',
    barcode:      product?.barcode || '',
    auto_barcode: false,
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!product;

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name) { toast.error('Product name required'); return; }
    setLoading(true);
    try {
      const payload = { name: form.name };
      if (!isEdit) {
        if (!form.auto_barcode && form.barcode) payload.barcode = form.barcode;
        await createProduct(payload);
        toast.success('Product created');
      } else {
        await updateProduct(product.id, { name: form.name });
        toast.success('Product updated');
      }
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.barcode?.[0] || 'Failed to save product');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <h2>{isEdit ? '✏️ Edit Product' : '+ Add Product'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product Name *</label>
            <input
              autoFocus
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Chocolate Cake"
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
            />
          </div>
          {!isEdit && (
            <>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                  <input type="checkbox" checked={form.auto_barcode}
                    onChange={e => set('auto_barcode', e.target.checked)}
                    style={{ width: 'auto' }} />
                  Auto-generate Barcode
                </label>
              </div>
              {!form.auto_barcode && (
                <div className="form-group">
                  <label>Barcode (scan or enter manually)</label>
                  <input
                    value={form.barcode}
                    onChange={e => set('barcode', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                    placeholder="Scan barcode here…"
                    style={{ fontFamily: 'var(--mono)' }}
                  />
                </div>
              )}
            </>
          )}
          {isEdit && (
            <div className="form-group">
              <label>Barcode</label>
              <input value={form.barcode} readOnly
                style={{ fontFamily: 'var(--mono)', opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Saving…' : isEdit ? '✓ Update' : '✓ Create'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Purchase Return Modal
// ─────────────────────────────────────────────────────────────────────────────
function PurchaseReturnModal({ onClose }) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [product,   setProduct]   = useState(null);
  const [quantity,  setQuantity]  = useState('1');
  const [reason,    setReason]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const debounceRef  = useRef();
  const resultsRef   = useRef([]);
  resultsRef.current = results;

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { const { data } = await searchProducts(v); setResults(data); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const selectProduct = p => { setProduct(p); setQuery(''); setResults([]); setQuantity('1'); };

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
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error('Enter valid quantity'); return; }
    if (qty > parseFloat(product.stock_quantity)) { toast.error('Return quantity exceeds current stock'); return; }
    setLoading(true);
    try {
      await createPurchaseReturn({ product: product.id, quantity: qty, reason });
      toast.success(`Purchase return recorded for ${product.name}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record return');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2>↩️ Purchase Return</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
          Return product to vendor — stock will be reduced. Cost is fetched automatically from the last purchase record.
        </p>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Search / Scan Product</label>
          <input autoFocus value={query} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type product name…" />
          {searching && <div style={{ position: 'absolute', right: 14, top: 34, fontSize: 12, color: 'var(--text3)' }}>searching…</div>}
          {results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', marginTop: 2, overflow: 'hidden', boxShadow: 'var(--shadow)'
            }}>
              {results.map((p, i) => (
                <div key={`${p.id}-${i}`} onClick={() => selectProduct(p)} style={{
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
                    Stock: {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} {p.selling_unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {product && (
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{product.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{product.barcode}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                Current Stock: <b style={{ color: 'var(--green)' }}>
                  {parseFloat(product.stock_quantity).toFixed(product.selling_unit === 'kg' ? 3 : 0)} {product.selling_unit}
                </b>
              </div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setProduct(null)}>✕</button>
          </div>
        )}
        <div className="form-group">
          <label>Return Quantity {product ? `(${product.selling_unit})` : ''}</label>
          <input type="text" inputMode="decimal" value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onBlur={e => { const v = parseFloat(e.target.value); if (!v || v <= 0) setQuantity('1'); else setQuantity(String(v)); }}
            placeholder="e.g. 2 or 0.5" style={{ fontFamily: 'var(--mono)', fontSize: 16 }} />
        </div>
        <div className="form-group">
          <label>Reason for Return</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. Damaged during delivery, expired goods, wrong item…"
            rows={3} style={{ resize: 'vertical' }} />
        </div>
        <div style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 12, color: 'var(--blue)', marginBottom: 16 }}>
          ℹ️ Purchase cost will be auto-fetched from the last recorded purchase of this product.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleSubmit} disabled={loading || !product}>
            {loading ? 'Recording…' : '✓ Record Return'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Search Cell — FIX: dropdown uses fixed positioning to escape table overflow
// ─────────────────────────────────────────────────────────────────────────────
function ProductSearchCell({ value, onSelect }) {
  const [query,     setQuery]     = useState(value?.name || '');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [dropPos,   setDropPos]   = useState(null); // { top, left, width }
  const wrapRef      = useRef();
  const debounceRef  = useRef();
  const resultsRef   = useRef([]);
  resultsRef.current = results;

  const doSearch = useCallback(async q => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await searchProducts(q);
      // data is now batch rows — deduplicate by product name for purchase search
      // (we just want product, not per-batch rows here)
      const seen = new Set();
      const unique = data.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      setResults(unique);
      // Calculate dropdown position from wrapper element
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        setDropPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
      }
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  const pick = p => {
    setQuery(p.name); setResults([]); setDropPos(null); onSelect(p);
  };

  const handleKeyDown = async e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceRef.current);
      if (resultsRef.current.length > 0) { pick(resultsRef.current[0]); return; }
      const q = query.trim(); if (!q) return;
      try {
        const { data } = await getProductByBarcode(q);
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length > 0) pick(rows[0]);
      } catch { toast.error('Product not found'); }
    }
    if (e.key === 'Escape') { setResults([]); setDropPos(null); }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setResults([]); setDropPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 200 }}>
      <input value={query} onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder="Scan / search…" style={{ fontSize: 13, padding: '6px 10px', width: '100%' }} />
      {searching && (
        <div style={{ position: 'absolute', right: 8, top: 8, fontSize: 11, color: 'var(--text3)' }}>…</div>
      )}
      {/* FIX: use fixed portal-style positioning so dropdown escapes overflow:hidden table */}
      {results.length > 0 && dropPos && (
        <div style={{
          position: 'fixed',
          top:   dropPos.top,
          left:  dropPos.left,
          width: Math.max(dropPos.width, 320),
          zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
          maxHeight: 280, overflowY: 'auto',
        }}>
          {results.map(p => (
            <div key={p.id} onClick={() => pick(p)} style={{
              padding: '10px 14px', cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                  {fmt(p.selling_price)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Stock: {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} {p.selling_unit}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty row template
// ─────────────────────────────────────────────────────────────────────────────
const emptyRow = () => ({
  _id:            Date.now() + Math.random(),
  product:        null,
  purchase_unit:  'nos',
  quantity:       '',
  purchase_price: '',
  tax:            '0',
  current_mrp:    '',
  mrp:            '',
  selling_unit:   'nos',
  selling_qty:    '1',
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Purchase Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Purchase() {
  const [vendors,        setVendors]        = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [rows,           setRows]           = useState([emptyRow()]);
  const [loading,        setLoading]        = useState(false);
  const [isPaid,         setIsPaid]         = useState(true);   // ← NEW: payment status
  const [showProduct,    setShowProduct]    = useState(false);
  const [showVendor,     setShowVendor]     = useState(false);
  const [showPurReturn,  setShowPurReturn]  = useState(false);
  const [purchaseNumber, setPurchaseNumber] = useState('PO000001');

  // Fetch next purchase number on mount
  useEffect(() => {
    getPurchases().then(r => {
      const bills = r.data;
      if (bills.length > 0 && bills[0].purchase_number) {
        const last = bills[0].purchase_number;
        try {
          const num = parseInt(last.replace('PO', '')) + 1;
          setPurchaseNumber(`PO${String(num).padStart(6, '0')}`);
        } catch { setPurchaseNumber('PO000001'); }
      } else {
        setPurchaseNumber('PO000001');
      }
    }).catch(() => setPurchaseNumber('PO000001'));
  }, []);
  const fetchVendors = () => getVendors().then(r => setVendors(r.data));
  useEffect(() => { fetchVendors(); }, []);

  const updateRow = (id, field, value) =>
    setRows(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));

  const selectProduct = (id, product) =>
    setRows(prev => prev.map(r => r._id === id ? {
      ...r,
      product,
      current_mrp:  product.selling_price ? String(product.selling_price) : '—',
      mrp:          product.selling_price ? String(product.selling_price) : '',
      selling_unit: product.selling_unit  || 'nos',
    } : r));

  const addRow    = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = id => setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev);

  const handleSubmit = async () => {
    if (!selectedVendor) { toast.error('Please select a vendor'); return; }
    for (const row of rows) {
      if (!row.product)        { toast.error('Select a product for each row');     return; }
      if (!row.quantity)       { toast.error('Enter quantity for each row');        return; }
      if (!row.purchase_price) { toast.error('Enter purchase price for each row'); return; }
      if (!row.mrp)            { toast.error('Enter MRP for each row');            return; }
      if (!row.selling_qty || parseFloat(row.selling_qty) <= 0) {
        toast.error('Enter selling qty per purchase unit for each row'); return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        vendor:  selectedVendor,
        is_paid: isPaid,
        items: rows.map(r => ({
          product:        r.product.id,
          purchase_unit:  r.purchase_unit,
          quantity:       parseFloat(r.quantity),
          purchase_price: parseFloat(r.purchase_price),
          tax:            parseFloat(r.tax) || 0,
          mrp:            parseFloat(r.mrp),
          selling_unit:   r.selling_unit,
          selling_qty:    parseFloat(r.selling_qty) || 1,
        })),
      };
      await createPurchaseBill(payload);
      const paidStatus = isPaid ? 'Paid ✅' : 'Not Paid ⏳';
      toast.success(`Purchase ${purchaseNumber} recorded! Payment: ${paidStatus}`);
      setRows([emptyRow()]);
      setSelectedVendor('');
      setIsPaid(true);
      // Refresh purchase number for next bill
      getPurchases().then(r => {
        const bills = r.data;
        if (bills.length > 0 && bills[0].purchase_number) {
          const last = bills[0].purchase_number;
          try {
            const num = parseInt(last.replace('PO', '')) + 1;
            setPurchaseNumber(`PO${String(num).padStart(6, '0')}`);
          } catch { setPurchaseNumber('PO000002'); }
        }
      }).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record purchase');
    } finally { setLoading(false); }
  };

  const totalValue = rows.reduce((s, r) => {
    const qty   = parseFloat(r.quantity)       || 0;
    const price = parseFloat(r.purchase_price) || 0;
    const tax   = parseFloat(r.tax)            || 0;
    return s + (qty * price * (1 + tax / 100));
  }, 0);

  return (
    <div>
      <div className="page-header">
        <h1>📦 Purchase</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowPurReturn(true)}
            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
            ↩️ Purchase Return
          </button>
          <button className="btn btn-secondary" onClick={() => setShowVendor(true)}>
            🏪 Vendor Master
          </button>
          <button className="btn btn-secondary" onClick={() => setShowProduct(true)}>
            📦 Product Master
          </button>
        </div>
      </div>

     {/* Purchase Number + Vendor + Payment Status */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>

          {/* Purchase Number — auto generated, display only */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
              Purchase No.
            </div>
            <div style={{
              padding: '8px 16px', borderRadius: 'var(--radius)',
              background: 'var(--bg2)', border: '1px solid var(--border)',
              fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16,
              color: 'var(--accent)', letterSpacing: '0.04em',
            }}>
              {purchaseNumber}
            </div>
          </div>

          {/* Vendor selector */}
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <label>
              Vendor *
              {!selectedVendor && (
                <span style={{ color: 'var(--red)', marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  — required
                </span>
              )}
            </label>
            <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}
              style={{ borderColor: !selectedVendor ? 'var(--red)' : undefined }}>
              <option value="">— Select vendor —</option>
              {vendors.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.phone ? ` · ${v.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Payment status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
              Payment Status *
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '8px 16px', borderRadius: 'var(--radius)',
                border: `1px solid ${isPaid ? 'var(--green)' : 'var(--border)'}`,
                background: isPaid ? 'var(--green-dim)' : 'var(--bg3)',
                color: isPaid ? 'var(--green)' : 'var(--text2)',
                fontWeight: isPaid ? 700 : 400, transition: 'all 0.15s',
              }}>
                <input type="radio" name="payment_status" checked={isPaid}
                  onChange={() => setIsPaid(true)} style={{ width: 'auto', accentColor: 'var(--green)' }} />
                ✅ Paid
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '8px 16px', borderRadius: 'var(--radius)',
                border: `1px solid ${!isPaid ? 'var(--yellow)' : 'var(--border)'}`,
                background: !isPaid ? 'rgba(234,179,8,0.12)' : 'var(--bg3)',
                color: !isPaid ? 'var(--yellow)' : 'var(--text2)',
                fontWeight: !isPaid ? 700 : 400, transition: 'all 0.15s',
              }}>
                <input type="radio" name="payment_status" checked={!isPaid}
                  onChange={() => setIsPaid(false)} style={{ width: 'auto', accentColor: 'var(--yellow)' }} />
                ⏳ Not Paid
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase items table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Product</th>
                <th style={{ minWidth: 90 }}>Purchase Unit</th>
                <th style={{ minWidth: 80 }}>Qty</th>
                <th style={{ minWidth: 130 }}>Purchase Price (₹)</th>
                <th style={{ minWidth: 70 }}>Tax (%)</th>
                <th style={{ minWidth: 120 }}>Current MRP (₹)</th>
                <th style={{ minWidth: 120 }}>New MRP (₹)</th>
                <th style={{ minWidth: 90 }}>Selling Unit</th>
                <th style={{ minWidth: 110 }}>Qty per Unit</th>
                <th style={{ minWidth: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row._id}>
                  {/* Product — uses fixed-position dropdown */}
                  <td style={{ padding: '8px 10px' }}>
                    <ProductSearchCell value={row.product} onSelect={p => selectProduct(row._id, p)} />
                    {row.product && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3 }}>
                        {row.product.barcode}
                      </div>
                    )}
                  </td>

                  {/* Purchase unit */}
                  <td style={{ padding: '8px 6px' }}>
                    <select value={row.purchase_unit}
                      onChange={e => updateRow(row._id, 'purchase_unit', e.target.value)}
                      style={{ fontSize: 13, padding: '6px 8px' }}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>

                  {/* Quantity */}
                  <td style={{ padding: '8px 6px' }}>
                    <input type="number" value={row.quantity}
                      onChange={e => updateRow(row._id, 'quantity', e.target.value)}
                      placeholder="0" min="0" step="0.001"
                      style={{ fontSize: 13, padding: '6px 8px', textAlign: 'right' }} />
                  </td>

                  {/* Purchase price */}
                  <td style={{ padding: '8px 6px' }}>
                    <input type="number" value={row.purchase_price}
                      onChange={e => updateRow(row._id, 'purchase_price', e.target.value)}
                      placeholder="0.00" min="0" step="0.01"
                      style={{ fontSize: 13, padding: '6px 8px', textAlign: 'right' }} />
                  </td>

                  {/* Tax */}
                  <td style={{ padding: '8px 6px' }}>
                    <input type="number" value={row.tax}
                      onChange={e => updateRow(row._id, 'tax', e.target.value)}
                      placeholder="0" min="0" step="0.01"
                      style={{ fontSize: 13, padding: '6px 8px', textAlign: 'right' }} />
                  </td>

                  {/* Current MRP — read only */}
                  <td style={{ padding: '8px 6px' }}>
                    <div style={{
                      padding: '6px 10px', background: 'var(--bg2)',
                      borderRadius: 'var(--radius)', fontSize: 13,
                      fontFamily: 'var(--mono)', color: 'var(--text3)',
                      border: '1px solid var(--border)', textAlign: 'right',
                      minWidth: 80,
                    }}>
                      {row.current_mrp || '—'}
                    </div>
                  </td>

                  {/* New MRP — editable, highlighted orange if changed */}
                  <td style={{ padding: '8px 6px' }}>
                    <input type="number" value={row.mrp}
                      onChange={e => updateRow(row._id, 'mrp', e.target.value)}
                      placeholder="0.00" min="0" step="0.01"
                      style={{
                        fontSize: 13, padding: '6px 8px', textAlign: 'right',
                        borderColor: row.current_mrp && row.mrp && row.current_mrp !== '—' &&
                          parseFloat(row.mrp) !== parseFloat(row.current_mrp)
                          ? 'var(--accent)' : undefined,
                        color: row.current_mrp && row.mrp && row.current_mrp !== '—' &&
                          parseFloat(row.mrp) !== parseFloat(row.current_mrp)
                          ? 'var(--accent)' : undefined,
                      }} />
                    {row.current_mrp && row.mrp && row.current_mrp !== '—' &&
                      parseFloat(row.mrp) !== parseFloat(row.current_mrp) && (
                      <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>
                        ↑ was ₹{row.current_mrp}
                      </div>
                    )}
                  </td>

                  {/* Selling unit */}
                  <td style={{ padding: '8px 6px' }}>
                    <select value={row.selling_unit}
                      onChange={e => updateRow(row._id, 'selling_unit', e.target.value)}
                      style={{ fontSize: 13, padding: '6px 8px' }}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>

                  {/* Selling qty per purchase unit */}
                  <td style={{ padding: '8px 6px' }}>
                    <input type="number" value={row.selling_qty}
                      onChange={e => updateRow(row._id, 'selling_qty', e.target.value)}
                      placeholder="1" min="0.001" step="0.001"
                      title="How many selling units per purchase unit (e.g. 1 carton = 24 nos)"
                      style={{ fontSize: 13, padding: '6px 8px', textAlign: 'right' }} />
                    {row.quantity && row.selling_qty && (
                      <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2, textAlign: 'right' }}>
                        +{(parseFloat(row.quantity) * parseFloat(row.selling_qty)).toFixed(3)} {row.selling_unit}
                      </div>
                    )}
                  </td>

                  {/* Remove */}
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    <button className="btn btn-danger btn-sm"
                      onClick={() => removeRow(row._id)}
                      style={{ padding: '4px 8px' }}
                      disabled={rows.length === 1}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: add row + summary */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)'
        }}>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Add Item Row</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>
              {rows.length} item{rows.length !== 1 ? 's' : ''}
            </span>
            <div>
              <span style={{ color: 'var(--text3)', fontSize: 13, marginRight: 10 }}>
                Total Purchase Value (incl. tax)
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>
                {fmt(totalValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submit button — shows payment status */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
        
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}
          style={{ padding: '12px 32px', fontSize: 15 }}>
          {loading ? 'Saving…' : ' Record Purchase'}
        </button>
      </div>

      {showProduct   && <ProductMasterModal  onClose={() => setShowProduct(false)} />}
      {showVendor    && <VendorMasterModal   onClose={() => setShowVendor(false)} />}
      {showPurReturn && <PurchaseReturnModal onClose={() => setShowPurReturn(false)} />}
    </div>
  );
}