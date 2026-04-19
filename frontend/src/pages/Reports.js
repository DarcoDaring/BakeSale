import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  getSaleReport, getItemWiseReport,
  getInternalSaleReport, getInternalMasters,
  getPurchaseReturnReport, getPurchaseReport,
  getPurchaseBill, markPurchaseReturned,
  getSalesTaxReport, getPurchaseTaxReport,markPurchasePaid,
  getDirectMasters, createDirectMaster, updateDirectMaster, createDirectSale, getDirectSaleReport
} from '../services/api';
import { usePermissions } from '../context/PermissionContext';
const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;
const payLabel = { cash:'Cash', card:'Card', upi:'UPI', cash_card:'Cash & Card', cash_upi:'Cash & UPI' };
const today = () => new Date().toISOString().split('T')[0];

function doPrint(html) {
  let el = document.getElementById('bakesale-print-container');
  if (!el) { el = document.createElement('div'); el.id = 'bakesale-print-container'; document.body.appendChild(el); }
  el.innerHTML = html;
  const root = document.getElementById('root');
  root.style.display = 'none';
  window.print();
  root.style.display = '';
  el.innerHTML = '';
}

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
        <h2>🖨️ {title}</h2>
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
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handlePrint} disabled={loading}>
            {loading ? 'Preparing…' : '🖨️ Print'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function PurchaseBillDetailModal({ billId, onClose }) {
  const [bill, setBill]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPurchaseBill(billId).then(r => setBill(r.data))
      .catch(() => { alert('Failed to load bill'); onClose(); })
      .finally(() => setLoading(false));
  }, [billId]);

  if (loading) return <div className="modal-overlay"><div className="modal" style={{ maxWidth: 700 }}><div className="spinner" /></div></div>;
  if (!bill) return null;

  const totalValue = bill.items.reduce((s, item) => {
    const qty   = parseFloat(item.quantity);
    const price = parseFloat(item.purchase_price);
    const tax   = parseFloat(item.tax);
    const base  = qty * price;
    return s + base + base * tax / 100;
  }, 0);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0 }}>📦 Purchase Detail</h2>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center' }}>
              <span className="badge badge-orange" style={{ fontFamily: 'var(--mono)', fontSize: 14 }}>{bill.purchase_number}</span>
              <span className={`badge ${bill.is_paid ? 'badge-green' : 'badge-yellow'}`}>{bill.is_paid ? '✅ Paid' : '⏳ Not Paid'}</span>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>{new Date(bill.date).toLocaleString()}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Vendor</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{bill.vendor_name || '—'}</div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table>
            <thead>
              <tr><th>Product</th><th>Pur. Unit</th><th>Qty</th><th>Price/Unit</th><th>Tax %</th><th>Tax (₹)</th><th>MRP</th><th>Total Value</th></tr>
            </thead>
            <tbody>
              {bill.items.map((item, i) => {
                const qty      = parseFloat(item.quantity);
                const price    = parseFloat(item.purchase_price);
                const taxRate  = parseFloat(item.tax);
                const base     = qty * price;
                const taxAmt   = base * taxRate / 100;
                const totalVal = base + taxAmt;
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{item.product_barcode}</div>
                    </td>
                    <td><span className="badge badge-blue">{item.purchase_unit}</span></td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{qty}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{fmt(price)}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{taxRate}%</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{fmt(taxAmt)}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{fmt(item.mrp)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalVal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: '2px solid var(--accent)', padding: '14px 16px', display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <span style={{ color: 'var(--text3)', fontSize: 14 }}>Total Purchase Value (incl. tax)</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{fmt(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

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
                  <td style={{ fontWeight: 600 }}>{r.product_name}</td>
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
            <thead><tr><th>PO Number</th><th>Vendor</th><th>Date</th><th>Total Value</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={i} style={{ cursor: 'pointer' }} onClick={() => onViewDetail(b.id)}>
                  <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.purchase_number}</span></td>
                  <td style={{ fontWeight: 600 }}>{b.vendor_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.date).toLocaleDateString()}</td>
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

export default function Reports() {
  const { isAdmin, can } = usePermissions();
  const [tab,            setTab]            = useState('sale');
  const [saleData,       setSaleData]       = useState(null);
  const [itemData,       setItemData]       = useState([]);
  const [intData,        setIntData]        = useState([]);
  const [purRetData,     setPurRetData]     = useState(null);
  const [purData,        setPurData]        = useState(null);
  const [salesTaxData,   setSalesTaxData]   = useState(null);
  const [purTaxData,     setPurTaxData]     = useState(null);
  const [masters,        setMasters]        = useState([]);
  const [selDests,       setSelDests]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [taxRateFilter,  setTaxRateFilter]  = useState('');  // for sales tax tab
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPurPrint,   setShowPurPrint]   = useState(false);
  const [showSalesTaxPrint, setShowSalesTaxPrint] = useState(false);
  const [showPurTaxPrint,   setShowPurTaxPrint]   = useState(false);
  const [detailBillId,   setDetailBillId]   = useState(null);
  const [showPendingRet, setShowPendingRet] = useState(false);
  const [purListModal,   setPurListModal]   = useState(null);
  const [markingId,      setMarkingId]      = useState(null);
  const [markingPaidId, setMarkingPaidId] = useState(null);
  const [directData,    setDirectData]    = useState(null);
  const [showPurRetPrint,   setShowPurRetPrint]   = useState(false);
  const [showItemwisePrint, setShowItemwisePrint] = useState(false);
  const [showInternalPrint, setShowInternalPrint] = useState(false);
  const [showDirectPrint,   setShowDirectPrint]   = useState(false);

  useEffect(() => { getInternalMasters().then(r => setMasters(r.data)); }, []);

  useEffect(() => {
    if (tab === 'sale')      fetchReport('sale');
    if (tab === 'purchase')  fetchReport('purchase');
    if (tab === 'purreturn') fetchReport('purreturn');
    if (tab === 'salestax')  fetchReport('salestax');
    if (tab === 'purtax')    fetchReport('purtax');
    if (tab === 'direct')    fetchReport('direct');
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
      } else if (activeTab === 'salestax') {
        if (taxRateFilter) params.tax_rate = taxRateFilter;
        const { data } = await getSalesTaxReport(params);
        setSalesTaxData(data);
      } else if (activeTab === 'purtax') {
        const { data } = await getPurchaseTaxReport(params);
        setPurTaxData(data);
      } else if (activeTab === 'direct') {
        const { data } = await getDirectSaleReport(params);
        setDirectData(data);
      }
    } catch {}
    setLoading(false);
  };

  const toggleDest = id => setSelDests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Auto-fetch internal sale when destination filter changes
  useEffect(() => {
    if (tab === 'internal') fetchReport('internal');
  }, [selDests]);

  const handleMarkReturned = async id => {
    setMarkingId(id);
    try { await markPurchaseReturned(id); toast.success('Marked as returned'); fetchReport('purreturn'); }
    catch { toast.error('Failed to update status'); }
    finally { setMarkingId(null); }
  };
const handleMarkPaid = async (billId) => {
  setMarkingPaidId(billId);
  try {
    await markPurchasePaid(billId);
    toast.success('Marked as paid ✅');
    fetchReport('purchase');
  } catch { toast.error('Failed to mark as paid'); }
  finally { setMarkingPaidId(null); }
};
  const handleSalePrint = async (from, to) => {
    try {
      const { data } = await getSaleReport({ date_from: from, date_to: to });
      setShowPrintModal(false);
      setTimeout(() => {
        const { bills, totals } = data;
        doPrint(`
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
              <tbody>${(bills || []).map((b, i) => `
                <tr style="background:${i%2===0?'#fff':'#fafafa'}">
                  <td style="border:1px solid #ccc;padding:6px;font-weight:600">${b.bill_number}</td>
                  <td style="border:1px solid #ccc;padding:6px">${new Date(b.created_at).toLocaleString()}</td>
                  <td style="border:1px solid #ccc;padding:6px">${payLabel[b.payment_type]||b.payment_type}</td>
                  <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(b.total_amount)}</td>
                </tr>`).join('')}</tbody>
              <tfoot><tr style="background:#f0f0f0">
                <td colspan="3" style="border:1px solid #ccc;padding:7px;font-weight:800">Grand Total</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:800">${fmt(totals.grand_total)}</td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load report for printing'); }
  };

  const handlePurchasePrint = async (from, to) => {
    try {
      const { data } = await getPurchaseReport({ date_from: from, date_to: to });
      setShowPurPrint(false);
      setTimeout(() => {
        const { bills, grand_total } = data;
        doPrint(`
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
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Purchase Value</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Tax (₹)</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:center">Payment</th>
              </tr></thead>
              <tbody>${(bills||[]).map((b, i) => `
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
                <td colspan="5" style="border:1px solid #ccc;padding:7px;font-weight:800">Grand Total</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right;font-weight:800">${fmt(grand_total)}</td>
                <td style="border:1px solid #ccc;padding:7px"></td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load purchase report'); }
  };

  const handleSalesTaxPrint = async (from, to) => {
    try {
      const { data } = await getSalesTaxReport({ date_from: from, date_to: to });
      setShowSalesTaxPrint(false);
      setTimeout(() => {
        const rows = (data.items || []).map((b, i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px">${b.bill_number}</td>
            <td style="border:1px solid #ccc;padding:6px">${new Date(b.date).toLocaleDateString()}</td>
            <td style="border:1px solid #ccc;padding:6px">${b.product_name}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${b.quantity}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.taxable_amount)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:center">${b.tax_rate}% (CGST ${b.cgst_rate}% / SGST ${b.sgst_rate}%)</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.cgst)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.sgst)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(b.total_tax)}</td>
          </tr>`).join('');
        doPrint(`
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:15px;font-weight:600">Sales Tax Report</div>
              <div style="font-size:12px;color:#555">${from} to ${to}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:6px">Bill No</th>
                <th style="border:1px solid #ccc;padding:6px">Date</th>
                <th style="border:1px solid #ccc;padding:6px">Product</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">Qty</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">Taxable Amt</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:center">Tax Rate</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">CGST</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">SGST</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">Total Tax</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#f0f0f0;font-weight:800">
                <td colspan="4" style="border:1px solid #ccc;padding:6px">TOTAL</td>
                <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(data.grand_taxable)}</td>
                <td style="border:1px solid #ccc;padding:6px"></td>
                <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(data.grand_cgst)}</td>
                <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(data.grand_sgst)}</td>
                <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(data.grand_tax)}</td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load sales tax report'); }
  };

  const handlePurTaxPrint = async (from, to) => {
    try {
      const { data } = await getPurchaseTaxReport({ date_from: from, date_to: to });
      setShowPurTaxPrint(false);
      setTimeout(() => {
        const rows = (data.bills || []).map((b, i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px;font-weight:600;font-family:monospace">${b.purchase_number}</td>
            <td style="border:1px solid #ccc;padding:6px">${new Date(b.date).toLocaleDateString()}</td>
            <td style="border:1px solid #ccc;padding:6px">${b.vendor_name}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.taxable_amount)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.cgst)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(b.sgst)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(b.total_tax)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(b.total_amount)}</td>
          </tr>`).join('');
        doPrint(`
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:15px;font-weight:600">Purchase Tax Report</div>
              <div style="font-size:12px;color:#555">${from} to ${to}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px">PO Number</th>
                <th style="border:1px solid #ccc;padding:7px">Date</th>
                <th style="border:1px solid #ccc;padding:7px">Vendor</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Taxable Amount</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">CGST</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">SGST</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total Tax</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total Amount</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#f0f0f0;font-weight:800">
                <td colspan="3" style="border:1px solid #ccc;padding:7px">TOTAL</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(data.grand_taxable)}</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(data.grand_cgst)}</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(data.grand_sgst)}</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(data.grand_tax)}</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(data.grand_total)}</td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load purchase tax report'); }
  };

  const handlePurRetPrint = async (from, to) => {
    try {
      const { data } = await getPurchaseReturnReport({ date_from: from, date_to: to });
      setShowPurRetPrint(false);
      setTimeout(() => {
        const rows = (data.returns || []).map((r, i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px;font-weight:600">${r.product_name}</td>
            <td style="border:1px solid #ccc;padding:6px;font-family:monospace;font-size:11px">${r.product_barcode}</td>
            <td style="border:1px solid #ccc;padding:6px">${r.vendor_name || '—'}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${r.quantity}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(r.purchase_price)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:center">${r.tax}%</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(r.item_cost)}</td>
            <td style="border:1px solid #ccc;padding:6px">${r.reason || '—'}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:center">${r.status === 'returned' ? 'Returned' : 'Pending'}</td>
            <td style="border:1px solid #ccc;padding:6px">${new Date(r.date).toLocaleDateString()}</td>
          </tr>`).join('');
        doPrint(`
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px;font-weight:600">Purchase Return Report</div>
              <div style="font-size:11px;color:#888">${from} to ${to} · Printed: ${new Date().toLocaleString()}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:6px">Product</th>
                <th style="border:1px solid #ccc;padding:6px">Barcode</th>
                <th style="border:1px solid #ccc;padding:6px">Vendor</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">Qty</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">Purchase Price</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:center">Tax</th>
                <th style="border:1px solid #ccc;padding:6px;text-align:right">Item Cost</th>
                <th style="border:1px solid #ccc;padding:6px">Reason</th>
                <th style="border:1px solid #ccc;padding:6px">Status</th>
                <th style="border:1px solid #ccc;padding:6px">Date</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#f0f0f0;font-weight:800">
                <td colspan="6" style="border:1px solid #ccc;padding:6px">TOTAL COST</td>
                <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(data.total_cost)}</td>
                <td colspan="3" style="border:1px solid #ccc;padding:6px"></td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load purchase return report'); }
  };

  const handleItemwisePrint = async (from, to) => {
    try {
      const { data } = await getItemWiseReport({ date_from: from, date_to: to });
      setShowItemwisePrint(false);
      setTimeout(() => {
        const items = Array.isArray(data) ? data : [];
        const grandTotal = items.reduce((s, r) => s + r.total_amount, 0);
        const rows = items.map((r, i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px;font-weight:600">${r.product_name}</td>
            <td style="border:1px solid #ccc;padding:6px;font-family:monospace;font-size:11px">${r.product_barcode}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(r.mrp)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${parseFloat(r.quantity_sold).toFixed(3)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(r.total_amount)}</td>
          </tr>`).join('');
        doPrint(`
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px;font-weight:600">Item-wise Sale Report</div>
              <div style="font-size:11px;color:#888">${from} to ${to} · Printed: ${new Date().toLocaleString()}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px">Product</th>
                <th style="border:1px solid #ccc;padding:7px">Barcode</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">MRP</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Qty Sold</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total Amount</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#f0f0f0;font-weight:800">
                <td colspan="4" style="border:1px solid #ccc;padding:7px">GRAND TOTAL</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(grandTotal)}</td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load item-wise report'); }
  };

  const handleInternalPrint = async (from, to) => {
    try {
      const { data } = await getInternalSaleReport({ date_from: from, date_to: to });
      setShowInternalPrint(false);
      setTimeout(() => {
        const items = Array.isArray(data) ? data : [];
        const grandTotal = items.reduce((s, r) => s + r.total_amount, 0);
        const rows = items.map((r, i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px;font-weight:600">${r.destination_name}</td>
            <td style="border:1px solid #ccc;padding:6px">${r.product_name}</td>
            <td style="border:1px solid #ccc;padding:6px;font-family:monospace;font-size:11px">${r.product_barcode}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${fmt(r.mrp)}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right">${r.quantity}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(r.total_amount)}</td>
          </tr>`).join('');
        doPrint(`
          <div style="font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px;font-weight:600">Internal Sale Report</div>
              <div style="font-size:11px;color:#888">${from} to ${to} · Printed: ${new Date().toLocaleString()}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px">Destination</th>
                <th style="border:1px solid #ccc;padding:7px">Product</th>
                <th style="border:1px solid #ccc;padding:7px">Barcode</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">MRP</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Qty</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Total</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#f0f0f0;font-weight:800">
                <td colspan="5" style="border:1px solid #ccc;padding:7px">GRAND TOTAL</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(grandTotal)}</td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load internal sale report'); }
  };

  const handleDirectPrint = async (from, to) => {
    try {
      const { data } = await getDirectSaleReport({ date_from: from, date_to: to });
      setShowDirectPrint(false);
      setTimeout(() => {
        const rows = (data.sales || []).map((s, i) => `
          <tr style="background:${i%2===0?'#fff':'#fafafa'}">
            <td style="border:1px solid #ccc;padding:6px;font-weight:600">${s.item_name}</td>
            <td style="border:1px solid #ccc;padding:6px;text-align:right;font-weight:600">${fmt(s.price)}</td>
            <td style="border:1px solid #ccc;padding:6px">${payLabel[s.payment_type]||s.payment_type}</td>
            <td style="border:1px solid #ccc;padding:6px">${new Date(s.date).toLocaleDateString()}</td>
            <td style="border:1px solid #ccc;padding:6px">${s.created_by}</td>
          </tr>`).join('');
        doPrint(`
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#000;background:#fff;padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <div style="font-size:22px;font-weight:800">BAKESALE</div>
              <div style="font-size:14px;font-weight:600">Direct Sale Report</div>
              <div style="font-size:11px;color:#888">${from} to ${to} · Printed: ${new Date().toLocaleString()}</div>
            </div>
            <div style="border:1px solid #ccc;padding:14px;margin-bottom:20px;background:#f9f9f9">
              <table style="width:100%;border-collapse:collapse">
                <tr><td>Cash Total</td><td style="text-align:right;font-weight:600">${fmt(data.cash_total)}</td></tr>
                <tr><td>Card Total</td><td style="text-align:right;font-weight:600">${fmt(data.card_total)}</td></tr>
                <tr><td>UPI Total</td><td style="text-align:right;font-weight:600">${fmt(data.upi_total)}</td></tr>
                <tr style="border-top:2px solid #333"><td style="font-weight:800">Grand Total</td><td style="text-align:right;font-weight:800">${fmt(data.grand_total)}</td></tr>
              </table>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead><tr style="background:#f0f0f0">
                <th style="border:1px solid #ccc;padding:7px">Item</th>
                <th style="border:1px solid #ccc;padding:7px;text-align:right">Amount</th>
                <th style="border:1px solid #ccc;padding:7px">Payment</th>
                <th style="border:1px solid #ccc;padding:7px">Date</th>
                <th style="border:1px solid #ccc;padding:7px">By</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot><tr style="background:#f0f0f0;font-weight:800">
                <td style="border:1px solid #ccc;padding:7px">TOTAL</td>
                <td style="border:1px solid #ccc;padding:7px;text-align:right">${fmt(data.grand_total)}</td>
                <td colspan="3" style="border:1px solid #ccc;padding:7px"></td>
              </tr></tfoot>
            </table>
          </div>`);
      }, 300);
    } catch { alert('Failed to load direct sale report'); }
  };

  const intByDest     = intData.reduce((acc, row) => {
    const key = row.destination_name;
    if (!acc[key]) acc[key] = { items: [], total: 0 };
    acc[key].items.push(row); acc[key].total += row.total_amount;
    return acc;
  }, {});
  const intGrandTotal = intData.reduce((s, r) => s + r.total_amount, 0);
  const intTotalQty   = intData.reduce((s, r) => s + r.quantity, 0);

  const ALL_TABS = [
    { k: 'sale',      label: 'Sale Report',       perm: 'can_view_sale_report' },
    { k: 'purchase',  label: 'Purchase Report',    perm: 'can_view_purchase_report' },
    { k: 'purreturn', label: 'Purchase Returns',   perm: 'can_view_purreturn_report' },
    { k: 'salestax',  label: 'Sales Tax',          perm: 'can_view_salestax_report' },
    { k: 'purtax',    label: 'Purchase Tax',       perm: 'can_view_purtax_report' },
    { k: 'itemwise',  label: 'Item-wise Sale',     perm: 'can_view_itemwise_report' },
    { k: 'internal',  label: 'Internal Sale',      perm: 'can_view_internal_report' },
    { k: 'direct',    label: 'Direct Sale',        perm: 'can_view_direct_report' },
  ];
  const TABS = ALL_TABS.filter(t => isAdmin || can(t.perm));

  return (
    <div>
      <div className="page-header">
        <h1>📊 Reports</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 155 }} />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ width: 155 }} />
          <button className="btn btn-primary" onClick={() => fetchReport()}>Filter</button>
          <button className="btn btn-secondary" onClick={() => fetchReport()}>🔄 Refresh</button>
          {tab === 'sale' && (isAdmin || can ('can_print_reports'))     && (<button className="btn btn-secondary" onClick={() => setShowPrintModal(true)} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>🖨️ Print</button>)}
          {tab === 'purchase' && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowPurPrint(true)} style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>🖨️ Print Report</button>)}
          {tab === 'salestax' && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowSalesTaxPrint(true)} style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>🖨️ Print Report</button>)}
          {tab === 'purtax'   && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowPurTaxPrint(true)} style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>🖨️ Print Report</button>)}
          {tab === 'purreturn' && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowPurRetPrint(true)} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>🖨️ Print Report</button>)}
          {tab === 'itemwise' && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowItemwisePrint(true)} style={{ color: 'var(--purple)', borderColor: 'var(--purple)' }}>🖨️ Print Report</button>)}
          {tab === 'internal' && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowInternalPrint(true)} style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>🖨️ Print Report</button>)}
          {tab === 'direct'   && (isAdmin || can ('can_print_reports')) && (<button className="btn btn-secondary" onClick={() => setShowDirectPrint(true)} style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>🖨️ Print Report</button>)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} className="btn" style={{
            background: tab === t.k ? 'var(--accent)' : 'var(--surface)',
            color:      tab === t.k ? '#fff'          : 'var(--text2)',
            border:    `1px solid ${tab === t.k ? 'var(--accent)' : 'var(--border)'}`,
            fontSize: 13, fontWeight: 600,
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          {/* ── Sale Report ── */}
          {tab === 'sale' && (
            <>
              {saleData && <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text3)' }}>
                Showing: <b style={{ color: 'var(--text)' }}>{dateFrom}</b> to <b style={{ color: 'var(--text)' }}>{dateTo}</b>
              </div>}
              {saleData ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
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
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table>
                      <thead><tr><th>Bill No</th><th>Date & Time</th><th>Payment</th><th>Total</th></tr></thead>
                      <tbody>
                        {(saleData.bills || []).map((b, i) => (
                          <tr key={i}>
                            <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.bill_number}</span></td>
                            <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.created_at).toLocaleString()}</td>
                            <td>{payLabel[b.payment_type] || b.payment_type}</td>
                            <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(b.total_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(!saleData.bills || saleData.bills.length === 0) && <div className="empty-state"><div className="icon">🧾</div>No sales in this period</div>}
                  </div>
                </>
              ) : <div className="empty-state"><div className="icon">📊</div><div>Loading today's report…</div></div>}
            </>
          )}

          {/* ── Item-wise ── */}
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

          {/* ── Internal Sale ── */}
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
                  </div>
                </div>
              )}
              {intData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card"><div className="label">Total Items Transferred</div><div className="value" style={{ color: 'var(--purple)', fontSize: 22 }}>{intTotalQty}</div></div>
                  <div className="stat-card"><div className="label">Destinations Used</div><div className="value" style={{ color: 'var(--blue)', fontSize: 22 }}>{Object.keys(intByDest).length}</div></div>
                  <div className="stat-card"><div className="label">Total Value</div><div className="value" style={{ color: 'var(--accent)', fontSize: 22 }}>{fmt(intGrandTotal)}</div></div>
                </div>
              )}
              {Object.keys(intByDest).length === 0 ? (
                <div className="empty-state"><div className="icon">🏭</div>No internal sales in this period</div>
              ) : Object.entries(intByDest).map(([destName, group]) => (
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
              ))}
            </>
          )}

          {/* ── Purchase Return ── */}
          {tab === 'purreturn' && (
            <>
              {purRetData && (
                <div style={{ marginBottom: 20 }}>
                  <div className="stat-card" style={{ maxWidth: 220, cursor: 'pointer', border: purRetData.pending_count > 0 ? '1px solid var(--yellow)' : undefined }}
                    onClick={() => setShowPendingRet(true)}>
                    <div className="label">⏳ Pending Returns</div>
                    <div className="value" style={{ color: purRetData.pending_count > 0 ? 'var(--yellow)' : 'var(--text3)', fontSize: 28 }}>{purRetData.pending_count}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Click to view items</div>
                  </div>
                </div>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead><tr><th>Product</th><th>Barcode</th><th>Vendor</th><th>Qty</th><th>Purchase Price</th><th>Tax</th><th>Item Cost</th><th>Reason</th><th>Date</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {(purRetData?.returns || []).map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.product_name}</td>
                        <td><span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.product_barcode}</span></td>
                        <td style={{ color: 'var(--text3)', fontSize: 13 }}>{r.vendor_name || '—'}</td>
                        <td><span className="badge badge-red">{r.quantity}</span></td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(r.purchase_price)}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{r.tax}%</td>
                        <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(r.item_cost)}</td>
                        <td style={{ color: 'var(--text3)', fontSize: 13 }}>{r.reason || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(r.date).toLocaleDateString()}</td>
                        <td><span className={`badge ${r.status === 'returned' ? 'badge-green' : 'badge-yellow'}`}>{r.status === 'returned' ? '✅ Returned' : '⏳ Pending'}</span></td>
                        <td>
                          {r.status === 'pending' && (
                            <button className="btn btn-sm" style={{ color: 'var(--green)', borderColor: 'var(--green)', background: 'var(--green-dim)', fontSize: 12 }}
                              onClick={() => handleMarkReturned(r.id)} disabled={markingId === r.id}>
                              {markingId === r.id ? '…' : '✅ Product Returned'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!purRetData || purRetData.returns.length === 0) && <div className="empty-state"><div className="icon">↩️</div>No purchase returns in this period</div>}
              </div>
            </>
          )}

          {/* ── Purchase Report ── */}
          {tab === 'purchase' && (
            <>
              {/* Only Not Paid — permanent, no Paid card */}
              {purData && (
                <div style={{ marginBottom: 20 }}>
                  <div className="stat-card" style={{ maxWidth: 240, cursor: 'pointer', border: '1px solid var(--yellow)' }}
                    onClick={() => setPurListModal({ bills: (purData.bills || []).filter(b => !b.is_paid), title: '⏳ Not Paid Purchases' })}>
                    <div className="label">⏳ Not Paid</div>
                    <div className="value" style={{ color: 'var(--yellow)' }}>{(purData.bills || []).filter(b => !b.is_paid).length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Click to view bills</div>
                  </div>
                </div>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th><th>Vendor</th><th>Date</th><th>Items</th>
                      <th>Purchase Value</th><th>Tax %</th><th>Tax (₹)</th><th>Total Value</th>
                      <th>Payment</th><th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(purData?.bills || []).map((b, i) => {
                      const taxPct = b.total_purchase_price > 0
                        ? ((b.total_tax / b.total_purchase_price) * 100).toFixed(1) + '%'
                        : '—';
                      return (
                        <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setDetailBillId(b.id)}>
                          <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.purchase_number}</span></td>
                          <td style={{ fontWeight: 600 }}>{b.vendor_name}</td>
                          <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.date).toLocaleDateString()}</td>
                          <td><span className="badge badge-blue">{b.item_count}</span></td>
                          <td style={{ fontFamily: 'var(--mono)' }}>{fmt(b.total_purchase_price)}</td>
                          <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{taxPct}</td>
                          <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{fmt(b.total_tax)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(b.total_value)}</td>
                          <td><span className={`badge ${b.is_paid ? 'badge-green' : 'badge-yellow'}`}>{b.is_paid ? '✅ Paid' : '⏳ Not Paid'}</span></td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => setDetailBillId(b.id)}>🔍 View</button>
                              {!b.is_paid && (
                                <button className="btn btn-sm"
                                  onClick={() => handleMarkPaid(b.id)}
                                  disabled={markingPaidId === b.id}
                                  style={{ color: 'var(--green)', borderColor: 'var(--green)', background: 'var(--green-dim)', fontSize: 12 }}>
                                  {markingPaidId === b.id ? '…' : '✅ Mark Paid'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!purData || purData.bills.length === 0) && <div className="empty-state"><div className="icon">📦</div>No purchases. Use Filter to search by date.</div>}
              </div>
            </>
          )}

          {/* ── Sales Tax Report — ITEM BASED ── */}
          {tab === 'salestax' && (
            <>
              {/* Tax Rate Filter */}
              {salesTaxData && salesTaxData.available_tax_rates && salesTaxData.available_tax_rates.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Filter by Tax Rate</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" onClick={() => { setTaxRateFilter(''); fetchReport('salestax'); }}
                      style={{ background: !taxRateFilter ? 'var(--accent)' : 'var(--bg3)', color: !taxRateFilter ? '#fff' : 'var(--text2)', border: `1px solid ${!taxRateFilter ? 'var(--accent)' : 'var(--border)'}` }}>
                      All Rates
                    </button>
                    {salesTaxData.available_tax_rates.map(rate => (
                      <button key={rate} className="btn btn-sm"
                        onClick={() => { setTaxRateFilter(String(rate)); setTimeout(() => fetchReport('salestax'), 50); }}
                        style={{ background: taxRateFilter === String(rate) ? 'var(--accent)' : 'var(--bg3)', color: taxRateFilter === String(rate) ? '#fff' : 'var(--text2)', border: `1px solid ${taxRateFilter === String(rate) ? 'var(--accent)' : 'var(--border)'}` }}>
                        {rate}% (CGST {rate/2}% / SGST {rate/2}%)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {salesTaxData && salesTaxData.items && salesTaxData.items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card"><div className="label">Taxable Amount</div><div className="value" style={{ color: 'var(--accent)' }}>{fmt(salesTaxData.grand_taxable)}</div></div>
                  <div className="stat-card"><div className="label">Total CGST</div><div className="value" style={{ color: 'var(--green)' }}>{fmt(salesTaxData.grand_cgst)}</div></div>
                  <div className="stat-card"><div className="label">Total SGST</div><div className="value" style={{ color: 'var(--yellow)' }}>{fmt(salesTaxData.grand_sgst)}</div></div>
                  <div className="stat-card"><div className="label">Total Tax</div><div className="value" style={{ color: 'var(--blue)' }}>{fmt(salesTaxData.grand_tax)}</div></div>
                </div>
              )}

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bill No</th><th>Date</th><th>Product</th><th>Qty</th>
                      <th>Taxable Amount</th><th>Tax Rate</th>
                      <th>CGST Rate</th><th>CGST (₹)</th>
                      <th>SGST Rate</th><th>SGST (₹)</th>
                      <th>Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesTaxData?.items || []).map((b, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{b.bill_number}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{b.product_name}</td>
                        <td style={{ fontFamily: 'var(--mono)', textAlign: 'right' }}>{b.quantity}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(b.taxable_amount)}</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', textAlign: 'center' }}>{b.tax_rate}%</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', textAlign: 'center' }}>{b.cgst_rate}%</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(b.cgst)}</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', textAlign: 'center' }}>{b.sgst_rate}%</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{fmt(b.sgst)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(b.total_tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!salesTaxData || !salesTaxData.items || salesTaxData.items.length === 0) && (
                  <div className="empty-state"><div className="icon">🧾</div>No sales tax data. Use Filter to search by date.</div>
                )}
              </div>
            </>
          )}

          {/* ── Purchase Tax Report ── */}
          {tab === 'purtax' && (
            <>
              {purTaxData && purTaxData.bills && purTaxData.bills.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card"><div className="label">Taxable Amount</div><div className="value" style={{ color: 'var(--accent)' }}>{fmt(purTaxData.grand_taxable)}</div></div>
                  <div className="stat-card"><div className="label">Total CGST</div><div className="value" style={{ color: 'var(--green)' }}>{fmt(purTaxData.grand_cgst)}</div></div>
                  <div className="stat-card"><div className="label">Total SGST</div><div className="value" style={{ color: 'var(--yellow)' }}>{fmt(purTaxData.grand_sgst)}</div></div>
                  <div className="stat-card"><div className="label">Grand Total</div><div className="value" style={{ color: 'var(--blue)' }}>{fmt(purTaxData.grand_total)}</div></div>
                </div>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>PO Number</th><th>Date</th><th>Vendor</th>
                      <th>Taxable Amount</th>
                      <th>CGST (₹)</th><th>SGST (₹)</th>
                      <th>Total Tax</th><th>Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(purTaxData?.bills || []).map((b, i) => (
                      <tr key={i}>
                        <td><span className="badge badge-orange" style={{ fontFamily: 'var(--mono)' }}>{b.purchase_number}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(b.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{b.vendor_name}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{fmt(b.taxable_amount)}</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--green)' }}>{fmt(b.cgst)}</td>
                        <td style={{ fontFamily: 'var(--mono)', color: 'var(--yellow)' }}>{fmt(b.sgst)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(b.total_tax)}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--blue)' }}>{fmt(b.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!purTaxData || purTaxData.bills.length === 0) && <div className="empty-state"><div className="icon">📋</div>No purchase tax data. Use Filter to search by date.</div>}
              </div>
            </>
          )}
          {/* ── Direct Sale Report ── */}
          {tab === 'direct' && (
            <>
              {directData && directData.sales && directData.sales.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
                  <div className="stat-card"><div className="label">Grand Total</div><div className="value" style={{ color: 'var(--accent)' }}>{fmt(directData.grand_total)}</div></div>
                  <div className="stat-card"><div className="label">Cash</div><div className="value" style={{ color: 'var(--green)' }}>{fmt(directData.cash_total)}</div></div>
                  <div className="stat-card"><div className="label">Card</div><div className="value" style={{ color: 'var(--blue)' }}>{fmt(directData.card_total)}</div></div>
                  <div className="stat-card"><div className="label">UPI</div><div className="value" style={{ color: 'var(--purple)' }}>{fmt(directData.upi_total)}</div></div>
                </div>
              )}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Item Name</th><th>Amount</th><th>Payment</th><th>Date</th><th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(directData?.sales || []).map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{s.item_name}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(s.price)}</td>
                        <td><span className="badge badge-blue">{payLabel[s.payment_type] || s.payment_type}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(s.date).toLocaleString()}</td>
                        <td style={{ fontSize: 12, color: 'var(--text3)' }}>{s.created_by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!directData || !directData.sales || directData.sales.length === 0) && (
                  <div className="empty-state"><div className="icon">💵</div>No direct sales in this period. Use Filter to search by date.</div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {showPrintModal    && <PrintModal title="Print Sale Report"           onClose={() => setShowPrintModal(false)}    onPrint={handleSalePrint} />}
      {showPurPrint      && <PrintModal title="Print Purchase Report"       onClose={() => setShowPurPrint(false)}      onPrint={handlePurchasePrint} />}
      {showSalesTaxPrint && <PrintModal title="Print Sales Tax Report"      onClose={() => setShowSalesTaxPrint(false)} onPrint={handleSalesTaxPrint} />}
      {showPurTaxPrint   && <PrintModal title="Print Purchase Tax Report"   onClose={() => setShowPurTaxPrint(false)}   onPrint={handlePurTaxPrint} />}
      {showPurRetPrint   && <PrintModal title="Print Purchase Return Report" onClose={() => setShowPurRetPrint(false)}  onPrint={handlePurRetPrint} />}
      {showItemwisePrint && <PrintModal title="Print Item-wise Sale Report"  onClose={() => setShowItemwisePrint(false)} onPrint={handleItemwisePrint} />}
      {showInternalPrint && <PrintModal title="Print Internal Sale Report"   onClose={() => setShowInternalPrint(false)} onPrint={handleInternalPrint} />}
      {showDirectPrint   && <PrintModal title="Print Direct Sale Report"     onClose={() => setShowDirectPrint(false)}  onPrint={handleDirectPrint} />}
      {detailBillId      && <PurchaseBillDetailModal billId={detailBillId} onClose={() => setDetailBillId(null)} />}
      {showPendingRet    && purRetData && <PendingReturnsModal returns={purRetData.returns} onClose={() => setShowPendingRet(false)} />}
      {purListModal      && (
        <PurchaseBillsListModal bills={purListModal.bills} title={purListModal.title}
          onClose={() => setPurListModal(null)}
          onViewDetail={id => { setPurListModal(null); setDetailBillId(id); }} />
      )}
    </div>
  );
}