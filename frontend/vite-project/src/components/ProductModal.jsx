import { useState } from "react";
import { createProduct, generateBarcode } from "../api/productApi";

export default function ProductModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 Generate UNIQUE barcode from backend
  const handleGenerateBarcode = async () => {
    try {
      setLoading(true);
      const res = await generateBarcode();
      setBarcode(res.data.barcode);
    } catch (err) {
      console.error("Barcode error:", err.response?.data);
      alert("Error generating barcode");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name) {
      alert("Enter product name");
      return;
    }

    try {
      const payload = {
        name: name,
        barcode: barcode || null, // if empty → backend will auto-handle
        selling_price: 0,
        stock_quantity: 0,
      };

      console.log("Creating product:", payload);

      const res = await createProduct(payload);

      onCreated(res.data);
      onClose();
    } catch (err) {
      console.error("Product create error:", err.response?.data);
      alert("Error creating product");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "30%",
        left: "30%",
        background: "white",
        padding: "20px",
        border: "1px solid black",
        width: "300px",
      }}
    >
      <h3>Create Product</h3>

      {/* 🧾 Product Name */}
      <input
        placeholder="Product Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      {/* 🔢 Barcode */}
      <input
        placeholder="Barcode (optional)"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      {/* 🔥 Generate button */}
      <button onClick={handleGenerateBarcode} disabled={loading}>
        {loading ? "Generating..." : "Generate Barcode"}
      </button>

      <br /><br />

      {/* ✅ Actions */}
      <button onClick={handleCreate}>Create</button>
      <button onClick={onClose} style={{ marginLeft: "10px" }}>
        Cancel
      </button>
    </div>
  );
}