import { useEffect, useState } from "react";
import { getInvoiceAging } from "../services/api";

export default function InvoiceAging() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getInvoiceAging();
        setData(res);
      } catch (e) {
        alert("Failed to load aging report");
      }
    }
    load();
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Invoice Aging Report</h2>

      <div style={{ marginTop: 20 }}>
        <p><strong>0–30 Days:</strong> ₹{data.bucket_0_30}</p>
        <p><strong>31–60 Days:</strong> ₹{data.bucket_31_60}</p>
        <p><strong>61–90 Days:</strong> ₹{data.bucket_61_90}</p>
        <p><strong>90+ Days:</strong> ₹{data.bucket_90_plus}</p>
      </div>
    </div>
  );
}