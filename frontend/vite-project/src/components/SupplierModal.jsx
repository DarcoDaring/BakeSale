import { useState } from "react";
import { createSupplier } from "../api/purchaseApi";

export default function SupplierModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const handleCreate = async () => {
    if (!name) {
      alert("Enter supplier name");
      return;
    }

    const payload = {
      name,
      phone,
      address,
    };

    console.log("Creating supplier:", payload);

    try {
      const res = await createSupplier(payload);
      onCreated(res.data);
      onClose();
    } catch (err) {
      console.error("Supplier error:", err.response?.data);
      alert("Error creating supplier");
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
        width: "300px"
      }}
    >
      <h3>Create Supplier</h3>

      <input
        placeholder="Supplier Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <input
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <textarea
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <button onClick={handleCreate}>Create</button>
      <button onClick={onClose} style={{ marginLeft: "10px" }}>
        Cancel
      </button>
    </div>
  );
}