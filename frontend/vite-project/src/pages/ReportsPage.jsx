import { useState } from "react";
import {
  getDailySales,
  getSalesReport,
  getItemSales,
} from "../api/reportApi";

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [salesList, setSalesList] = useState([]);
  const [items, setItems] = useState([]);

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);

  // 📅 Daily (FIXED)
  const loadDaily = async () => {
    try {
      setLoading(true);
      const res = await getDailySales();

      console.log("Daily API:", res.data);

      // ✅ IMPORTANT FIX
      setData(res.data.summary);

      setSalesList([]);
      setItems([]);
    } catch (err) {
      console.error(err);
      alert("Error loading daily report");
    } finally {
      setLoading(false);
    }
  };

  // 📄 Sales report
  const loadSalesReport = async () => {
    if (!start || !end) {
      alert("Please select start and end date");
      return;
    }

    try {
      setLoading(true);
      const res = await getSalesReport(start, end);
      setSalesList(res.data.sales || []);
      setData(null);
      setItems([]);
    } catch (err) {
      console.error(err);
      alert("Error loading sales report");
    } finally {
      setLoading(false);
    }
  };

  // 📦 Item-wise
  const loadItems = async () => {
    if (!start || !end) {
      alert("Please select start and end date");
      return;
    }

    try {
      setLoading(true);
      const res = await getItemSales(start, end);
      setItems(res.data || []);
      setData(null);
      setSalesList([]);
    } catch (err) {
      console.error(err);
      alert("Error loading item report");
    } finally {
      setLoading(false);
    }
  };

  // 🖨️ Print
  const handlePrint = (type) => {
    document.body.classList.add(type === "item" ? "print-item" : "print-sales");

    window.print();

    setTimeout(() => {
      document.body.classList.remove("print-item");
      document.body.classList.remove("print-sales");
    }, 500);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Reports</h2>

      {/* 📆 Date filter */}
      <div style={{ marginTop: "10px" }}>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />

        {(!start || !end) && (
          <p style={{ color: "red" }}>
            Date required for Sales & Item reports only
          </p>
        )}

        <p style={{ color: "gray" }}>
          📅 Daily report shows today's data automatically
        </p>
      </div>

      {/* 🔘 Buttons */}
      <div style={{ marginTop: "10px" }}>
        <button onClick={loadDaily}>Daily Sales</button>

        <button onClick={loadSalesReport} disabled={!start || !end}>
          Sales Report
        </button>

        <button onClick={loadItems} disabled={!start || !end}>
          Item-wise
        </button>
      </div>

      {/* 🔄 Loading */}
      {loading && <p>Loading...</p>}

      {/* 📊 DAILY */}
      {data && !loading && (
        <div style={{ marginTop: "20px" }}>
          <h3>Daily Summary</h3>

          {data.bill_count === 0 ? (
            <p style={{ color: "gray" }}>No sales for today</p>
          ) : (
            <>
              <p>Total Sales: ₹{data.total_sales}</p>
              <p>Total Bills: {data.bill_count}</p>

              <h4>Payment Summary</h4>
              <p>Cash: ₹{data.cash_total}</p>
              <p>UPI: ₹{data.upi_total}</p>
              <p>Card: ₹{data.card_total}</p>
              <p>Credit: ₹{data.credit_total}</p>
            </>
          )}
        </div>
      )}

      {/* 📄 SALES REPORT */}
      {salesList.length > 0 && (
        <>
          <div className="print-area-sales">
            <h2 className="print-title">Sales Report</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Bill No</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Payment</th>
                  <th style={thStyle}>Total</th>
                </tr>
              </thead>

              <tbody>
                {salesList.map((sale) => (
                  <tr key={sale.id}>
                    <td style={tdStyle}>{sale.date}</td>
                    <td style={tdStyle}>{sale.id}</td>
                    <td style={tdStyle}>₹{sale.total_amount}</td>
                    <td style={tdStyle}>{sale.payment_mode}</td>
                    <td style={tdStyle}>₹{sale.total_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={() => handlePrint("sales")}>
            🖨️ Print Sales Report
          </button>
        </>
      )}

      {/* 📦 ITEM REPORT */}
      {items.length > 0 && (
        <>
          <div className="print-area-item">
            <h2 className="print-title">Item-wise Report</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Qty Sold</th>
                  <th style={thStyle}>Total Sales</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td style={tdStyle}>{item.product__name}</td>
                    <td style={tdStyle}>{item.total_qty}</td>
                    <td style={tdStyle}>₹{item.total_sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={() => handlePrint("item")}>
            🖨️ Print Item Report
          </button>
        </>
      )}

      {/* PRINT CSS */}
      <style>
        {`
        @media print {
          body * { visibility: hidden; }

          body.print-sales .print-area-sales,
          body.print-sales .print-area-sales * {
            visibility: visible;
          }

          body.print-item .print-area-item,
          body.print-item .print-area-item * {
            visibility: visible;
          }

          .print-area-sales,
          .print-area-item {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }

          table {
            border-collapse: collapse;
            width: 100%;
          }

          th, td {
            border: 1px solid black;
            padding: 6px;
            text-align: center;
          }

          button { display: none; }
        }
        `}
      </style>
    </div>
  );
}

const thStyle = {
  border: "1px solid #ccc",
  padding: "8px",
  background: "#f2f2f2",
};

const tdStyle = {
  border: "1px solid #ccc",
  padding: "6px",
};