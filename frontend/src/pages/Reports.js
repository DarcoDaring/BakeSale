import React, { useState, useEffect } from 'react';
import {
  getSaleReport, getItemWiseReport,
  getInternalSaleReport, getInternalMasters,
  getPurchaseReturnReport
} from '../services/api';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;
const payLabel = {
  cash: 'Cash', card: 'Card', upi: 'UPI',
  cash_card: 'Cash & Card', cash_upi: 'Cash & UPI',
};

// ─────────────────────────────────────────────────────────────────────────────
// Print Date Range Modal
// ─────────────────────────────────────────────────────────────────────────────
function PrintModal({ onClose, onPrint }) {
  const today = new Date().toISOString().split('T')[0];
  const [from, setFrom] = useState(today);
  const [to,   setTo]   = useState(today);
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    if (!from || !to) return;
    if (from > to) { alert('From date cannot be after To date'); return; }
    setLoading(true);
    await onPrint(from, to);
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <h2>🖨️ Print Sale Report</h2>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
          Select the date range for the printed report.
        </p>
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
// Main Reports Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Reports() {
  const [tab,       setTab]       = useState('sale');
  const [saleData,  setSaleData]  = useState(null);
  const [itemData,  setItemData]  = useState([]);
  const [intData,   setIntData]   = useState([]);
  const [purRetData, setPurRetData] = useState(null);  // { returns, total_cost }
  const [masters,   setMasters]   = useState([]);
  const [selDests,  setSelDests]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    getInternalMasters().then(r => setMasters(r.data));
  }, []);

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
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchReport(tab); }, [tab]);

  const toggleDest = id =>
    setSelDests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handlePrint = async (from, to) => {
    try {
      const { data } = await getSaleReport({ date_from: from, date_to: to });
      setShowPrintModal(false);

      setTimeout(() => {
        let printContainer = document.getElementById('bakesale-print-container');
        if (!printContainer) {
          printContainer = document.createElement('div');
          printContainer.id = 'bakesale-print-container';
          document.body.appendChild(printContainer);
        }

        const { bills, totals } = data;
        const rowsHtml = bills.map((b, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px 10px;font-weight:600">${b.bill_number}</td>
            <td style="border:1px solid #ccc;padding:6px 10px;color:#555">${new Date(b.created_at).toLocaleString()}</td>
            <td style="border:1px solid #ccc;padding:6px 10px">${payLabel[b.payment_type] || b.payment_type}</td>
            <td style="border:1px solid #ccc;padding:6px 10px;text-align:right;font-weight:600">${fmt(b.total_amount)}</td>
          </tr>
        `).join('');

        printContainer.innerHTML = `
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px;margin-top:4px">Sale Report</div>
              <div style="font-size:12px;margin-top:4px;color:#555">Period: <strong>${from}</strong> to <strong>${to}</strong></div>
              <div style="font-size:11px;color:#888;margin-top:2px">Printed on: ${new Date().toLocaleString()}</div>
            </div>
            <div style="border:1px solid #ccc;border-radius:6px;padding:14px 18px;margin-bottom:24px;background:#f9f9f9">
              <div style="font-size:13px;font-weight:700;margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:8px">Payment Summary</div>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <tr><td style="padding:4px 0;color:#555">Cash Total</td><td style="padding:4px 0;text-align:right;font-weight:600">${fmt(totals.cash_total)}</td></tr>
                <tr><td style="padding:4px 0;color:#555">Card Total</td><td style="padding:4px 0;text-align:right;font-weight:600">${fmt(totals.card_total)}</td></tr>
                <tr><td style="padding:4px 0;color:#555">UPI Total</td><td style="padding:4px 0;text-align:right;font-weight:600">${fmt(totals.upi_total)}</td></tr>
                <tr style="border-top:2px solid #333">
                  <td style="padding:8px 0 4px;font-weight:800;font-size:15px">Grand Total</td>
                  <td style="padding:8px 0 4px;text-align:right;font-weight:800;font-size:15px">${fmt(totals.grand_total)}</td>
                </tr>
              </table>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px 10px;text-align:left">Bill No</th>
                <th style="border:1px solid #ccc;padding:7px 10px;text-align:left">Date & Time</th>
                <th style="border:1px solid #ccc;padding:7px 10px;text-align:left">Payment Type</th>
                <th style="border:1px solid #ccc;padding:7px 10px;text-align:right">Total Amount</th>
              </tr></thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot><tr style="background:#f0f0f0">
                <td colspan="3" style="border:1px solid #ccc;padding:7px 10px;font-weight:800">
                  Grand Total (${bills.length} bill${bills.length !== 1 ? 's' : ''})
                </td>
                <td style="border:1px solid #ccc;padding:7px 10px;text-align:right;font-weight:800">${fmt(totals.grand_total)}</td>
              </tr></tfoot>
            </table>
            <div style="text-align:center;margin-top:28px;font-size:11px;color:#aaa">— End of Report —</div>
          </div>
        `;

        const root = document.getElementById('root');
        root.style.display = 'none';
        window.print();
        root.style.display = '';
        printContainer.innerHTML = '';
      }, 300);
    } catch {
      alert('Failed to load report data for printing');
    }
  };

  // Internal report helpers
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
    { k: 'purreturn', label: '↩️ Purchase Return Report' },
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
              style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
              🖨️ Print
            </button>
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
          {/* ── Sale Report ── */}
          {tab === 'sale' && (
            <>
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
                <div className="empty-state">
                  <div className="icon">📊</div>
                  <div>Use the Filter button to load totals, or 🖨️ Print to generate a report.</div>
                </div>
              )}
            </>
          )}

          {/* ── Item-wise Report ── */}
          {tab === 'itemwise' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr><th>Product</th><th>Barcode</th><th>MRP</th><th>Qty Sold</th><th>Total Revenue</th></tr>
                </thead>
                <tbody>
                  {itemData.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{item.product_name}</td>
                      <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{item.product_barcode}</span></td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmt(item.mrp)}</td>
                      <td><span className="badge badge-blue">{item.quantity_sold}</span></td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {itemData.length === 0 && (
                <div className="empty-state"><div className="icon">📦</div>No item data in this period</div>
              )}
            </div>
          )}

          {/* ── Internal Sale Report ── */}
          {tab === 'internal' && (
            <>
              {masters.length > 0 && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 10 }}>
                    Filter by Destination
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button onClick={() => setSelDests([])} className="btn btn-sm" style={{
                      background: selDests.length === 0 ? 'var(--accent-dim)' : 'var(--bg3)',
                      color:      selDests.length === 0 ? 'var(--accent)'     : 'var(--text2)',
                      border:    `1px solid ${selDests.length === 0 ? 'var(--accent)' : 'var(--border)'}`,
                    }}>All</button>
                    {masters.map(m => (
                      <button key={m.id} onClick={() => toggleDest(m.id)} className="btn btn-sm" style={{
                        background: selDests.includes(m.id) ? 'var(--accent-dim)' : 'var(--bg3)',
                        color:      selDests.includes(m.id) ? 'var(--accent)'     : 'var(--text2)',
                        border:    `1px solid ${selDests.includes(m.id) ? 'var(--accent)' : 'var(--border)'}`,
                      }}>{m.name}</button>
                    ))}
                    <button className="btn btn-primary btn-sm" onClick={() => fetchReport()} style={{ marginLeft: 'auto' }}>
                      Apply Filter
                    </button>
                  </div>
                </div>
              )}
              {intData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card">
                    <div className="label">Total Items Transferred</div>
                    <div className="value" style={{ color: 'var(--purple)', fontSize: 22 }}>{intTotalQty}</div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Destinations Used</div>
                    <div className="value" style={{ color: 'var(--blue)', fontSize: 22 }}>{Object.keys(intByDest).length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Total Value Transferred</div>
                    <div className="value" style={{ color: 'var(--accent)', fontSize: 22 }}>{fmt(intGrandTotal)}</div>
                  </div>
                </div>
              )}
              {Object.keys(intByDest).length === 0 ? (
                <div className="empty-state"><div className="icon">🏭</div>No internal sales in this period</div>
              ) : (
                Object.entries(intByDest).map(([destName, group]) => (
                  <div key={destName} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ padding: '12px 16px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>🏭 {destName}</div>
                      <div style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 700 }}>{fmt(group.total)}</div>
                    </div>
                    <table>
                      <thead><tr><th>Product</th><th>Barcode</th><th>MRP</th><th>Qty</th><th>Total Value</th></tr></thead>
                      <tbody>
                        {group.items.map((item, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, color: 'var(--text)' }}>{item.product_name}</td>
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
              {purRetData && purRetData.returns.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card">
                    <div className="label">Total Returns</div>
                    <div className="value" style={{ color: 'var(--red)', fontSize: 22 }}>{purRetData.returns.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Total Qty Returned</div>
                    <div className="value" style={{ color: 'var(--yellow)', fontSize: 22 }}>
                      {purRetData.returns.reduce((s, r) => s + r.quantity, 0).toFixed(3)}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="label">Total Cost Returned</div>
                    <div className="value" style={{ color: 'var(--accent)' }}>{fmt(purRetData.total_cost)}</div>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Barcode</th>
                      <th>Qty</th>
                      <th>Purchase Price (₹)</th>
                      <th>Tax (%)</th>
                      <th>Item Cost (₹)</th>
                      <th>Reason</th>
                      <th>Date</th>
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
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(r.date).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!purRetData || purRetData.returns.length === 0) && (
                  <div className="empty-state">
                    <div className="icon">↩️</div>
                    No purchase returns in this period
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {showPrintModal && (
        <PrintModal onClose={() => setShowPrintModal(false)} onPrint={handlePrint} />
      )}
    </div>
  );
}