import React, { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  searchProducts, getProductByBarcode, createBill,
  getBills, getBill, editBillPayment, deleteBill,
  getInternalMasters, createInternalSale,
  getDirectMasters, createDirectSale
} from '../services/api';
import PrintBill from '../components/PrintBill';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;

const payColor = {
  cash: 'badge-green', card: 'badge-blue', upi: 'badge-purple',
  cash_card: 'badge-yellow', cash_upi: 'badge-yellow',
};
const payLabel = {
  cash: '💵 Cash', card: '💳 Card', upi: '📱 UPI',
  cash_card: '💵+💳 Cash & Card', cash_upi: '💵+📱 Cash & UPI',
};

// ─────────────────────────────────────────────────────────────────────────────
// SearchBar — with keyboard arrow navigation
// ─────────────────────────────────────────────────────────────────────────────
function SearchBar({ onAdd }) {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputRef    = useRef();
  const debounceRef = useRef();
  const resultsRef  = useRef([]);
  resultsRef.current = results;

  const doSearch = useCallback(async q => {
    if (!q.trim()) { setResults([]); setHighlighted(-1); return; }
    setSearching(true);
    try {
      const { data } = await searchProducts(q);
      setResults(data);
      setHighlighted(-1);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleChange = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 300);
  };

  const selectProduct = useCallback(p => {
    const stock = parseFloat(p.stock_quantity);
    if (stock <= 0) { toast.error(`${p.name} is OUT OF STOCK`); return; }
    onAdd(p);
    setQuery(''); setResults([]); setHighlighted(-1);
    clearTimeout(debounceRef.current);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [onAdd]);

  const handleKeyDown = async e => {
    const cur = resultsRef.current;

    // Arrow navigation
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, cur.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
      return;
    }

    if (e.key === 'Escape') {
      setResults([]); setQuery(''); setHighlighted(-1);
      clearTimeout(debounceRef.current);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(debounceRef.current);

      // If a row is highlighted via arrow keys, select it
      if (highlighted >= 0 && highlighted < cur.length) {
        selectProduct(cur[highlighted]);
        return;
      }

      if (cur.length > 0) {
        const allSameProduct = cur.every(r => r.id === cur[0].id);
        if (cur.length === 1) {
          selectProduct(cur[0]);
        } else if (allSameProduct) {
          // Multiple batches — keep dropdown open for manual selection
        } else {
          selectProduct(cur[0]);
        }
        return;
      }

      // Barcode lookup
      const q = query.trim(); if (!q) return;
      try {
        const { data } = await getProductByBarcode(q);
        if (Array.isArray(data) && data.length > 0) {
          if (data.length === 1) {
            selectProduct(data[0]);
          } else {
            setResults(data); setHighlighted(-1);
          }
        } else {
          toast.error('Product not found');
        }
      } catch { toast.error('Product not found'); }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} value={query} onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder="🔍  Scan barcode or type product name… (↑↓ to navigate, Enter to select)"
        style={{ fontSize: 16, padding: '12px 16px' }} autoFocus />
      {searching && (
        <div style={{ position: 'absolute', right: 14, top: 14, color: 'var(--text3)', fontSize: 12 }}>searching…</div>
      )}
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', marginTop: 4, overflow: 'hidden', boxShadow: 'var(--shadow)'
        }}>
          {results.length > 1 && results.every(r => r.id === results[0].id) && (
            <div style={{ padding: '8px 14px', background: 'var(--accent-dim)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              🏷️ Multiple price batches — use ↑↓ to navigate, Enter to select
            </div>
          )}
          <table>
            <thead>
              <tr><th>Barcode</th><th>Product</th><th>Price</th><th>Stock</th></tr>
            </thead>
            <tbody>
              {results.map((p, i) => (
                <tr key={`${p.id}-${p.batch_id || i}`}
                  onClick={() => selectProduct(p)}
                  style={{
                    cursor: 'pointer',
                    background: highlighted === i ? 'var(--accent-dim)' : undefined,
                    outline: highlighted === i ? `2px solid var(--accent)` : undefined,
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  onMouseLeave={() => setHighlighted(-1)}>
                  <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{p.barcode}</span></td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                    {p.multi_batch && <div style={{ fontSize: 11, color: 'var(--accent)' }}>MRP: ₹{p.batch_mrp}</div>}
                  </td>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                  <td>
                    {parseFloat(p.stock_quantity) <= 0
                      ? <span className="badge badge-red">Out of Stock</span>
                      : <span className="badge badge-green">
                          {parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} {p.selling_unit || 'nos'}
                        </span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '6px 14px', background: 'var(--bg2)', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
            ↑↓ Navigate · Enter Select · Esc Close
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BillTable
// ─────────────────────────────────────────────────────────────────────────────
function BillTable({ items, onQtyChange, onRemove }) {
  const total = items.reduce((s, i) => s + i.price * (parseFloat(i.qty) || 0), 0);

  if (!items.length) return (
    <div className="empty-state" style={{ padding: '40px 0' }}>
      <div className="icon">🛒</div>
      <div>No items added. Scan or search a product above.</div>
    </div>
  );

  return (
    <div>
      <table>
        <thead>
          <tr><th>#</th><th>Product</th><th>Price</th><th>Qty / Weight</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item._key || item.id}>
              <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{item.barcode}</div>
                <div style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge ${item.selling_unit === 'kg' ? 'badge-blue' : item.selling_unit === 'case' ? 'badge-purple' : 'badge-orange'}`}>
                    per {item.selling_unit}
                  </span>
                  {item.multi_batch && <span className="badge badge-orange">MRP ₹{item.batch_mrp}</span>}
                  <span style={{ color: 'var(--text3)' }}>
                    stock: {parseFloat(item.stock).toFixed(item.selling_unit === 'kg' ? 3 : 0)} {item.selling_unit}
                  </span>
                </div>
              </td>
              <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(item.price)}</td>
              <td>
                {item.selling_unit === 'kg' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="text" inputMode="decimal" value={item.qty}
                      onChange={e => onQtyChange(item._key, e.target.value, true)}
                      onBlur={e => {
                        const v = parseFloat(e.target.value);
                        if (!v || v <= 0) onQtyChange(item._key, '1', true);
                        else if (v > item.stock) { toast.error('Not enough stock'); onQtyChange(item._key, String(item.stock), true); }
                        else onQtyChange(item._key, String(v), true);
                      }}
                      style={{ width: 90, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14, padding: '4px 8px' }} />
                    <span style={{ color: 'var(--text3)', fontSize: 13, minWidth: 20 }}>kg</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onQtyChange(item._key, -1)} style={{ padding: '2px 8px' }}>−</button>
                    <span style={{ fontFamily: 'var(--mono)', minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{item.qty}</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => onQtyChange(item._key, 1)} style={{ padding: '2px 8px' }}>+</button>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>{item.selling_unit}</span>
                  </div>
                )}
              </td>
              <td style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(item.price * (parseFloat(item.qty) || 0))}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => onRemove(item._key)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 14px', borderTop: '2px solid var(--accent)', marginTop: 8 }}>
        <div>
          <span style={{ color: 'var(--text3)', fontSize: 14, marginRight: 16 }}>TOTAL</span>
          <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PaymentModal
// ─────────────────────────────────────────────────────────────────────────────
function PaymentModal({ total, onClose, onConfirm }) {
  const [cashAmt,    setCashAmt]    = useState('');
  const [creditAmt,  setCreditAmt]  = useState('');
  const [creditType, setCreditType] = useState('card');

  const handleCashChange = e => {
    const c = e.target.value; setCashAmt(c);
    const rem = total - (parseFloat(c) || 0);
    setCreditAmt(rem > 0 ? rem.toFixed(2) : '0.00');
  };
  const handleCreditChange = e => {
    const k = e.target.value; setCreditAmt(k);
    const rem = total - (parseFloat(k) || 0);
    setCashAmt(rem > 0 ? rem.toFixed(2) : '0.00');
  };

  const cashVal   = parseFloat(cashAmt)   || 0;
  const creditVal = parseFloat(creditAmt) || 0;
  const splitOk   = Math.abs(cashVal + creditVal - total) < 0.01;

  const handleSplit = () => {
    if (!splitOk) { toast.error(`Amounts must sum to ${fmt(total)}`); return; }
    onConfirm(
      creditType === 'card' ? 'cash_card' : 'cash_upi',
      cashVal,
      creditType === 'card' ? creditVal : 0,
      creditType === 'upi'  ? creditVal : 0
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>💳 Select Payment Method</h2>
        <p style={{ color: 'var(--text3)', marginBottom: 20, fontSize: 14 }}>
          Total: <strong style={{ color: 'var(--accent)', fontSize: 20 }}>{fmt(total)}</strong>
        </p>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>Full Payment</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            { label: '💵 Cash', type: 'cash', rgb: '34,197,94', color: 'var(--green)' },
            { label: '💳 Card', type: 'card', rgb: '59,130,246', color: 'var(--blue)' },
            { label: '📱 UPI',  type: 'upi',  rgb: '168,85,247', color: 'var(--purple)' },
          ].map(p => (
            <button key={p.type}
              onClick={() => onConfirm(p.type, p.type==='cash'?total:0, p.type==='card'?total:0, p.type==='upi'?total:0)}
              className="btn" style={{ background: `rgba(${p.rgb},0.15)`, color: p.color, border: `1px solid ${p.color}`, justifyContent: 'center', padding: 16, fontSize: 15 }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 14 }}>Cash + Credit Split</p>
          <div className="form-group">
            <label>Credit Method</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[{ v: 'card', label: '💳 Card', color: 'var(--blue)' }, { v: 'upi', label: '📱 UPI', color: 'var(--purple)' }].map(t => (
                <button key={t.v} onClick={() => setCreditType(t.v)} className="btn" style={{ flex: 1, justifyContent: 'center', padding: '9px', background: creditType === t.v ? 'rgba(255,255,255,0.08)' : 'var(--bg3)', color: t.color, border: `1px solid ${creditType === t.v ? t.color : 'var(--border)'}`, fontWeight: creditType === t.v ? 700 : 400 }}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>💵 Cash Amount (₹)</label>
              <input type="number" value={cashAmt} onChange={handleCashChange} placeholder="0.00" min="0" max={total} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>{creditType === 'card' ? '💳 Card Amount (₹)' : '📱 UPI Amount (₹)'}</label>
              <input type="number" value={creditAmt} onChange={handleCreditChange} placeholder="0.00" min="0" max={total} />
            </div>
          </div>
          {(cashAmt !== '' || creditAmt !== '') && (
            <div style={{ fontSize: 12, marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius)', background: splitOk ? 'var(--green-dim)' : 'var(--red-dim)', color: splitOk ? 'var(--green)' : 'var(--red)' }}>
              {splitOk ? '✓ Amounts match total' : `Remaining: ${fmt(total - cashVal - creditVal)}`}
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleSplit}>
            Confirm 💵 Cash + {creditType === 'card' ? '💳 Card' : '📱 UPI'} Split
          </button>
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EditPaymentModal
// ─────────────────────────────────────────────────────────────────────────────
function EditPaymentModal({ bill, onClose, onSaved }) {
  const total       = parseFloat(bill.total_amount);
  const isBillSplit = bill.payment_type === 'cash_card' || bill.payment_type === 'cash_upi';
  const [mode,       setMode]       = useState(isBillSplit ? 'split' : 'single');
  const [singleType, setSingleType] = useState(isBillSplit ? 'cash' : bill.payment_type);
  const [creditType, setCreditType] = useState(bill.payment_type === 'cash_upi' ? 'upi' : 'card');
  const [cashAmt,    setCashAmt]    = useState(isBillSplit ? String(bill.cash_amount) : '');
  const [creditAmt,  setCreditAmt]  = useState(isBillSplit ? String(bill.payment_type === 'cash_upi' ? bill.upi_amount : bill.card_amount) : '');
  const [loading, setLoading] = useState(false);

  const handleCashChange   = e => { const c = e.target.value; setCashAmt(c);   const rem = total - (parseFloat(c)||0); setCreditAmt(rem > 0 ? rem.toFixed(2) : '0.00'); };
  const handleCreditChange = e => { const k = e.target.value; setCreditAmt(k); const rem = total - (parseFloat(k)||0); setCashAmt(rem   > 0 ? rem.toFixed(2) : '0.00'); };

  const cashVal   = parseFloat(cashAmt)   || 0;
  const creditVal = parseFloat(creditAmt) || 0;
  const splitOk   = Math.abs(cashVal + creditVal - total) < 0.01;

  const handleSave = async () => {
    let payment_type, cash_amount, card_amount, upi_amount;
    if (mode === 'single') {
      payment_type = singleType;
      cash_amount  = singleType === 'cash' ? total : 0;
      card_amount  = singleType === 'card' ? total : 0;
      upi_amount   = singleType === 'upi'  ? total : 0;
    } else {
      if (!splitOk) { toast.error(`Amounts must sum to ${fmt(total)}`); return; }
      payment_type = creditType === 'card' ? 'cash_card' : 'cash_upi';
      cash_amount  = cashVal;
      card_amount  = creditType === 'card' ? creditVal : 0;
      upi_amount   = creditType === 'upi'  ? creditVal : 0;
    }
    setLoading(true);
    try {
      await editBillPayment(bill.id, { payment_type, cash_amount, card_amount, upi_amount });
      toast.success('Payment mode updated'); onSaved(); onClose();
    } catch { toast.error('Failed to update payment'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>✏️ Edit Payment Mode</h2>
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Bill Number</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{bill.bill_number}</div>
          <div style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 800 }}>{fmt(total)}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Current: <span className={`badge ${payColor[bill.payment_type]}`}>{payLabel[bill.payment_type]}</span>
          </div>
        </div>
        <div className="form-group">
          <label>Payment Mode</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[{ v: 'single', label: 'Full Payment' }, { v: 'split', label: '💵 Cash + Credit' }].map(m => (
              <button key={m.v} onClick={() => setMode(m.v)} className="btn" style={{ flex: 1, justifyContent: 'center', padding: '9px', background: mode === m.v ? 'rgba(255,255,255,0.08)' : 'var(--bg3)', color: mode === m.v ? 'var(--accent)' : 'var(--text2)', border: `1px solid ${mode === m.v ? 'var(--accent)' : 'var(--border)'}`, fontWeight: mode === m.v ? 700 : 400 }}>{m.label}</button>
            ))}
          </div>
        </div>
        {mode === 'single' ? (
          <div className="form-group">
            <label>Payment Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
              {[{ v: 'cash', label: '💵 Cash', color: 'var(--green)' }, { v: 'card', label: '💳 Card', color: 'var(--blue)' }, { v: 'upi', label: '📱 UPI', color: 'var(--purple)' }].map(t => (
                <button key={t.v} onClick={() => setSingleType(t.v)} className="btn" style={{ justifyContent: 'center', padding: '10px', background: singleType === t.v ? 'rgba(255,255,255,0.08)' : 'var(--bg3)', color: t.color, border: `1px solid ${singleType === t.v ? t.color : 'var(--border)'}`, fontWeight: singleType === t.v ? 700 : 400 }}>{t.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Credit Method</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {[{ v: 'card', label: '💳 Card', color: 'var(--blue)' }, { v: 'upi', label: '📱 UPI', color: 'var(--purple)' }].map(t => (
                  <button key={t.v} onClick={() => setCreditType(t.v)} className="btn" style={{ flex: 1, justifyContent: 'center', padding: '9px', background: creditType === t.v ? 'rgba(255,255,255,0.08)' : 'var(--bg3)', color: t.color, border: `1px solid ${creditType === t.v ? t.color : 'var(--border)'}`, fontWeight: creditType === t.v ? 700 : 400 }}>{t.label}</button>
                ))}
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>💵 Cash Amount (₹)</label>
                <input type="number" value={cashAmt} onChange={handleCashChange} placeholder="0.00" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>{creditType === 'card' ? '💳 Card Amount (₹)' : '📱 UPI Amount (₹)'}</label>
                <input type="number" value={creditAmt} onChange={handleCreditChange} placeholder="0.00" />
              </div>
            </div>
            {(cashAmt !== '' || creditAmt !== '') && (
              <div style={{ fontSize: 12, marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius)', background: splitOk ? 'var(--green-dim)' : 'var(--red-dim)', color: splitOk ? 'var(--green)' : 'var(--red)' }}>
                {splitOk ? '✓ Amounts match total' : `Remaining: ${fmt(total - cashVal - creditVal)}`}
              </div>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : '✓ Save Changes'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewBillsModal
// ─────────────────────────────────────────────────────────────────────────────
function ViewBillsModal({ onClose }) {
  const [bills,       setBills]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [detailBill,  setDetailBill]  = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [deleting,    setDeleting]    = useState(null);

  const fetchBills = async () => {
    setLoading(true);
    try { const { data } = await getBills(); setBills(data); }
    catch { toast.error('Failed to load bills'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchBills(); }, []);

  const openBill = async b => {
    try { const { data } = await getBill(b.id); setDetailBill(data); }
    catch { toast.error('Failed to load bill details'); }
  };

  const handleDelete = async b => {
    if (!window.confirm(`Delete bill ${b.bill_number}?\n\nStock for all items will be restored.`)) return;
    setDeleting(b.id);
    try {
      await deleteBill(b.id);
      toast.success(`Bill ${b.bill_number} deleted — stock restored`);
      fetchBills();
    } catch { toast.error('Failed to delete bill'); }
    finally { setDeleting(null); }
  };

  if (detailBill)  return <PrintBill bill={detailBill} onClose={() => setDetailBill(null)} />;
  if (editingBill) return <EditPaymentModal bill={editingBill} onClose={() => setEditingBill(null)} onSaved={fetchBills} />;

  const filtered = bills.filter(b => b.bill_number.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 860, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>📋 Bills</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search by bill number…" style={{ marginBottom: 16 }} autoFocus />
        {loading ? <div className="spinner" /> : (
          <div style={{ overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Bill No</th><th>Date & Time</th><th>Payment</th><th>Total</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.bill_number}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${payColor[b.payment_type] || 'badge-orange'}`}>{payLabel[b.payment_type] || b.payment_type}</span>
                      {b.payment_type === 'cash_card' && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Cash: {fmt(b.cash_amount)} | Card: {fmt(b.card_amount)}</div>}
                      {b.payment_type === 'cash_upi'  && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Cash: {fmt(b.cash_amount)} | UPI: {fmt(b.upi_amount)}</div>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(b.total_amount)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openBill(b)}>🖨️ View</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingBill(b)} style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>✏️ Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b)} disabled={deleting === b.id}>
                          {deleting === b.id ? '…' : '🗑️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty-state"><div className="icon">📄</div>{search ? `No bills matching "${search}"` : 'No bills yet'}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DirectSaleModal
// ─────────────────────────────────────────────────────────────────────────────
function DirectSaleModal({ onClose }) {
  const [masters,    setMasters]    = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [price,      setPrice]      = useState('');
  const [payType,    setPayType]    = useState('cash');
  const [cashAmt,    setCashAmt]    = useState('');
  const [creditAmt,  setCreditAmt]  = useState('');
  const [creditType, setCreditType] = useState('card');
  const [loading,    setLoading]    = useState(false);

  useEffect(() => { getDirectMasters().then(r => setMasters(r.data.filter(m => m.is_active))); }, []);

  const total     = parseFloat(price) || 0;
  const cashVal   = parseFloat(cashAmt)   || 0;
  const creditVal = parseFloat(creditAmt) || 0;
  const splitOk   = Math.abs(cashVal + creditVal - total) < 0.01;

  const handleCashChange   = e => { const c = e.target.value; setCashAmt(c);   const rem = total - (parseFloat(c)||0); setCreditAmt(rem > 0 ? rem.toFixed(2) : '0.00'); };
  const handleCreditChange = e => { const k = e.target.value; setCreditAmt(k); const rem = total - (parseFloat(k)||0); setCashAmt(rem   > 0 ? rem.toFixed(2) : '0.00'); };

  const handleConfirm = async () => {
    if (!selectedId) { toast.error('Select an item'); return; }
    if (!price || total <= 0) { toast.error('Enter a valid price'); return; }
    let payment_type = payType, cash_amount = 0, card_amount = 0, upi_amount = 0;
    if (payType === 'cash')  cash_amount = total;
    if (payType === 'card')  card_amount = total;
    if (payType === 'upi')   upi_amount  = total;
    if (payType === 'split') {
      if (!splitOk) { toast.error(`Amounts must sum to ${fmt(total)}`); return; }
      payment_type = creditType === 'card' ? 'cash_card' : 'cash_upi';
      cash_amount  = cashVal;
      card_amount  = creditType === 'card' ? creditVal : 0;
      upi_amount   = creditType === 'upi'  ? creditVal : 0;
    }
    setLoading(true);
    try {
      await createDirectSale({ item: parseInt(selectedId), price: total, payment_type, cash_amount, card_amount, upi_amount });
      toast.success(`Direct sale recorded — ${masters.find(m => m.id === parseInt(selectedId))?.name} for ${fmt(total)}`);
      onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record direct sale'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2>⚡ Direct Sale</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Sell items not in your product catalogue — no stock tracking.</p>
        <div className="form-group">
          <label>Item *</label>
          {masters.length === 0 ? (
            <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text3)' }}>
              ⚠️ No items found. Add them in Admin Panel → Direct Sale Master.
            </div>
          ) : (
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">— Select item —</option>
              {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>
        <div className="form-group">
          <label>Price (₹) *</label>
          <input type="number" step="0.01" min="0" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0.00" style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700 }} />
        </div>
        {price && total > 0 && (
          <>
            <div className="form-group">
              <label>Payment Method</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                {[
                  { v: 'cash',  label: '💵 Cash', color: 'var(--green)' },
                  { v: 'card',  label: '💳 Card', color: 'var(--blue)' },
                  { v: 'upi',   label: '📱 UPI',  color: 'var(--purple)' },
                  { v: 'split', label: '💵+💳 Cash+Credit', color: 'var(--yellow)' },
                ].map(t => (
                  <button key={t.v} onClick={() => setPayType(t.v)} className="btn" style={{ justifyContent: 'center', padding: '10px', background: payType === t.v ? 'rgba(255,255,255,0.08)' : 'var(--bg3)', color: t.color, border: `1px solid ${payType === t.v ? t.color : 'var(--border)'}`, fontWeight: payType === t.v ? 700 : 400 }}>{t.label}</button>
                ))}
              </div>
            </div>
            {payType === 'split' && (
              <>
                <div className="form-group">
                  <label>Credit Method</label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {[{ v: 'card', label: '💳 Card', color: 'var(--blue)' }, { v: 'upi', label: '📱 UPI', color: 'var(--purple)' }].map(t => (
                      <button key={t.v} onClick={() => setCreditType(t.v)} className="btn" style={{ flex: 1, justifyContent: 'center', padding: '9px', background: creditType === t.v ? 'rgba(255,255,255,0.08)' : 'var(--bg3)', color: t.color, border: `1px solid ${creditType === t.v ? t.color : 'var(--border)'}`, fontWeight: creditType === t.v ? 700 : 400 }}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>💵 Cash Amount (₹)</label>
                    <input type="number" value={cashAmt} onChange={handleCashChange} placeholder="0.00" />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>{creditType === 'card' ? '💳 Card Amount (₹)' : '📱 UPI Amount (₹)'}</label>
                    <input type="number" value={creditAmt} onChange={handleCreditChange} placeholder="0.00" />
                  </div>
                </div>
                {(cashAmt !== '' || creditAmt !== '') && (
                  <div style={{ fontSize: 12, marginBottom: 14, padding: '8px 12px', borderRadius: 'var(--radius)', background: splitOk ? 'var(--green-dim)' : 'var(--red-dim)', color: splitOk ? 'var(--green)' : 'var(--red)' }}>
                    {splitOk ? '✓ Amounts match total' : `Remaining: ${fmt(total - cashVal - creditVal)}`}
                  </div>
                )}
              </>
            )}
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{masters.find(m => m.id === parseInt(selectedId))?.name || '—'}</span>
                <span style={{ fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--accent)', fontSize: 18 }}>{fmt(total)}</span>
              </div>
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleConfirm} disabled={loading || !selectedId || !price}>
            {loading ? 'Recording…' : '✓ Confirm Sale'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InternalSaleModal
// ─────────────────────────────────────────────────────────────────────────────
function InternalSaleModal({ onClose }) {
  const [masters,   setMasters]   = useState([]);
  const [query,     setQuery]     = useState('');
  const [product,   setProduct]   = useState(null);
  const [destId,    setDestId]    = useState('');
  const [quantity,  setQuantity]  = useState('1');
  const [loading,   setLoading]   = useState(false);
  const [searching, setSearching] = useState(false);
  const [results,   setResults]   = useState([]);
  const debounceRef = useRef(); const resultsRef = useRef([]);
  resultsRef.current = results;

  useEffect(() => { getInternalMasters().then(r => setMasters(r.data.filter(m => m.is_active))); }, []);

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

  const selectProduct = p => {
    if (parseFloat(p.stock_quantity) <= 0) { toast.error(`${p.name} is OUT OF STOCK`); return; }
    setProduct(p); setQuery(''); setResults([]); setQuantity('1');
  };

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

  const handleConfirm = async () => {
    if (!product) { toast.error('Scan or search a product'); return; }
    if (!destId)  { toast.error('Select a destination'); return; }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity'); return; }
    if (qty > parseFloat(product.stock_quantity)) { toast.error('Not enough stock'); return; }
    setLoading(true);
    try {
      await createInternalSale({ product: product.id, destination: parseInt(destId), quantity: qty, price: parseFloat(product.selling_price) });
      toast.success(`${qty} ${product.selling_unit} × ${product.name} transferred to ${masters.find(m => m.id === parseInt(destId))?.name}`);
      onClose();
    } catch (err) { toast.error(err.response?.data?.detail || 'Transfer failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 500 }}>
        <h2>🏭 Internal Sale</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>Transfer stock internally — reduces stock without recording a sale.</p>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Scan / Search Product</label>
          <input autoFocus value={query} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="Scan barcode or type product name…" />
          {searching && <div style={{ position: 'absolute', right: 14, top: 34, fontSize: 12, color: 'var(--text3)' }}>searching…</div>}
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 2, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              {results.map((p, i) => (
                <div key={`${p.id}-${p.batch_id || i}`} onClick={() => selectProduct(p)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.barcode}</div>
                  </div>
                  <span className={`badge ${parseFloat(p.stock_quantity) <= 0 ? 'badge-red' : 'badge-green'}`}>
                    {parseFloat(p.stock_quantity) <= 0 ? 'Out of Stock' : `${parseFloat(p.stock_quantity).toFixed(p.selling_unit === 'kg' ? 3 : 0)} ${p.selling_unit || 'nos'}`}
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
                MRP: <b style={{ color: 'var(--accent)' }}>{fmt(product.selling_price)}</b>&nbsp;·&nbsp;
                Stock: <b style={{ color: 'var(--green)' }}>{parseFloat(product.stock_quantity).toFixed(product.selling_unit === 'kg' ? 3 : 0)} {product.selling_unit}</b>
              </div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setProduct(null)}>✕</button>
          </div>
        )}
        <div className="form-group">
          <label>Destination</label>
          {masters.length === 0 ? (
            <div style={{ padding: '10px 14px', background: 'var(--bg3)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text3)' }}>
              ⚠️ No destinations found. Add them in Admin Panel → Internal Sale Master.
            </div>
          ) : (
            <select value={destId} onChange={e => setDestId(e.target.value)}>
              <option value="">— Select destination —</option>
              {masters.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
        </div>
        <div className="form-group">
          <label>Quantity {product ? `(${product.selling_unit})` : ''}</label>
          {product?.selling_unit === 'kg' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="text" inputMode="decimal" value={quantity}
                onChange={e => setQuantity(e.target.value)}
                onBlur={e => { const v = parseFloat(e.target.value); if (!v || v <= 0) setQuantity('1'); else setQuantity(String(v)); }}
                style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, textAlign: 'right' }} />
              <span style={{ color: 'var(--text3)', fontSize: 15, minWidth: 24 }}>kg</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setQuantity(q => String(Math.max(1, parseInt(q) - 1)))} style={{ padding: '6px 14px', fontSize: 18 }}>−</button>
              <input type="number" value={quantity} onChange={e => setQuantity(String(Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, maxWidth: 100 }} min="1" />
              <button className="btn btn-secondary btn-sm" onClick={() => setQuantity(q => String(parseInt(q) + 1))} style={{ padding: '6px 14px', fontSize: 18 }}>+</button>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>{product?.selling_unit || 'nos'}</span>
            </div>
          )}
        </div>
        {product && destId && (
          <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
            Transferring <b>{quantity} {product.selling_unit} × {product.name}</b> to <b>{masters.find(m => m.id === parseInt(destId))?.name}</b>
            <br />Stock will reduce by <b style={{ color: 'var(--red)' }}>{quantity} {product.selling_unit}</b>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleConfirm} disabled={loading || !product || !destId}>
            {loading ? 'Transferring…' : '✓ Confirm Transfer'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReturnModal
// ─────────────────────────────────────────────────────────────────────────────
function ReturnModal({ onClose }) {
  const [query,      setQuery]      = useState('');
  const [product,    setProduct]    = useState(null);
  const [returnType, setReturnType] = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleScan = async e => {
    if (e.key !== 'Enter' || !query.trim()) return;
    try {
      const { data } = await getProductByBarcode(query.trim());
      const rows = Array.isArray(data) ? data : [data];
      if (rows.length > 0) { setProduct(rows[0]); setReturnType(''); }
    } catch { toast.error('Product not found'); }
  };

  const handleReturn = async () => {
    if (!product || !returnType) { toast.error('Select return type'); return; }
    setLoading(true);
    try {
      const { createReturn } = await import('../services/api');
      await createReturn({ product: product.id, return_type: returnType, quantity: 1 });
      toast.success(`Return processed: ${returnType.replace('_', ' ')}`);
      onClose();
    } catch { toast.error('Failed to process return'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>↩️ Process Return</h2>
        <div className="form-group">
          <label>Scan / Enter Barcode</label>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={handleScan} placeholder="Scan barcode and press Enter…" />
        </div>
        {product && (
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{product.name}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text3)' }}>
              <span>Barcode: <b style={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{product.barcode}</b></span>
              <span>MRP: <b style={{ color: 'var(--accent)' }}>{fmt(product.selling_price)}</b></span>
              <span>Stock: <b style={{ color: 'var(--green)' }}>{parseFloat(product.stock_quantity).toFixed(product.selling_unit === 'kg' ? 3 : 0)} {product.selling_unit}</b></span>
            </div>
          </div>
        )}
        <div className="form-group">
          <label>Return Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
            {[
              { v: 'customer_return', label: '👤 Customer Return', color: 'var(--green)' },
              { v: 'damaged',         label: '⚠️ Damaged',         color: 'var(--yellow)' },
              { v: 'expired',         label: '🗑️ Expired',         color: 'var(--red)' },
            ].map(t => (
              <button key={t.v} onClick={() => setReturnType(t.v)} className="btn" style={{ justifyContent: 'center', fontSize: 12, padding: '10px 6px', background: returnType === t.v ? 'rgba(255,255,255,0.1)' : 'var(--bg3)', color: t.color, border: `1px solid ${returnType === t.v ? t.color : 'var(--border)'}` }}>{t.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleReturn}
            disabled={!product || !returnType || loading} style={{ flex: 1, justifyContent: 'center' }}>
            {loading ? 'Processing…' : 'Process Return'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sale Page — with function key shortcuts
// ─────────────────────────────────────────────────────────────────────────────
export default function Sale() {
  const [items,        setItems]        = useState([]);
  const [showPayment,  setShowPayment]  = useState(false);
  const [showBills,    setShowBills]    = useState(false);
  const [showReturn,   setShowReturn]   = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [showDirect,   setShowDirect]   = useState(false);
  const [printBill,    setPrintBill]    = useState(null);

  const total = items.reduce((s, i) => s + i.price * (parseFloat(i.qty) || 0), 0);

  // Function key shortcuts
  useEffect(() => {
    const handleKey = e => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      // Also don't trigger if any modal is open
      if (showPayment || showBills || showReturn || showInternal || showDirect || printBill) return;

      if (e.key === 'F1') { e.preventDefault(); if (items.length > 0) confirmPayment('cash', total, 0, 0); }
      if (e.key === 'F2') { e.preventDefault(); if (items.length > 0) confirmPayment('card', 0, total, 0); }
      if (e.key === 'F3') { e.preventDefault(); if (items.length > 0) confirmPayment('upi',  0, 0, total); }
      if (e.key === 'F4') { e.preventDefault(); if (items.length > 0) setShowPayment(true); }
      if (e.key === 'F5') { e.preventDefault(); setShowBills(true); }
      if (e.key === 'F6') { e.preventDefault(); setShowDirect(true); }
      if (e.key === 'F7') { e.preventDefault(); setShowInternal(true); }
      if (e.key === 'F8') { e.preventDefault(); setShowReturn(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [items, total, showPayment, showBills, showReturn, showInternal, showDirect, printBill]);

  const addItem = p => {
    setItems(prev => {
      const key      = `${p.id}_${p.batch_id || 'nb'}`;
      const existing = prev.find(i => i._key === key);
      const stock    = parseFloat(p.stock_quantity);
      const unit     = p.selling_unit || 'nos';

      if (existing) {
        const newQty = parseFloat(existing.qty) + 1;
        if (newQty > stock) { toast.error('Not enough stock'); return prev; }
        return prev.map(i => i._key === key ? { ...i, qty: unit === 'kg' ? String(newQty) : newQty } : i);
      }
      return [...prev, {
        _key: key, id: p.id, batch_id: p.batch_id || null, batch_mrp: p.batch_mrp || null,
        multi_batch: p.multi_batch || false, name: p.name, barcode: p.barcode,
        price: parseFloat(p.selling_price), qty: unit === 'kg' ? '1' : 1, stock, selling_unit: unit,
      }];
    });
  };

  const changeQty = (key, deltaOrValue, directSet = false) => {
    setItems(prev => prev.map(i => {
      if (i._key !== key) return i;
      if (directSet) {
        const raw = deltaOrValue; const v = parseFloat(raw);
        if (!isNaN(v) && v > i.stock) { toast.error('Not enough stock'); return i; }
        return { ...i, qty: raw };
      }
      const newQty = i.qty + deltaOrValue;
      if (newQty < 1) return i;
      if (newQty > i.stock) { toast.error('Not enough stock'); return i; }
      return { ...i, qty: newQty };
    }));
  };

  const removeItem = key => setItems(prev => prev.filter(i => i._key !== key));

  const confirmPayment = async (payType, cashAmt, cardAmt, upiAmt) => {
    for (const item of items) {
      const qty = parseFloat(item.qty);
      if (!qty || qty <= 0) { toast.error(`Enter a valid quantity for ${item.name}`); return; }
    }
    setShowPayment(false);
    try {
      const payload = {
        total_amount: total, payment_type: payType,
        cash_amount:  cashAmt || (payType === 'cash' ? total : 0),
        card_amount:  cardAmt || (payType === 'card' ? total : 0),
        upi_amount:   upiAmt  || (payType === 'upi'  ? total : 0),
        items: items.map(i => ({ product: i.id, batch_id: i.batch_id || null, quantity: parseFloat(i.qty), price: i.price })),
      };
      const { data } = await createBill(payload);
      toast.success(`Bill ${data.bill_number} saved!`);
      setItems([]);
      setPrintBill(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bill');
    }
  };

  if (printBill) return <PrintBill bill={printBill} onClose={() => setPrintBill(null)} />;

  // Helper to render function key badge inside button
  const Fkey = ({ k }) => (
    <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 5px', marginLeft: 6, letterSpacing: 0, fontFamily: 'monospace' }}>
      {k}
    </span>
  );

  return (
    <div>
      <div className="page-header">
        <h1>🛒 Sale</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowReturn(true)}>
            ↩️ Return <Fkey k="F8" />
          </button>
          <button className="btn btn-secondary" onClick={() => setShowInternal(true)}
            style={{ color: 'var(--purple)', borderColor: 'var(--purple)' }}>
            🏭 Internal Sale <Fkey k="F7" />
          </button>
          <button className="btn btn-secondary" onClick={() => setShowDirect(true)}
            style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>
            ⚡ Direct Sale <Fkey k="F6" />
          </button>
          <button className="btn btn-secondary" onClick={() => setShowBills(true)}>
            📋 View Bills <Fkey k="F5" />
          </button>
          {items.length > 0 && (
            <button className="btn btn-primary" onClick={() => setShowPayment(true)}>
              💳 Pay {fmt(total)}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <SearchBar onAdd={addItem} />
      </div>

      <div className="card">
        <BillTable items={items} onQtyChange={changeQty} onRemove={removeItem} />
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16, flexWrap: 'wrap' }}>
            {[
              { type: 'cash',  label: '💵 Cash',           fkey: 'F1', rgb: '34,197,94',  color: 'var(--green)' },
              { type: 'card',  label: '💳 Card',           fkey: 'F2', rgb: '59,130,246', color: 'var(--blue)' },
              { type: 'upi',   label: '📱 UPI',            fkey: 'F3', rgb: '168,85,247', color: 'var(--purple)' },
              { type: 'split', label: '💵+💳 Cash+Credit', fkey: 'F4', rgb: '234,179,8',  color: 'var(--yellow)' },
            ].map(p => (
              <button key={p.type} onClick={() => {
                if (p.type === 'split') { setShowPayment(true); return; }
                confirmPayment(p.type, p.type==='cash'?total:0, p.type==='card'?total:0, p.type==='upi'?total:0);
              }} className="btn" style={{
                flex: 1, justifyContent: 'center', padding: '12px',
                background: `rgba(${p.rgb},0.15)`, color: p.color,
                border: `1px solid ${p.color}`, fontSize: 14, fontWeight: 700,
                minWidth: 120,
              }}>
                {p.label}
                <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '1px 5px', marginLeft: 8, letterSpacing: 0, fontFamily: 'monospace' }}>
                  {p.fkey}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showPayment  && <PaymentModal total={total} onClose={() => setShowPayment(false)} onConfirm={confirmPayment} />}
      {showBills    && <ViewBillsModal onClose={() => setShowBills(false)} />}
      {showReturn   && <ReturnModal onClose={() => setShowReturn(false)} />}
      {showInternal && <InternalSaleModal onClose={() => setShowInternal(false)} />}
      {showDirect   && <DirectSaleModal onClose={() => setShowDirect(false)} />}
    </div>
  );
}