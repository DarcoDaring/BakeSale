import { useState } from "react";
import SalesPage from "./pages/SalesPage";
import PurchasePage from "./pages/PurchasePage";
import ReportsPage from "./pages/ReportsPage";

function App() {
  const [tab, setTab] = useState("sale");

  return (
    <div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setTab("sale")}>SALE</button>
        <button onClick={() => setTab("purchase")}>PURCHASE</button>
        <button onClick={() => setTab("reports")}>REPORTS</button>
      </div>

      {tab === "sale" && <SalesPage />}
      {tab === "purchase" && <PurchasePage />}
      {tab === "reports" && <ReportsPage />}
    </div>
  );
}

export default App;