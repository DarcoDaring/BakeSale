import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  getSaleReport, getItemWiseReport,
  getInternalSaleReport, getInternalMasters,
  getPurchaseReturnReport, getPurchaseReport,
  getPurchaseBill, markPurchaseReturned
} from '../services/api';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;
const payLabel = {
  cash: 'Cash', card: 'Card', upi: 'UPI',
  cash_card: 'Cash & Card', cash_upi: 'Cash & UPI',
};
const today = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────────────────────────────────────
// Print Date Range Modal
// ─────────────────────────────────────────────────────────────────────────────
function PrintModal({ onClose, onPrint, title }) {
  const t = today();
  const [from, setFrom] = useState(t);
  const [to,   setTo]   = useState(t);
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    if (!from || !to || from > to) { alert('Invalid date range'); return; }
    setLoading(true);
    await onPrint(from, to);
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <h2>🖨️ {title || 'Print Report'}</h2>
        <div className="form-row">
          <div className="form-group" style={{ margin: 0 }}>
            <label>From Date</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>To Date</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handlePrint} disabled={loading}>
            {loading ? 'Preparing…' : '🖨️ Print'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Purchase Bill Detail Modal
// ─────────────────────────────────────────────────────────────────────────────
function PurchaseBillDetailModal({ billId, onClose }) {
  const [bill,    setBill]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPurchaseBill(billId)
      .then(r => setBill(r.data))
      .catch(() => { alert('Failed to load bill'); onClose(); })
      .finally(() => setLoading(false));
  }, [billId]);

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 700 }}><div className="spinner" /></div>
    </div>
  );
  if (!bill) return null;

  const totalValue = bill.items.reduce((s, item) => {
    const qty  = parseFloat(item.quantity) * parseFloat(item.selling_qty);
    const base = qty * parseFloat(item.purchase_price);
    return s + base + base * parseFloat(item.tax) / 100;
  }, 0);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0 }}>📦 Purchase Detail</h2>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
              <span className="badge badge-orange" style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{bill.purchase_number}</span>
              <span className={`badge ${bill.is_paid ? 'badge-green' : 'badge-yellow'}`}>
                {bill.is_paid ? '✅ Paid' : '⏳ Not Paid'}
              </span>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>{new Date(bill.date).toLocaleString()}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Vendor</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{bill.vendor_name || '—'}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Pur. Unit</th><th>Qty</th>
                <th>Price</th><th>Tax %</th><th>MRP</th>
                <th>Sell Unit</th><th>Qty/Unit</th><th>Stock Added</th><th>Value</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item, i) => {
                const stockAdded = parseFloat(item.quantity) * parseFloat(item.selling_qty);
                const base       = parseFloat(item.purchase_price) * stockAdded;
                const totalVal   = base + base * parseFloat(item.tax) / 100;
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{item.product_barcode}</div>
                    </td>
                    <td><span className="badge badge-blue">{item.purchase_unit}</span></td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{item.quantity}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{fmt(item.purchase_price)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{item.tax}%</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{fmt(item.mrp)}</td>
                    <td><span className="badge badge-purple">{item.selling_unit}</span></td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{item.selling_qty}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 600 }}>+{stockAdded.toFixed(3)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalVal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: '2px solid var(--accent)', padding: '14px 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'var(--text3)', fontSize: 14 }}>Total Purchase Value (incl. tax)</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{fmt(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending Returns Modal (clicked from stat card)
// ─────────────────────────────────────────────────────────────────────────────
function PendingReturnsModal({ returns, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>⏳ Pending Purchase Returns</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div style={{ overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Item Name</th><th>Qty</th><th>Date Issued</th><th>Reason</th></tr></thead>
            <tbody>
              {returns.filter(r => r.status === 'pending').map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.product_name}</td>
                  <td><span className="badge badge-red">{r.quantity}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(r.date).toLocaleString()}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 13 }}>{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {returns.filter(r => r.status === 'pending').length === 0 && (
            <div className="empty-state"><div className="icon">✅</div>No pending returns</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Purchase Bills List Modal (clicked from Paid / Not Paid cards)
// ─────────────────────────────────────────────────────────────────────────────
function PurchaseBillsListModal({ bills, title, onClose, onViewDetail }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div style={{ overflowY: 'auto' }}>
          <table>
            <thead>
              <tr><th>PO Number</th><th>Vendor</th><th>Date</th><th>Items</th><th>Total Value</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onViewDetail(b.id)}>
                  <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.purchase_number}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{b.vendor_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.date).toLocaleDateString()}</td>
                  <td><span className="badge badge-blue">{b.item_count}</span></td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(b.total_value)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => onViewDetail(b.id)}>🔍 View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bills.length === 0 && <div className="empty-state"><div className="icon">📦</div>No bills found</div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Reports Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Reports() {
  const [tab,              setTab]              = useState('sale');
  const [saleData,         setSaleData]         = useState(null);
  const [itemData,         setItemData]         = useState([]);
  const [intData,          setIntData]          = useState([]);
  const [purRetData,       setPurRetData]       = useState(null);
  const [purData,          setPurData]          = useState(null);
  const [masters,          setMasters]          = useState([]);
  const [selDests,         setSelDests]         = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [dateFrom,         setDateFrom]         = useState('');
  const [dateTo,           setDateTo]           = useState('');
  const [showPrintModal,   setShowPrintModal]   = useState(false);
  const [showPurPrint,     setShowPurPrint]     = useState(false);
  const [detailBillId,     setDetailBillId]     = useState(null);
  const [showPendingRet,   setShowPendingRet]   = useState(false);
  const [purListModal,     setPurListModal]     = useState(null); // { bills, title }
  const [markingId,        setMarkingId]        = useState(null);

  useEffect(() => { getInternalMasters().then(r => setMasters(r.data)); }, []);

  // Sale report loads today by default on mount
  useEffect(() => {
    if (tab === 'sale') fetchReport('sale');
    else if (tab === 'purchase') fetchReport('purchase');
    else if (tab === 'purreturn') fetchReport('purreturn');
  }, [tab]);

  const fetchReport = async (overrideTab) => {
    const activeTab = overrideTab || tab;
    setLoading(true);
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    try {
      if (activeTab === 'sale') {
        const { data } = await getSaleReport(params);
        setSaleData(data);
        // Sync the date inputs with what the backend used
        if (!dateFrom && data.date_from) setDateFrom(data.date_from);
        if (!dateTo   && data.date_to)   setDateTo(data.date_to);
      } else if (activeTab === 'itemwise') {
        const { data } = await getItemWiseReport(params);
        setItemData(data);
      } else if (activeTab === 'internal') {
        if (selDests.length > 0) params.destinations = selDests.join(',');
        const { data } = await getInternalSaleReport(params);
        setIntData(data);
      } else if (activeTab === 'purreturn') {
        const { data } = await getPurchaseReturnReport(params);
        setPurRetData(data);
      } else if (activeTab === 'purchase') {
        const { data } = await getPurchaseReport(params);
        setPurData(data);
      }
    } catch {}
    setLoading(false);
  };

  const toggleDest = id =>
    setSelDests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleMarkReturned = async (id) => {
    setMarkingId(id);
    try {
      await markPurchaseReturned(id);
      toast.success('Marked as returned');
      fetchReport('purreturn');
    } catch { toast.error('Failed to update status'); }
    finally { setMarkingId(null); }
  };

  // Sale print
  const handleSalePrint = async (from, to) => {
    try {
      const { data } = await getSaleReport({ date_from: from, date_to: to });
      setShowPrintModal(false);
      setTimeout(() => {
        let el = document.getElementById('bakesale-print-container');
        if (!el) { el = document.createElement('div'); el.id = 'bakesale-print-container'; document.body.appendChild(el); }
        const { bills, totals } = data;
        el.innerHTML = `
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px">Sale Report — ${from} to ${to}</div>
              <div style="font-size:11px;color:#888">Printed: ${new Date().toLocaleString()}</div>
            </div>
            <div style="border:1px solid #ccc;padding:14px;margin-bottom:24px;background:#f9f9f9">
              <table style="width:100%;border-collapse:collapse">
                <tr><td>Cash Total</td><td style="text-align:right;font-weight:600">${fmt(totals.cash_total)}</td></tr>
                <tr><td>Card Total</td><td style="text-align:right;font-weight:600">${fmt(totals.card_total)}</td></tr>
                <tr><td>UPI Total</td><td style="text-align:right;font-weight:600">${fmt(totals.upi_total)}</td></tr>
                <tr style="border-top:2px solid #333"><td style="font-weight:800;font-size:15px">Grand Total</td><td style="text-align:right;font-weight:800;font-size:15px">${fmt(totals.grand_total)}</td></tr>
              </table>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px">Bill No</th>
                <th style="border:1px solid #ccc;padding:7px">Date</th>
                <th style="border:1px solid #ccc;padding:7px">Payment</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total</th>
              </tr></thead>
              <tbody>${bills.map((b, i) => `
                <tr style="background:${i%2===0?'#fff':'#fafafa'}">
                  <td style="border:1px solid #ccc;padding:6px;font-weight:600">${b.bill_number}</td>
                  <td style="border:1px solid #ccc;padding:6px">${new Date(b.created_at).toLocaleString()}</td>
                  <td style="border:1px solid #ccc;padding:6px">${payLabel[b.payment_type]||b.payment_type}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(b.total_amount)}</td>
                </tr>`).join('')}</tbody>
              <tfoot><tr style="background:#f0f0f0">
                <td colspan="3" style="border:1px solid #ccc;padding:7px;font-weight:800">Grand Total (${bills.length} bills)</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:800">${fmt(totals.grand_total)}</td>
              </tr></tfoot>
            </table>
          </div>`;
        const root = document.getElementById('root');
        root.style.display = 'none';
        window.print();
        root.style.display = '';
        el.innerHTML = '';
      }, 300);
    } catch { alert('Failed to load report for printing'); }
  };

  // Purchase print
  const handlePurchasePrint = async (from, to) => {
    try {
      const { data } = await getPurchaseReport({ date_from: from, date_to: to });
      setShowPurPrint(false);
      setTimeout(() => {
        let el = document.getElementById('bakesale-print-container');
        if (!el) { el = document.createElement('div'); el.id = 'bakesale-print-container'; document.body.appendChild(el); }
        const { bills, grand_total } = data;
        el.innerHTML = `
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px">Purchase Report — ${from} to ${to}</div>
              <div style="font-size:11px;color:#888">Printed: ${new Date().toLocaleString()}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px">PO No</th>
                <th style="border:1px solid #ccc;padding:7px">Date</th>
                <th style="border:1px solid #ccc;padding:7px">Vendor</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Price</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Tax</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:center">Payment</th>
              </tr></thead>
              <tbody>${bills.map((b, i) => `
                <tr style="background:${i%2===0?'#fff':'#fafafa'}">
                  <td style="border:1px solid #ccc;padding:6px;font-weight:600;font-family:monospace">${b.purchase_number}</td>
                  <td style="border:1px solid #ccc;padding:6px">${new Date(b.date).toLocaleDateString()}</td>
                  <td style="border:1px solid #ccc;padding:6px">${b.vendor_name}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.total_purchase_price)}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.total_tax)}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(b.total_value)}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:center">${b.is_paid?'Paid':'Not Paid'}</td>
                </tr>`).join('')}</tbody>
              <tfoot><tr style="background:#f0f0f0">
                <td colspan="5" style="border:1px solid #ccc;padding:7px;font-weight:800">Grand Total (${bills.length} purchases)</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:800">${fmt(grand_total)}</td>
                <td style="border:1px solid #ccc;padding:7px"></td>
              </tr></tfoot>
            </table>
          </div>`;
        const root = document.getElementById('root');
        root.style.display = 'none';
        window.print();
        root.style.display = '';
        el.innerHTML = '';
      }, 300);
    } catch { alert('Failed to load report for printing'); }
  };

  // Internal helpers
  const intByDest     = intData.reduce((acc, row) => {
    const key = row.destination_name;
    if (!acc[key]) acc[key] = { items: [], total: 0 };
    acc[key].items.push(row);
    acc[key].total += row.total_amount;
    return acc;
  }, {});
  const intGrandTotal = intData.reduce((s, r) => s + r.total_amount, 0);
  const intTotalQty   = intData.reduce((s, r) => s + r.quantity,     0);

  const TABS = [
    { k: 'sale',      label: '🧾 Sale Report' },
    { k: 'itemwise',  label: '📦 Item-wise Report' },
    { k: 'internal',  label: '🏭 Internal Sale Report' },
    { k: 'purreturn', label: '↩️ Purchase Return' },
    { k: 'purchase',  label: '📦 Purchase Report' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>📊 Reports</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 160 }} />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 160 }} />
          <button className="btn btn-primary" onClick={() => fetchReport()}>Filter</button>
          {tab === 'sale' && (
            <button className="btn btn-secondary" onClick={() => setShowPrintModal(true)}
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>🖨️ Print</button>
          )}
          {tab === 'purchase' && (
            <button className="btn btn-secondary" onClick={() => setShowPurPrint(true)}
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>🖨️ Print Full Report</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className="btn" style={{
            background: tab === t.k ? 'var(--accent)' : 'var(--surface)',
            color:      tab === t.k ? '#fff'          : 'var(--text2)',
            border:    `1px solid ${tab === t.k ? 'var(--accent)' : 'var(--border)'}`,
            fontSize: 14, fontWeight: 600,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          {/* ── Sale Report — shows today by default ── */}
          {tab === 'sale' && (
            <>
              {saleData && (
                <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text3)' }}>
                  Showing: <b style={{ color: 'var(--text)' }}>{dateFrom}</b> to <b style={{ color: 'var(--text)' }}>{dateTo}</b>
                </div>
              )}
              {saleData ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                  {[
                    { label: 'Grand Total', value: fmt(saleData.totals.grand_total), color: 'var(--accent)' },
                    { label: 'Cash Total',  value: fmt(saleData.totals.cash_total),  color: 'var(--green)' },
                    { label: 'Card Total',  value: fmt(saleData.totals.card_total),  color: 'var(--blue)' },
                    { label: 'UPI Total',   value: fmt(saleData.totals.upi_total),   color: 'var(--purple)' },
                  ].map(s => (
                    <div key={s.label} className="stat-card">
                      <div className="label">{s.label}</div>
                      <div className="value" style={{ color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><div className="icon">📊</div><div>Loading today's report…</div></div>
              )}
            </>
          )}

          {/* ── Item-wise Report ── */}
          {tab === 'itemwise' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead><tr><th>Product</th><th>Barcode</th><th>MRP</th><th>Qty Sold</th><th>Total Revenue</th></tr></thead>
                <tbody>
                  {itemData.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{item.product_barcode}</span></td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmt(item.mrp)}</td>
                      <td><span className="badge badge-blue">{item.quantity_sold}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {itemData.length === 0 && <div className="empty-state"><div className="icon">📦</div>No item data</div>}
            </div>
          )}

          {/* ── Internal Sale Report ── */}
          {tab === 'internal' && (
            <>
              {masters.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 10 }}>Filter by Destination</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setSelDests([])} className="btn btn-sm" style={{ background: selDests.length === 0 ? 'var(--accent-dim)' : 'var(--bg3)', color: selDests.length === 0 ? 'var(--accent)' : 'var(--text2)', border: `1px solid ${selDests.length === 0 ? 'var(--accent)' : 'var(--border)'}` }}>All</button>
                    {masters.map(m => (
                      <button key={m.id} onClick={() => toggleDest(m.id)} className="btn btn-sm" style={{ background: selDests.includes(m.id) ? 'var(--accent-dim)' : 'var(--bg3)', color: selDests.includes(m.id) ? 'var(--accent)' : 'var(--text2)', border: `1px solid ${selDests.includes(m.id) ? 'var(--accent)' : 'var(--border)'}` }}>{m.name}</button>
                    ))}
                    <button className="btn btn-primary btn-sm" onClick={() => fetchReport()} style={{ marginLeft: 'auto' }}>Apply Filter</button>
                  </div>
                </div>
              )}
              {intData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card"><div className="label">Total Items Transferred</div><div className="value" style={{ color: 'var(--purple)', fontSize: 22 }}>{intTotalQty}</div></div>
                  <div className="stat-card"><div className="label">Destinations Used</div><div className="value" style={{ color: 'var(--blue)', fontSize: 22 }}>{Object.keys(intByDest).length}</div></div>
                  <div className="stat-card"><div className="label">Total Value Transferred</div><div className="value" style={{ color: 'var(--accent)', fontSize: 22 }}>{fmt(intGrandTotal)}</div></div>
                </div>
              )}
              {Object.keys(intByDest).length === 0 ? (
                <div className="empty-state"><div className="icon">🏭</div>No internal sales in this period</div>
              ) : (
                Object.entries(intByDest).map(([destName, group]) => (
                  <div key={destName} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 700 }}>🏭 {destName}</div>
                      <div style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>{fmt(group.total)}</div>
                    </div>
                    <table>
                      <thead><tr><th>Product</th><th>Barcode</th><th>MRP</th><th>Qty</th><th>Total Value</th></tr></thead>
                      <tbody>
                        {group.items.map((item, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                            <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{item.product_barcode}</span></td>
                            <td style={{ fontFamily: 'var(--mono)' }}>{fmt(item.mrp)}</td>
                            <td><span className="badge badge-purple">{item.quantity}</span></td>
                            <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(item.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </>
          )}

          {/* ── Purchase Return Report ── */}
          {tab === 'purreturn' && (
            <>
              {/* Only 1 card: pending count */}
              {purRetData && (
                <div style={{ marginBottom: 20 }}>
                  <div
                    className="stat-card"
                    style={{
                      maxWidth: 220, cursor: 'pointer',
                      border: purRetData.pending_count > 0 ? '1px solid var(--yellow)' : undefined,
                    }}
                    onClick={() => setShowPendingRet(true)}
                  >
                    <div className="label">⏳ Pending Returns</div>
                    <div className="value" style={{ color: purRetData.pending_count > 0 ? 'var(--yellow)' : 'var(--text3)', fontSize: 28 }}>
                      {purRetData.pending_count}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Click to view items</div>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th><th>Barcode</th><th>Qty</th>
                      <th>Purchase Price</th><th>Tax</th><th>Item Cost</th>
                      <th>Reason</th><th>Date</th><th>Status</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(purRetData?.returns || []).map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.product_name}</td>
                        <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.product_barcode}</span></td>
                        <td><span className="badge badge-red">{r.quantity}</span></td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(r.purchase_price)}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{r.tax}%</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(r.item_cost)}</td>
                        <td style={{ color: 'var(--text3)', fontSize: 13 }}>{r.reason || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(r.date).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${r.status === 'returned' ? 'badge-green' : 'badge-yellow'}`}>
                            {r.status === 'returned' ? '✅ Returned' : '⏳ Pending'}
                          </span>
                        </td>
                        <td>
                          {r.status === 'pending' && (
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--green)', borderColor: 'var(--green)', background: 'var(--green-dim)', fontSize: 12 }}
                              onClick={() => handleMarkReturned(r.id)}
                              disabled={markingId === r.id}
                            >
                              {markingId === r.id ? '…' : '✅ Product Returned'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!purRetData || purRetData.returns.length === 0) && (
                  <div className="empty-state"><div className="icon">↩️</div>No purchase returns in this period</div>
                )}
              </div>
            </>
          )}

          {/* ── Purchase Report — only Paid/Not Paid cards ── */}
          {tab === 'purchase' && (
            <>
              {purData && purData.bills.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20, maxWidth: 500 }}>
                  <div
                    className="stat-card"
                    style={{ cursor: 'pointer', border: '1px solid var(--green)' }}
                    onClick={() => setPurListModal({
                      bills: purData.bills.filter(b => b.is_paid),
                      title: '✅ Paid Purchases',
                    })}
                  >
                    <div className="label">✅ Paid</div>
                    <div className="value" style={{ color: 'var(--green)' }}>
                      {purData.bills.filter(b => b.is_paid).length}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Click to view</div>
                  </div>
                  <div
                    className="stat-card"
                    style={{ cursor: 'pointer', border: '1px solid var(--yellow)' }}
                    onClick={() => setPurListModal({
                      bills: purData.bills.filter(b => !b.is_paid),
                      title: '⏳ Not Paid Purchases',
                    })}
                  >
                    <div className="label">⏳ Not Paid</div>
                    <div className="value" style={{ color: 'var(--yellow)' }}>
                      {purData.bills.filter(b => !b.is_paid).length}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Click to view</div>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th><th>Vendor</th><th>Date</th>
                      <th>Items</th><th>Purchase Value</th><th>Tax</th>
                      <th>Total Value</th><th>Payment</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(purData?.bills || []).map((b, i) => (
                      <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setDetailBillId(b.id)}>
                        <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.purchase_number}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{b.vendor_name}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.date).toLocaleDateString()}</td>
                        <td><span className="badge badge-blue">{b.item_count}</span></td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(b.total_purchase_price)}</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{fmt(b.total_tax)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(b.total_value)}</td>
                        <td>
                          <span className={`badge ${b.is_paid ? 'badge-green' : 'badge-yellow'}`}>
                            {b.is_paid ? '✅ Paid' : '⏳ Not Paid'}
                          </span>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDetailBillId(b.id)}>🔍 View</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!purData || purData.bills.length === 0) && (
                  <div className="empty-state">
                    <div className="icon">📦</div>
                    No purchases. Use Filter to search by date.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Modals */}
      {showPrintModal  && <PrintModal title="Print Sale Report"     onClose={() => setShowPrintModal(false)} onPrint={handleSalePrint} />}
      {showPurPrint    && <PrintModal title="Print Purchase Report" onClose={() => setShowPurPrint(false)}   onPrint={handlePurchasePrint} />}
      {detailBillId    && <PurchaseBillDetailModal billId={detailBillId} onClose={() => setDetailBillId(null)} />}
      {showPendingRet  && purRetData && <PendingReturnsModal returns={purRetData.returns} onClose={() => setShowPendingRet(false)} />}
      {purListModal    && (
        <PurchaseBillsListModal
          bills={purListModal.bills}
          title={purListModal.title}
          onClose={() => setPurListModal(null)}
          onViewDetail={id => { setPurListModal(null); setDetailBillId(id); }}
        />
      )}
    </div>
  );
}