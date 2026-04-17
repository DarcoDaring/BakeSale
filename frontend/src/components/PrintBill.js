import React, { useRef } from 'react';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;

export default function PrintBill({ bill, onClose }) {
  const printRef = useRef();

  const handlePrint = () => window.print();

  return (
    <div className="modal-overlay no-print">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>🖨️ Print Bill</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        {/* Printable Receipt */}
        <div ref={printRef} style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>🧁 BAKESALE</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Billing Management System</div>
            <div style={{ borderTop: '1px dashed var(--border)', margin: '8px 0' }} />
            <div style={{ fontSize: 12 }}>Bill No: <strong style={{ color: 'var(--accent)' }}>{bill.bill_number}</strong></div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(bill.created_at).toLocaleString()}</div>
          </div>

          <div style={{ borderTop: '1px dashed var(--border)', margin: '8px 0' }} />

          {/* Items */}
          {bill.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                <div style={{ color: 'var(--text3)', fontSize: 11 }}>{item.quantity} × {fmt(item.price)}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{fmt(item.quantity * item.price)}</div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed var(--border)', margin: '8px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
            <span>TOTAL</span>
            <span style={{ color: 'var(--accent)' }}>{fmt(bill.total_amount)}</span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
            Payment: <strong style={{ color: 'var(--text2)', textTransform: 'uppercase' }}>{bill.payment_type}</strong>
            {bill.payment_type === 'mixed' && (
              <span> (Cash: {fmt(bill.cash_amount)} | Card: {fmt(bill.card_amount)})</span>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
            Thank you for your purchase! 🙏
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}
