import React from 'react';

const fmt = n => `₹${parseFloat(n || 0).toFixed(2)}`;

const payLabel = {
  cash:      'Cash',
  card:      'Card',
  upi:       'UPI',
  cash_card: 'Cash & Card',
  cash_upi:  'Cash & UPI',
};

export default function PrintBill({ bill, onClose }) {
  if (!bill) return null;

  const items   = bill.items || [];
  const total   = parseFloat(bill.total_amount || 0);

// ── CGST / SGST: tax on cost_per_item × qty sold ─────────────────────────
  let totalTax = 0;
  items.forEach(item => {
    const tax         = parseFloat(item.tax         || 0);   // tax % from last purchase
    const costPerItem = parseFloat(item.cost_per_item || 0); // purchase_price ÷ selling_qty
    const qty         = parseFloat(item.quantity    || 0);
    totalTax += costPerItem * qty * tax / 100;
  });
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 380, padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Action buttons — hidden on print */}
        <div className="no-print" style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg2)',
        }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
            onClick={handlePrint}>
            🖨️ Print Bill
          </button>
          <button className="btn btn-secondary" onClick={onClose}>✕ Close</button>
        </div>

        {/* Bill content */}
        <div id="print-bill-content" style={{
          padding: '20px 24px',
          fontFamily: 'monospace',
          fontSize: 13,
          color: '#000',
          background: '#fff',
          lineHeight: 1.6,
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>BAKESALE</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
              GST IN: 27AAACB7450P1ZV<br />
              fssai: 10012022000234<br />
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

          {/* Bill meta */}
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Bill No</span>
              <span style={{ fontWeight: 700 }}>{bill.bill_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Date</span>
              <span>{new Date(bill.created_at).toLocaleDateString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Time</span>
              <span>{new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Payment</span>
              <span>{payLabel[bill.payment_type] || bill.payment_type}</span>
            </div>
            {bill.created_by_username && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cashier</span>
                <span>{bill.created_by_username}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

          {/* Items header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
            <span>Item</span>
            <span style={{ textAlign: 'center' }}>Qty</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
          </div>

          {/* Items */}
          {items.map((item, i) => {
            const qty      = parseFloat(item.quantity  || 0);
            const price    = parseFloat(item.price     || 0);
            const subtotal = qty * price;
            return (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                  <span style={{ textAlign: 'center', color: '#555' }}>
                    {qty % 1 === 0 ? qty : qty.toFixed(3)}
                  </span>
                  <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(subtotal)}</span>
                </div>
               
              </div>
            );
          })}

          {/* Divider */}
          <div style={{ borderTop: '1px dashed #999', margin: '8px 0' }} />

          {/* CGST / SGST totals — show only if tax > 0 */}
          {totalTax > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                <span>CGST</span>
                <span>{fmt(cgst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                <span>SGST</span>
                <span>{fmt(sgst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
                <span>Total Tax</span>
                <span>{fmt(totalTax)}</span>
              </div>
              <div style={{ borderTop: '1px dashed #ccc', marginTop: 4 }} />
            </div>
          )}

          {/* Grand Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, marginTop: 4 }}>
            <span>TOTAL</span>
            <span>{fmt(total)}</span>
          </div>

          {/* Payment breakdown for split payments */}
          {['cash_card', 'cash_upi'].includes(bill.payment_type) && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
              {parseFloat(bill.cash_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash</span><span>{fmt(bill.cash_amount)}</span>
                </div>
              )}
              {parseFloat(bill.card_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Card</span><span>{fmt(bill.card_amount)}</span>
                </div>
              )}
              {parseFloat(bill.upi_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>UPI</span><span>{fmt(bill.upi_amount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px dashed #999', margin: '12px 0 8px' }} />

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: 11, color: '#888' }}>
            <div>Thank you for your purchase!</div>
            <div style={{ marginTop: 2 }}>Items sold are non-returnable</div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-bill-content, #print-bill-content * { visibility: visible; }
          #print-bill-content {
            position: fixed;
            top: 0; left: 0;
            width: 80mm;
            padding: 8px;
            font-size: 12px;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}