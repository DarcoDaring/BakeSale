import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  createProduct, updateProduct, getProducts,
  getProductByBarcode, searchProducts,
  createPurchaseBill, getPurchases, getVendors, createVendor, updateVendor,
  createPurchaseReturn
} from '../services/api';
import { usePermissions } from '../context/PermissionContext';
const UNITS = ['nos', 'kg', 'case'];
const fmt   = n => `₹${parseFloat(n || 0).toFixed(2)}`;

// Remove spinner arrows AND mousewheel from number inputs
const noArrow = e => {
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
};
const noWheel = e => e.target.blur(); // blur on scroll so mousewheel doesn't change value

function VendorMasterModal({ onClose }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

  const fetchVendors = async () => {
    setLoading(true);
    const { data } = await getVendors();
    setVendors(data); setLoading(false);
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
              <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
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
  const [name, setName]     = useState(vendor?.name  || '');
  const [phone, setPhone]   = useState(vendor?.phone || '');
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
    } catch (err) { toast.error(err.response?.data?.name?.[0] || 'Failed to save vendor'); }
    finally { setLoading(false); }
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

function ProductMasterModal({ onClose }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await getProducts();
    setProducts(data); setLoading(false);
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
    const win = window.open('', '_blank', 'width=560,height=520');
    if (!win) { toast.error('Popup blocked. Please allow popups.'); return; }
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Barcode - ${p.name}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        .controls { background: #fff; border-bottom: 1px solid #ddd; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
        .ctrl-group { display: flex; flex-direction: column; gap: 3px; }
        .ctrl-group label { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; }
        .ctrl-group input { padding: 5px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; width: 80px; }
        .btn-print { padding: 8px 20px; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-size: 13px; font-weight: 700; cursor: pointer; margin-top: 2px; }
        .preview { padding: 20px; display: flex; flex-wrap: wrap; gap: 10px; }
        .label-box { text-align: center; padding: 8px 10px; border: 1px solid #ccc; background: #fff; border-radius: 4px; }
        .prod-name { font-size: 11px; font-weight: 700; margin-bottom: 3px; word-break: break-word; }
        .price { font-size: 12px; font-weight: 800; margin-top: 3px; }
        @media print { .controls { display: none !important; } body { background: #fff; } .preview { padding: 0; gap: 0; } }
      </style>
    </head><body>
      <div class="controls">
        <div class="ctrl-group"><label>Copies</label><input type="number" id="copies" value="1" min="1" max="50" oninput="renderLabels()" /></div>
        <div class="ctrl-group"><label>Top (mm)</label><input type="number" id="topOffset" value="0" min="-50" max="100" oninput="renderLabels()" /></div>
        <div class="ctrl-group"><label>Left (mm)</label><input type="number" id="leftOffset" value="0" min="-50" max="100" oninput="renderLabels()" /></div>
        <div class="ctrl-group"><label>Width (mm)</label><input type="number" id="labelWidth" value="50" min="20" max="150" oninput="renderLabels()" /></div>
        <div class="ctrl-group"><label>BC Height</label><input type="number" id="bcHeight" value="50" min="20" max="120" oninput="renderLabels()" /></div>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
      </div>
      <div class="preview" id="preview"></div>
      <script>
        const barcode = "${p.barcode}";
        const name    = ${JSON.stringify(p.name)};
        const price   = "₹${parseFloat(p.selling_price || 0).toFixed(2)}";
        function renderLabels() {
          const copies   = Math.min(50, parseInt(document.getElementById('copies').value)    || 1);
          const top      = parseInt(document.getElementById('topOffset').value)  || 0;
          const left     = parseInt(document.getElementById('leftOffset').value) || 0;
          const width    = parseInt(document.getElementById('labelWidth').value) || 50;
          const bcHeight = parseInt(document.getElementById('bcHeight').value)   || 50;
          const preview  = document.getElementById('preview');
          preview.style.marginTop  = top  + 'mm';
          preview.style.marginLeft = left + 'mm';
          preview.innerHTML = '';
          for (let i = 0; i < copies; i++) {
            const box = document.createElement('div');
            box.className = 'label-box';
            box.style.width = width + 'mm';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('id', 'bc' + i);
            box.innerHTML = '<div class="prod-name">' + name + '</div>';
            box.appendChild(svg);
            box.innerHTML += '<div class="price">' + price + '</div>';
            const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgEl.setAttribute('id', 'bc' + i);
            box.insertBefore(svgEl, box.lastChild);
            preview.appendChild(box);
            JsBarcode('#bc' + i, barcode, { format: 'CODE128', width: 1.8, height: bcHeight, displayValue: true, fontSize: 10, margin: 3 });
          }
        }
        window.onload = renderLabels;
      <\/script>
    </body></html>`);
    win.document.close();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)
  );

  return (
    <div className="modal-overlay">
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
                    <td style={{ fontFamily: 'var(--mono)' }}>{parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)}</td>
                    <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>{p.is_active ? 'Active' : 'Disabled'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal(p)}>✏️ Edit</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => printBarcode(p)}
                          style={{ color: 'var(--purple)', borderColor: 'var(--purple)' }}>🖨️ Barcode</button>
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
        {modal && <ProductFormModal product={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={fetchProducts} />}
      </div>
    </div>
  );
}

function ProductFormModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({ name: product?.name || '', barcode: product?.barcode || '', auto_barcode: false });
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
        await createProduct(payload); toast.success('Product created');
      } else {
        await updateProduct(product.id, { name: form.name }); toast.success('Product updated');
      }
      onSaved(); onClose();
    } catch (err) { toast.error(err.response?.data?.barcode?.[0] || 'Failed to save product'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 420 }}>
        <h2>{isEdit ? '✏️ Edit Product' : '+ Add Product'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Product Name *</label>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Chocolate Cake" onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
          </div>
          {!isEdit && (
            <>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                  <input type="checkbox" checked={form.auto_barcode} onChange={e => set('auto_barcode', e.target.checked)} style={{ width: 'auto' }} />
                  Auto-generate Barcode
                </label>
              </div>
              {!form.auto_barcode && (
                <div className="form-group">
                  <label>Barcode (scan or enter manually)</label>
                  <input value={form.barcode} onChange={e => set('barcode', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                    placeholder="Scan barcode here…" style={{ fontFamily: 'var(--mono)' }} />
                </div>
              )}
            </>
          )}
          {isEdit && (
            <div className="form-group">
              <label>Barcode</label>
              <input value={form.barcode} readOnly style={{ fontFamily: 'var(--mono)', opacity: 0.6, cursor: 'not-allowed' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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

function PurchaseReturnModal({ onClose }) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [searching,setSearching]= useState(false);
  const [product,  setProduct]  = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [reason,   setReason]   = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vendors,  setVendors]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const debounceRef = useRef(); const resultsRef = useRef([]);
  resultsRef.current = results;

  useEffect(() => { getVendors().then(r => setVendors(r.data.filter(v => v.is_active))); }, []);

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { const { data } = await searchProducts(v); setResults(data); }
      catch { setResults([]); } finally { setSearching(false); }
    }, 300);
  };

  const selectProduct = p => { setProduct(p); setQuery(''); setResults([]); setQuantity('1'); };

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
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error('Enter valid quantity'); return; }
    if (qty > parseFloat(product.stock_quantity)) { toast.error('Return quantity exceeds current stock'); return; }
    setLoading(true);
    try {
      const payload = { product: product.id, quantity: qty, reason };
      if (vendorId) payload.vendor = vendorId;
      await createPurchaseReturn(payload);
      toast.success(`Purchase return recorded for ${product.name}`); onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record return'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2>↩️ Purchase Return</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Return product to vendor — stock will be reduced.</p>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Search / Scan Product</label>
          <input autoFocus value={query} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type product name…" />
          {searching && <div style={{ position: 'absolute', right: 14, top: 34, fontSize: 12, color: 'var(--text3)' }}>searching…</div>}
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 2, maxHeight: 220, overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
              {results.map((p, i) => (
                <div key={`${p.id}-${i}`} onClick={() => selectProduct(p)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
                  </div>
                  <span className="badge badge-blue">Stock: {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} {p.selling_unit}</span>
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
                Current Stock: <b style={{ color: 'var(--green)' }}>{parseFloat(product.stock_quantity).toFixed(product.selling_unit === 'kg' ? 3 : 0)} {product.selling_unit}</b>
              </div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setProduct(null)}>✕</button>
          </div>
        )}
        <div className="form-group">
          <label>Vendor (select if returning to specific vendor)</label>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)}>
            <option value="">— Select Vendor (optional) —</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>)}
          </select>
        </div>
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
            placeholder="e.g. Damaged during delivery…" rows={2} style={{ resize: 'vertical' }} />
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
// Product Search Cell — fixed-position dropdown, works with many items
// ─────────────────────────────────────────────────────────────────────────────
function ProductSearchCell({ value, onSelect }) {
  const [query,    setQuery]    = useState(value?.name || '');
  const [results,  setResults]  = useState([]);
  const [searching,setSearching]= useState(false);
  const [dropPos,  setDropPos]  = useState(null);
  const [open,     setOpen]     = useState(false);
  const wrapRef = useRef(); const debounceRef = useRef(); const resultsRef = useRef([]);
  resultsRef.current = results;

  const calcDrop = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: Math.max(rect.width, 320) });
    }
  }, []);

  const doSearch = useCallback(async q => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    try {
      const { data } = await searchProducts(q);
      const seen = new Set();
      const unique = data.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setResults(unique);
      setOpen(unique.length > 0);
      calcDrop();
    } catch { setResults([]); setOpen(false); } finally { setSearching(false); }
  }, [calcDrop]);

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  const pick = p => { setQuery(p.name); setResults([]); setOpen(false); onSelect(p); };

  const handleKeyDown = async e => {
    if (e.key === 'Enter') {
      e.preventDefault(); clearTimeout(debounceRef.current);
      if (resultsRef.current.length > 0) { pick(resultsRef.current[0]); return; }
      const q = query.trim(); if (!q) return;
      try {
        const { data } = await getProductByBarcode(q);
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length > 0) pick(rows[0]);
      } catch { toast.error('Product not found'); }
    }
    if (e.key === 'Escape') { setResults([]); setOpen(false); }
  };

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setResults([]); setOpen(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalculate drop position on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => calcDrop();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open, calcDrop]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 200 }}>
      <input value={query} onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder="Scan / search…" style={{ fontSize: 13, padding: '6px 10px', width: '100%' }} />
      {searching && <div style={{ position: 'absolute', right: 8, top: 8, fontSize: 11, color: 'var(--text3)' }}>…</div>}
      {open && results.length > 0 && dropPos && (
        <div style={{
          position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width,
          zIndex: 99999, background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', maxHeight: 260, overflowY: 'auto',
        }}>
          {results.map(p => (
            <div key={p.id} onMouseDown={() => pick(p)} style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{fmt(p.selling_price)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Stock: {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} {p.selling_unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyRow = () => ({
  _id: Date.now() + Math.random(),
  product: null, purchase_unit: 'nos',
  quantity: '', purchase_price: '', tax: '0', tax_type: 'excluding',
  total_qty: '', current_mrp: '', mrp: '', selling_unit: 'nos',
});

export default function Purchase() {
  const { isAdmin, can } = usePermissions();
  const [vendors,        setVendors]        = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [rows,           setRows]           = useState([emptyRow()]);
  const [loading,        setLoading]        = useState(false);
  const [isPaid,         setIsPaid]         = useState(true);
  const [purchaseNumber, setPurchaseNumber] = useState('PO000001');
  const [showProduct,    setShowProduct]    = useState(false);
  const [showVendor,     setShowVendor]     = useState(false);
  const [showPurReturn,  setShowPurReturn]  = useState(false);
  

  const refreshPurchaseNumber = () => {
    getPurchases().then(r => {
      const bills = r.data;
      if (bills.length > 0 && bills[0].purchase_number) {
        try {
          const num = parseInt(bills[0].purchase_number.replace('PO', '')) + 1;
          setPurchaseNumber(`PO${String(num).padStart(6, '0')}`);
        } catch { setPurchaseNumber('PO000001'); }
      } else { setPurchaseNumber('PO000001'); }
    }).catch(() => setPurchaseNumber('PO000001'));
  };

  useEffect(() => { refreshPurchaseNumber(); }, []);
  useEffect(() => { getVendors().then(r => setVendors(r.data)); }, []);

  const updateRow = (id, field, value) =>
    setRows(prev => prev.map(r => {
      if (r._id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'quantity' && updated.purchase_unit !== 'case') updated.total_qty = value;
      if (field === 'purchase_unit' && value !== 'case') updated.total_qty = updated.quantity;
      return updated;
    }));

  const selectProduct = (id, product) =>
    setRows(prev => prev.map(r => r._id === id ? {
      ...r, product,
      current_mrp:  product.selling_price ? String(product.selling_price) : '—',
      mrp:          product.selling_price ? String(product.selling_price) : '',
      selling_unit: product.selling_unit  || 'nos',
    } : r));

  const addRow    = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = id => setRows(prev => prev.length > 1 ? prev.filter(r => r._id !== id) : prev);

  // cost_per_item = base_purchase_price ÷ total_qty
  const getCostPerItem = row => {
    const qty      = parseFloat(row.quantity) || 0;
    const totalQty = parseFloat(row.total_qty) || 0;
    const basePrice = getBasePrice(row);
    if (!qty || !totalQty || !basePrice) return null;
    const totalPurchase = qty * basePrice;
    return totalPurchase / totalQty;
  };

  // Total value calculation:
  // Excluding: qty × price × (1 + tax/100)
  // Including: qty × price (tax already inside price)
  const getRowTotalValue = row => {
    const qty   = parseFloat(row.quantity) || 0;
    const price = parseFloat(row.purchase_price) || 0;
    const tax   = parseFloat(row.tax) || 0;
    if (row.tax_type === 'including') {
      return qty * price; // price already includes tax
    }
    return qty * price * (1 + tax / 100);
  };

  // Base price (excluding tax) — used for cost calculations
  const getBasePrice = row => {
    const price = parseFloat(row.purchase_price) || 0;
    const tax   = parseFloat(row.tax) || 0;
    if (row.tax_type === 'including') {
      return price / (1 + tax / 100); // extract base from inclusive price
    }
    return price;
  };

  const handleSubmit = async () => {
    if (!selectedVendor) { toast.error('Please select a vendor'); return; }
    for (const row of rows) {
      if (!row.product)        { toast.error('Select a product for each row'); return; }
      if (!row.quantity)       { toast.error('Enter quantity for each row'); return; }
      if (!row.purchase_price) { toast.error('Enter purchase price for each row'); return; }
      if (!row.mrp || parseFloat(row.mrp) <= 0) { toast.error('Enter MRP for each row'); return; }
      if (!row.total_qty || parseFloat(row.total_qty) <= 0) { toast.error('Enter total qty for each row'); return; }
    }
    setLoading(true);
    try {
      const payload = {
        vendor: selectedVendor, is_paid: isPaid,
        items: rows.map(r => {
          const qty        = parseFloat(r.quantity);
          const totalQty   = parseFloat(r.total_qty);
          const sellingQty = r.purchase_unit === 'case' ? (totalQty / qty) : 1;
          // If tax is including, store the base price (excl tax) in purchase_price
          const basePrice  = getBasePrice(r);
          return {
            product:        r.product.id,
            purchase_unit:  r.purchase_unit,
            quantity:       qty,
            purchase_price: parseFloat(basePrice.toFixed(4)),
            tax:            parseFloat(r.tax) || 0,
            tax_type:       r.tax_type,
            mrp:            parseFloat(r.mrp),
            selling_unit:   r.selling_unit,
            selling_qty:    sellingQty,
          };
        }),
      };
      await createPurchaseBill(payload);
      toast.success(`Purchase ${purchaseNumber} recorded! Payment: ${isPaid ? 'Paid ✅' : 'Not Paid ⏳'}`);
      setRows([emptyRow()]); setSelectedVendor(''); setIsPaid(true);
      refreshPurchaseNumber();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record purchase'); }
    finally { setLoading(false); }
  };

  const grandTotal = rows.reduce((s, r) => s + getRowTotalValue(r), 0);

  // Shared style for read-only number inputs (removes spinner arrows via CSS class)
  const numInputStyle = { fontSize: 13, padding: '6px 8px', textAlign: 'right' };
  const numInputProps = { onKeyDown: noArrow, onWheel: noWheel };

  return (
    <div>
      {/* Global CSS to remove spinner arrows */}
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className="page-header">
        <h1>📦 Purchase</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={refreshPurchaseNumber}>🔄 Refresh</button>
          {(isAdmin || can('can_access_purchase_return')) && (
            <button className="btn btn-secondary" onClick={() => setShowPurReturn(true)}
              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>↩️ Purchase Return</button>
          )}
          {(isAdmin || can('can_access_vendor_master')) && (
            <button className="btn btn-secondary" onClick={() => setShowVendor(true)}>🏪 Vendor Master</button>
          )}
          {(isAdmin || can('can_access_product_master')) && (
            <button className="btn btn-secondary" onClick={() => setShowProduct(true)}>📦 Product Master</button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>Purchase No.</div>
            <div style={{ padding: '8px 16px', borderRadius: 'var(--radius)', background: 'var(--bg2)', border: '1px solid var(--border)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: 'var(--accent)', letterSpacing: '0.04em' }}>
              {purchaseNumber}
            </div>
          </div>

          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}>
            <label>
              Vendor *
              {!selectedVendor && <span style={{ color: 'var(--red)', marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— required</span>}
            </label>
            <select value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}
              style={{ borderColor: !selectedVendor ? 'var(--red)' : undefined }}>
              <option value="">— Select vendor —</option>
              {vendors.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>{v.name}{v.phone ? ` · ${v.phone}` : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>Payment Status *</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 16px', borderRadius: 'var(--radius)', border: `1px solid ${isPaid ? 'var(--green)' : 'var(--border)'}`, background: isPaid ? 'var(--green-dim)' : 'var(--bg3)', color: isPaid ? 'var(--green)' : 'var(--text2)', fontWeight: isPaid ? 700 : 400, transition: 'all 0.15s' }}>
                <input type="radio" name="payment_status" checked={isPaid} onChange={() => setIsPaid(true)} style={{ width: 'auto', accentColor: 'var(--green)' }} />
                ✅ Paid
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 16px', borderRadius: 'var(--radius)', border: `1px solid ${!isPaid ? 'var(--yellow)' : 'var(--border)'}`, background: !isPaid ? 'rgba(234,179,8,0.12)' : 'var(--bg3)', color: !isPaid ? 'var(--yellow)' : 'var(--text2)', fontWeight: !isPaid ? 700 : 400, transition: 'all 0.15s' }}>
                <input type="radio" name="payment_status" checked={!isPaid} onChange={() => setIsPaid(false)} style={{ width: 'auto', accentColor: 'var(--yellow)' }} />
                ⏳ Not Paid
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 1500 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Product</th>
                <th style={{ minWidth: 90 }}>Purchase Unit</th>
                <th style={{ minWidth: 80 }}>Qty *</th>
                <th style={{ minWidth: 130 }}>Purchase Price (₹) *</th>
                <th style={{ minWidth: 120 }}>
                  Total Qty *
                  <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text3)', textTransform: 'none', letterSpacing: 0 }}>auto for nos/kg</div>
                </th>
                <th style={{ minWidth: 110 }}>Cost/Item (₹)</th>
                <th style={{ minWidth: 155 }}>Tax (%)</th>
                <th style={{ minWidth: 120 }}>Current MRP (₹)</th>
                <th style={{ minWidth: 120 }}>New MRP (₹) *</th>
                <th style={{ minWidth: 90 }}>Selling Unit</th>
                <th style={{ minWidth: 130 }}>Total Value (₹)</th>
                <th style={{ minWidth: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const costPerItem = getCostPerItem(row);
                const rowTotal    = getRowTotalValue(row);
                const isCase      = row.purchase_unit === 'case';
                const mrpChanged  = row.current_mrp && row.mrp && row.current_mrp !== '—' &&
                                    parseFloat(row.mrp) !== parseFloat(row.current_mrp);
                return (
                  <tr key={row._id}>
                    <td style={{ padding: '8px 10px' }}>
                      <ProductSearchCell value={row.product} onSelect={p => selectProduct(row._id, p)} />
                      {row.product && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3 }}>{row.product.barcode}</div>}
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <select value={row.purchase_unit} onChange={e => updateRow(row._id, 'purchase_unit', e.target.value)} style={{ fontSize: 13, padding: '6px 8px' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" value={row.quantity} onChange={e => updateRow(row._id, 'quantity', e.target.value)}
                        placeholder="0" min="0" step="0.001" style={numInputStyle} {...numInputProps} />
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" value={row.purchase_price} onChange={e => updateRow(row._id, 'purchase_price', e.target.value)}
                        placeholder="0.00" min="0" step="0.01" style={numInputStyle} {...numInputProps} />
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" value={row.total_qty}
                        onChange={e => isCase ? updateRow(row._id, 'total_qty', e.target.value) : undefined}
                        readOnly={!isCase} placeholder={isCase ? 'e.g. 24' : 'auto'}
                        min="0" step="0.001" style={{ ...numInputStyle, opacity: !isCase ? 0.55 : 1, cursor: !isCase ? 'not-allowed' : 'text', background: !isCase ? 'var(--bg2)' : undefined, borderColor: isCase ? 'var(--blue)' : undefined }}
                        {...numInputProps} />
                      {isCase && row.quantity && row.total_qty && (
                        <div style={{ fontSize: 10, color: 'var(--blue)', marginTop: 2, textAlign: 'right' }}>
                          {(parseFloat(row.total_qty) / parseFloat(row.quantity)).toFixed(2)} per case
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--green)', border: '1px solid var(--border)', textAlign: 'right', minWidth: 90, fontWeight: 600 }}>
                        {costPerItem !== null ? fmt(costPerItem) : '—'}
                      </div>
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" value={row.tax} onChange={e => updateRow(row._id, 'tax', e.target.value)}
                        placeholder="0" min="0" step="0.01" style={{ ...numInputStyle, marginBottom: 4 }} {...numInputProps} />
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {['excluding','including'].map(tt => (
                          <button key={tt} onClick={() => updateRow(row._id, 'tax_type', tt)}
                            style={{ flex: 1, fontSize: 10, padding: '3px 4px', borderRadius: 4, border: `1px solid ${row.tax_type === tt ? 'var(--accent)' : 'var(--border)'}`, background: row.tax_type === tt ? 'var(--accent-dim)' : 'var(--bg3)', color: row.tax_type === tt ? 'var(--accent)' : 'var(--text3)', cursor: 'pointer', fontWeight: row.tax_type === tt ? 700 : 400 }}>
                            {tt === 'excluding' ? 'Excl.' : 'Incl.'}
                          </button>
                        ))}
                      </div>
                      {row.tax_type === 'including' && parseFloat(row.tax) > 0 && parseFloat(row.purchase_price) > 0 && (
                        <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2, textAlign: 'right' }}>
                          Base: {fmt(getBasePrice(row))}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ padding: '6px 10px', background: 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--text3)', border: '1px solid var(--border)', textAlign: 'right', minWidth: 80 }}>
                        {row.current_mrp || '—'}
                      </div>
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <input type="number" value={row.mrp} onChange={e => updateRow(row._id, 'mrp', e.target.value)}
                        placeholder="0.00" min="0" step="0.01"
                        style={{ ...numInputStyle, borderColor: mrpChanged ? 'var(--accent)' : undefined, color: mrpChanged ? 'var(--accent)' : undefined }}
                        {...numInputProps} />
                      {mrpChanged && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2 }}>↑ was ₹{row.current_mrp}</div>}
                    </td>

                    <td style={{ padding: '8px 6px' }}>
                      <select value={row.selling_unit} onChange={e => updateRow(row._id, 'selling_unit', e.target.value)} style={{ fontSize: 13, padding: '6px 8px' }}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>

                    {/* Total Value = qty × purchase_price × (1 + tax%) */}
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ padding: '6px 10px', background: rowTotal > 0 ? 'var(--accent-dim)' : 'var(--bg2)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'var(--mono)', color: rowTotal > 0 ? 'var(--accent)' : 'var(--text3)', border: `1px solid ${rowTotal > 0 ? 'var(--accent)' : 'var(--border)'}`, textAlign: 'right', minWidth: 110, fontWeight: 700 }}>
                        {rowTotal > 0 ? fmt(rowTotal) : '—'}
                      </div>
                      {rowTotal > 0 && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, textAlign: 'right' }}>
                        {row.tax_type === 'including' ? 'qty × price (tax incl.)' : 'qty × price + tax'}
                      </div>}
                    </td>

                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => removeRow(row._id)} style={{ padding: '4px 8px' }} disabled={rows.length === 1}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Add Item Row</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
            <div>
              <span style={{ color: 'var(--text3)', fontSize: 13, marginRight: 10 }}>Grand Total (incl. tax)</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ padding: '12px 32px', fontSize: 15 }}>
          {loading ? 'Saving…' : '✓ Record Purchase'}
        </button>
      </div>

      {showProduct   && <ProductMasterModal  onClose={() => setShowProduct(false)} />}
      {showVendor    && <VendorMasterModal   onClose={() => setShowVendor(false)} />}
      {showPurReturn && <PurchaseReturnModal onClose={() => setShowPurReturn(false)} />}
    </div>
  );
}