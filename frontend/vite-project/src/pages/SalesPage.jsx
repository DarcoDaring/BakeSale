import { useState, useEffect } from "react";
import { searchProducts } from "../api/productApi";
import {
  createSale,
  getAllSales,
  deleteSale,
  updateSale,
  getSaleById,
} from "../api/salesApi";

export default function SalesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);

  const [showBills, setShowBills] = useState(false);
  const [bills, setBills] = useState([]);

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [paymentMode, setPaymentMode] = useState("CASH");

  const [showSplit, setShowSplit] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditType, setCreditType] = useState("UPI");

  // 📥 Load bills
  const loadBills = async () => {
    const res = await getAllSales();
    setBills(res.data.sales || res.data);
  };

  useEffect(() => {
    if (showBills) loadBills();
  }, [showBills]);

  // 🗑 Delete
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this bill?")) return;
    await deleteSale(id);
    loadBills();
  };

  // ✏️ EDIT
  const handleEdit = async (id) => {
    const res = await getSaleById(id);
    const sale = res.data;

    const loadedCart = sale.items.map((item) => ({
      id: item.product,
      name: "Item",
      selling_price: item.price,
      quantity: item.quantity,
      total: item.total,
    }));

    setCart(loadedCart);

    setPaymentMode(sale.payment_mode);

    if (sale.payment_mode === "MIXED") {
      setShowSplit(true);
      setCashAmount(sale.cash_amount || 0);
      setCreditAmount(sale.credit_amount || 0);
      setCreditType(sale.credit_type || "UPI");
    } else {
      setShowSplit(false);
    }

    setEditMode(true);
    setEditingId(id);
    setShowBills(false);
  };

  // 🔍 Search
  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value) {
      const res = await searchProducts(value);
      setResults(res.data);
    } else {
      setResults([]);
    }
  };

  // ➕ Add
  const addToCart = (product) => {
    const existing = cart.find((i) => i.id === product.id);

    if (existing) {
      setCart(
        cart.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setCart([
        ...cart,
        { ...product, quantity: 1, total: product.selling_price },
      ]);
    }

    setQuery("");
    setResults([]);
  };

  // 🔢 Qty
  const updateQty = (id, change) => {
    setCart(
      cart.map((i) => {
        if (i.id === id) {
          const qty = i.quantity + change;
          return {
            ...i,
            quantity: qty > 0 ? qty : 1,
            total: (qty > 0 ? qty : 1) * i.selling_price,
          };
        }
        return i;
      })
    );
  };

  const grandTotal = cart.reduce((s, i) => s + i.total, 0);

  const handleCashChange = (val) => {
    setCashAmount(val);
    const cash = Number(val) || 0;
    setCreditAmount(Math.max(grandTotal - cash, 0));
  };

  // 💾 SAVE
  const handleSave = async () => {
    let payload = {
      total_amount: grandTotal,
      payment_mode: paymentMode,
      items: cart.map((i) => ({
        product: i.id,
        quantity: i.quantity,
        price: i.selling_price,
        total: i.total,
      })),
    };

    if (paymentMode === "MIXED") {
      payload.cash_amount = Number(cashAmount) || 0;
      payload.credit_amount = creditAmount;
      payload.credit_type = creditType;
    }

    if (editMode) {
      await updateSale(editingId, payload);
      alert("Bill updated!");
    } else {
      await createSale(payload);
      alert("Sale saved!");
    }

    // reset
    setCart([]);
    setEditMode(false);
    setEditingId(null);
    setShowSplit(false);
    setCashAmount("");
    setCreditAmount(0);
  };

  // =====================
  // 📄 BILL VIEW
  // =====================
  if (showBills) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={() => setShowBills(false)}>⬅ Back</button>

        <h2>All Bills</h2>

        <table border="1" width="100%">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {bills.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td>{b.date}</td>
                <td>₹{b.total_amount}</td>
                <td>{b.payment_mode}</td>

                <td>
                  <button onClick={() => handleEdit(b.id)}>Edit</button>
                  <button onClick={() => handleDelete(b.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // =====================
  // 🛒 SALES
  // =====================
  return (
    <div style={{ padding: 20 }}>
      <h2>Sales</h2>

      {editMode && <p>Editing Bill #{editingId}</p>}

      <button onClick={() => setShowBills(true)}>View Bills</button>

      <input value={query} onChange={handleSearch} />

      {results.map((r) => (
        <div key={r.id} onClick={() => addToCart(r)}>
          {r.name}
        </div>
      ))}

      <table border="1" width="100%">
        <tbody>
          {cart.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td>
                <button onClick={() => updateQty(i.id, -1)}>-</button>
                {i.quantity}
                <button onClick={() => updateQty(i.id, 1)}>+</button>
              </td>
              <td>{i.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Total ₹{grandTotal}</h3>

      {/* PAYMENT */}
      {!editMode ? (
        <>
          <button onClick={() => { setPaymentMode("CASH"); handleSave(); }}>Cash</button>
          <button onClick={() => { setPaymentMode("UPI"); handleSave(); }}>UPI</button>
          <button onClick={() => { setPaymentMode("CARD"); handleSave(); }}>Card</button>
          <button onClick={() => { setPaymentMode("MIXED"); setShowSplit(true); }}>
            Mixed
          </button>
        </>
      ) : (
        <>
          <select
            value={paymentMode}
            onChange={(e) => {
              setPaymentMode(e.target.value);
              setShowSplit(e.target.value === "MIXED");
            }}
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="MIXED">Cash+Credit</option>
          </select>

          <button onClick={handleSave}>💾 Save Changes</button>

          <button
            onClick={() => {
              setEditMode(false);
              setCart([]);
            }}
          >
            Cancel
          </button>
        </>
      )}

      {showSplit && (
        <div>
          <input
            type="number"
            value={cashAmount}
            onChange={(e) => handleCashChange(e.target.value)}
          />
          <p>Credit ₹{creditAmount}</p>
        </div>
      )}
    </div>
  );
}