import { useEffect, useState } from "react";
import { getAllSales, deleteSale } from "../api/salesApi";

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // 📥 Load bills
  const loadBills = async () => {
    try {
      const res = await getAllSales();
      setBills(res.data.sales || res.data); // works for both formats
    } catch (err) {
      console.error(err);
      alert("Error loading bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  // 🗑 Delete
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Delete this bill?");
    if (!confirmDelete) return;

    try {
      await deleteSale(id);
      loadBills();
    } catch (err) {
      console.error(err);
      alert("Error deleting bill");
    }
  };

  // ✏️ Edit (for now placeholder)
  const handleEdit = (bill) => {
    alert(`Edit Bill ID: ${bill.id}\n(Next step we will build full edit UI)`);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>🧾 All Bills</h2>

      {loading ? (
        <p>Loading...</p>
      ) : bills.length === 0 ? (
        <p>No bills found</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "20px",
            }}
          >
            <thead>
              <tr>
                <th style={th}>Bill No</th>
                <th style={th}>Date</th>
                <th style={th}>Total</th>
                <th style={th}>Payment</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td style={td}>{bill.id}</td>
                  <td style={td}>{bill.date}</td>
                  <td style={td}>₹{bill.total_amount}</td>
                  <td style={td}>{bill.payment_mode}</td>

                  <td style={td}>
                    <button onClick={() => handleEdit(bill)}>
                      ✏️ Edit
                    </button>

                    <button
                      onClick={() => handleDelete(bill.id)}
                      style={{
                        marginLeft: "10px",
                        background: "red",
                        color: "white",
                      }}
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 🎨 styles
const th = {
  border: "1px solid #ccc",
  padding: "10px",
  background: "#f2f2f2",
};

const td = {
  border: "1px solid #ccc",
  padding: "8px",
};