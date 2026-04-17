import { useState, useEffect } from "react";
import { searchProducts } from "../api/productApi";
import { createPurchase, getSuppliers } from "../api/purchaseApi";
import ProductModal from "../components/ProductModal";
import SupplierModal from "../components/SupplierModal";

export default function PurchasePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  // 🔄 Load suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      const res = await getSuppliers();
      setSuppliers(res.data);
    };
    fetchSuppliers();
  }, []);

  // 🔍 Search product
  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length > 0) {
      const res = await searchProducts(value);
      setResults(res.data);

      if (res.data.length === 0) {
        setShowModal(true);
      }
    } else {
      setResults([]);
    }
  };

  // ➕ Add to cart
  const addToCart = (product) => {
    const existing = cart.find((item) => item.id === product.id);

    if (existing) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          quantity: 1,
          mrp: Number(product.selling_price) || "",
          rate: Number(product.selling_price) || "",
          gst: "",
          total: Number(product.selling_price) || 0,
        },
      ]);
    }

    setQuery("");
    setResults([]);
  };

  // 🔢 Update calculation (GST as amount)
  const updateItem = (id, field, value) => {
    const updated = cart.map((item) => {
      if (item.id === id) {
        const updatedItem = {
          ...item,
          [field]: value === "" ? "" : Number(value),
        };

        const qty = Number(updatedItem.quantity) || 0;
        const rate = Number(updatedItem.rate) || 0;
        const gst = Number(updatedItem.gst) || 0;

        const base = qty * rate;

        // ✅ GST as amount
        updatedItem.total = base + gst;

        return updatedItem;
      }
      return item;
    });

    setCart(updated);
  };

  // ❌ Delete row
  const removeItem = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  // 💰 Grand total
  const grandTotal = cart.reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );

  // 💾 Save Purchase
  const handleSave = async () => {
    if (!selectedSupplier || Number(selectedSupplier) === 0) {
      alert("Please select a supplier");
      return;
    }

    if (!invoiceNumber || !date) {
      alert("Enter invoice number and date");
      return;
    }

    if (cart.length === 0) {
      alert("Add at least one item");
      return;
    }

    const payload = {
      invoice_number: invoiceNumber,
      date: date,
      supplier: Number(selectedSupplier),
      total_amount: grandTotal,
      items: cart.map((item) => ({
        product: item.id,
        quantity: item.quantity,
        mrp: item.mrp === "" ? 0 : Number(item.mrp),
        cost_price: Number(item.rate) || 0,
        gst: Number(item.gst) || 0,
        total: item.total,
      })),
    };

    console.log("Purchase Payload:", payload);

    try {
      await createPurchase(payload);
      alert("Purchase saved!");

      setCart([]);
      setInvoiceNumber("");
      setDate("");
      setSelectedSupplier("");
    } catch (error) {
      console.error("Purchase error:", error.response?.data);
      alert("Error saving purchase");
    }
  };

  // ✅ Product created
  const handleProductCreated = (product) => {
    addToCart(product);
    setShowModal(false);
  };

  // ✅ Supplier created
  const handleSupplierCreated = (supplier) => {
    setSuppliers((prev) => [...prev, supplier]);
    setSelectedSupplier(supplier.id);
    setShowSupplierModal(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Purchase Page</h2>

      {/* 🧾 Header */}
      <input
        placeholder="Invoice Number"
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
      />

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {/* 🏢 Supplier */}
      <div style={{ marginTop: "10px" }}>
        <select
          value={selectedSupplier}
          onChange={(e) => setSelectedSupplier(e.target.value)}
        >
          <option value="">Select Supplier</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.name}
            </option>
          ))}
        </select>

        <button onClick={() => setShowSupplierModal(true)}>
          + Add Supplier
        </button>
      </div>

      {/* 🔍 Search */}
      <input
        placeholder="Search product..."
        value={query}
        onChange={handleSearch}
        style={{ marginTop: "10px" }}
      />

      {/* 🔽 Results */}
      {results.length > 0 && (
        <div style={{ border: "1px solid gray", background: "white" }}>
          {results.map((item) => (
            <div
              key={item.id}
              style={{ padding: "5px", cursor: "pointer" }}
              onClick={() => addToCart(item)}
            >
              {item.name}
            </div>
          ))}
        </div>
      )}

      {/* 📦 TABLE */}
      <table border="1" style={{ marginTop: "20px", width: "100%" }}>
        <thead>
          <tr>
            <th>Barcode</th>
            <th>Item</th>
            <th>Qty</th>
            <th>MRP</th>
            <th>Rate</th>
            <th>GST Amt</th>
            <th>Total</th>
            <th>Delete</th>
          </tr>
        </thead>

        <tbody>
          {cart.map((item) => (
            <tr key={item.id}>
              <td>{item.barcode}</td>
              <td>{item.name}</td>

              <td>
                <input
                  type="number"
                  value={item.quantity === 0 ? "" : item.quantity}
                  onChange={(e) =>
                    updateItem(item.id, "quantity", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  value={item.mrp === 0 ? "" : item.mrp}
                  onChange={(e) =>
                    updateItem(item.id, "mrp", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  value={item.rate === 0 ? "" : item.rate}
                  onChange={(e) =>
                    updateItem(item.id, "rate", e.target.value)
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  value={item.gst === 0 ? "" : item.gst}
                  onChange={(e) =>
                    updateItem(item.id, "gst", e.target.value)
                  }
                />
              </td>

              <td>{item.total.toFixed(2)}</td>

              <td>
                <button onClick={() => removeItem(item.id)}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 💰 Total */}
      <h3>Total: ₹{grandTotal}</h3>

      {/* 💾 Save */}
      <button onClick={handleSave}>SAVE</button>

      {/* 🧠 Modals */}
      {showModal && (
        <ProductModal
          onClose={() => setShowModal(false)}
          onCreated={handleProductCreated}
        />
      )}

      {showSupplierModal && (
        <SupplierModal
          onClose={() => setShowSupplierModal(false)}
          onCreated={handleSupplierCreated}
        />
      )}
    </div>
  );
}