import { useEffect, useState } from "react";
import {
  listClients,
  getInvoiceTracker,
  downloadConsolidatedDocx,
  getPayments,
} from "../services/api";

const API_BASE = import.meta.env.VITE_API_URL;

export default function InvoiceTracker() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [paymentModal, setPaymentModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedColumns, setSelectedColumns] = useState([
    "client",
    "matter",
    "case_no",
    "status",
    "claim",
  ]);

  const ALL_COLUMNS = [
    { key: "client", label: "Client" },
    { key: "matter", label: "Matter" },
    { key: "case_no", label: "Case No" },
    { key: "invoice_date", label: "Invoice Date" },
    { key: "payment_date", label: "Last Payment Date" },

    { key: "part1", label: "Part-1 Invoice" },
    { key: "part2", label: "Part-2 Invoice" },

    { key: "total", label: "Invoice Amount" },
    { key: "paid", label: "Paid Amount" },
    { key: "pending", label: "Pending Amount" },

    { key: "status", label: "Status" },
  ];

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReferenceNo, setPaymentReferenceNo] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [paymentFile, setPaymentFile] = useState(null);

  /* ================= LOAD ================= */

  async function loadData(selectedClientId = "") {
    setLoading(true);
    try {
      const res = await getInvoiceTracker(selectedClientId);

      setData(
        Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.items)
          ? res.items
          : []
      );
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
    loadData();
  }, []);

  async function loadClients() {
    try {
      const res = await listClients();
      setClients(res || []);
    } catch {
      setClients([]);
    }
  }

  function handleClientChange(id) {
    setClientId(id);
    loadData(id);
  }

  /* ================= SEARCH FILTER ================= */

  const filteredData = data.filter((row) => {
    const q = search.toLowerCase();

    return (
      (row.client_name || "").toLowerCase().includes(q) ||
      (row.matter_name || "").toLowerCase().includes(q) ||
      (row.case_no || "").toLowerCase().includes(q) ||
      (row.part1?.invoice_number || "").toLowerCase().includes(q) ||
      (row.part2?.invoice_number || "").toLowerCase().includes(q)
    );
  });

  /* ================= DOWNLOAD EXCEL ================= */

  async function downloadExcel() {
    const token = localStorage.getItem("token");

    const params = new URLSearchParams();

    if (clientId) params.append("client_id", clientId);

    // 🔥 ADD THIS
    params.append("columns", selectedColumns.join(","));
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);

    const query = `?${params.toString()}`;

    const res = await fetch(
      `${API_BASE}/invoices/tracker/export${query}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      alert("Download failed");
      return;
    }

    const blob = await res.blob();

    const today = new Date();
    const formattedDate = today.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const clientName =
      clients.find((c) => c.id === Number(clientId))?.legal_name ||
      "All_Clients";

    const fileName = `Invoice_Tracker_${clientName}_as_on_${formattedDate}.xlsx`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  }

  /* ================= PAYMENT ================= */

  function openPaymentModal(inv, payment = null) {
    setHistoryModal(null);

    setTimeout(() => {
      setPaymentModal({
        invoice_id: inv.invoice_id,
        payment_id: payment?.id || null,
        amount: payment?.amount || "",
        reference_no: payment?.reference_no || "",
        payment_mode: payment?.payment_mode || "",
        file: null,
        isEdit: !!payment,
      });
    }, 100);
  }

  async function submitPayment() {
    try {
      const formData = new FormData();

      formData.append("amount", paymentModal.amount);
      formData.append("payment_mode", paymentModal.payment_mode || "");
      formData.append("reference_no", paymentModal.reference_no || "");
      formData.append("remarks", paymentModal.remarks || "");

      if (paymentModal.file) {
        formData.append("file", paymentModal.file);
      }

      const url = paymentModal.isEdit
        ? `${API_BASE}/invoices/payments/${paymentModal.payment_id}`
        : `${API_BASE}/invoices/${paymentModal.invoice_id}/payment`;

      await fetch(url, {
        method: paymentModal.isEdit ? "PUT" : "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: formData,
      });

      alert("Saved");
      setPaymentModal(null);
      await loadData(clientId);
    } catch {
      alert("Failed");
    }
  }

  async function deletePayment(paymentId) {
    if (!window.confirm("Delete payment?")) return;

    await fetch(`${API_BASE}/invoices/payments/${paymentId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    setHistoryModal(null);
    await loadData(clientId);
  }

  /* ================= HELPERS ================= */

  function renderInvoiceBlock(inv) {
    if (!inv) return "-";

    return (
      <div style={styles.invoiceBox}>
        <div style={styles.link} onClick={() => handleDownload(inv.invoice_id)}>
          {inv.invoice_number}
        </div>

        <div style={styles.meta}>
          {inv.invoice_type === "PART1" ? "Part-1" : "Part-2"}
        </div>

        <div style={styles.meta}>
          Inv Date: {formatDate(inv.invoice_date)}
        </div>

        {inv.last_payment_date && (
          <div style={styles.meta}>
            Paid On: {formatDate(inv.last_payment_date)}
          </div>
        )}

        <div style={styles.meta}>₹{inv.total}</div>
        <div style={{ ...styles.meta, color: "green" }}>
          Paid: ₹{inv.paid}
        </div>
        <div style={{ ...styles.meta, color: "red" }}>
          Bal: ₹{inv.balance}
        </div>

        <div style={statusStyle(inv.status)}>{inv.status}</div>

        <div style={{ display: "flex", gap: 6 }}>
          <button style={styles.actionBtn} onClick={() => openPaymentModal(inv)}>
            Add Payment
          </button>

          <button
            style={styles.actionBtn}
            onClick={async () => {
              const payments = await getPayments(inv.invoice_id);
              setHistoryModal({ ...inv, payments });
            }}
          >
            View
          </button>
        </div>
      </div>
    );
  }

  function statusStyle(status) {
    const map = {
      Paid: { background: "#d1fae5", color: "#065f46" },
      Partial: { background: "#fef3c7", color: "#92400e" },
      Unpaid: { background: "#fee2e2", color: "#991b1b" },
    };
    return {
      fontSize: 11,
      padding: "2px 6px",
      borderRadius: 6,
      ...(map[status] || {}),
    };
  }

  function formatDate(date) {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN");
  }

  async function handleDownload(id) {
    const blob = await downloadConsolidatedDocx(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Invoice.docx";
    a.click();
  }

  /* ================= UI ================= */

  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>Invoice Tracker</div>

      <div style={{ display: "flex", gap: 10 }}>
        <select
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
          style={styles.input}
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.legal_name}
            </option>
          ))}
        </select>

        <button onClick={downloadExcel} style={styles.downloadBtn}>
          Download Excel
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search by client / matter / invoice no"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.search}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <b>Customize Columns:</b>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
          {ALL_COLUMNS.map((col) => (
            <label key={col.key} style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={selectedColumns.includes(col.key)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedColumns([...selectedColumns, col.key]);
                  } else {
                    setSelectedColumns(
                      selectedColumns.filter((c) => c !== col.key)
                    );
                  }
                }}
              />
              {" "}{col.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      <div style={styles.card}>
        {loading ? (
          "Loading..."
        ) : (
          <table style={styles.table}>
            <tbody>
              {filteredData.map((row, i) => (
                <tr key={i}>
                  <td>{row.client_name}</td>
                  <td>{row.matter_name}</td>
                  <td>{row.case_no}</td>
                  <td>{renderInvoiceBlock(row.part1)}</td>
                  <td>{renderInvoiceBlock(row.part2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paymentModal && (
        <Modal>
          <h3>{paymentModal.isEdit ? "Edit Payment" : "Add Payment"}</h3>

          {/* Amount */}
          <div style={styles.field}>
            <label style={styles.label}>Payment Amount *</label>
            <input
              type="number"
              value={paymentModal.amount}
              onChange={(e) =>
                setPaymentModal({ ...paymentModal, amount: e.target.value })
              }
              placeholder="Enter amount"
            />
          </div>

          {/* Reference No */}
          <div style={styles.field}>
            <label style={styles.label}>Reference No</label>
            <input
              type="text"
              value={paymentModal.reference_no}
              onChange={(e) =>
                setPaymentModal({ ...paymentModal, reference_no: e.target.value })
              }
              placeholder="UTR / Cheque No / Txn ID"
            />
          </div>

          {/* Payment Mode */}
          <div style={styles.field}>
            <label style={styles.label}>Payment Mode</label>
            <input
              type="text"
              value={paymentModal.payment_mode}
              onChange={(e) =>
                setPaymentModal({ ...paymentModal, payment_mode: e.target.value })
              }
              placeholder="UPI / NEFT / Cash / Cheque"
            />
          </div>

          {/* Remarks */}
          <div style={styles.field}>
            <label style={styles.label}>Remarks</label>
            <input
              type="text"
              value={paymentModal.remarks || ""}
              onChange={(e) =>
                setPaymentModal({ ...paymentModal, remarks: e.target.value })
              }
              placeholder="Optional notes"
            />
          </div>

          {/* File Upload */}
          <div style={styles.field}>
            <label style={styles.label}>Upload Proof</label>
            <input
              type="file"
              onChange={(e) =>
                setPaymentModal({ ...paymentModal, file: e.target.files[0] })
              }
            />
            <div style={styles.helper}>Max size: 5MB</div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button style={styles.saveBtn} onClick={submitPayment}>
              Save
            </button>

            <button
              style={styles.cancelBtn}
              onClick={() => setPaymentModal(null)}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {historyModal && (
        <Modal>
          <h3>Payment History</h3>
          {historyModal.payments?.map((p) => (
            <div key={p.id} style={styles.historyRow}>
              <div>₹ {p.amount}</div>
              <div>{p.payment_mode || "-"}</div>
              <div>{p.reference_no || "-"}</div>
              <div>{formatDate(p.date)}</div>
            </div>
          ))}
          <button onClick={() => setHistoryModal(null)}>Close</button>
        </Modal>
      )}
    </div>
  );
}

/* ================= MODAL ================= */

function Modal({ children }) {
  return (
    <div style={modal.overlay}>
      <div style={modal.box}>{children}</div>
    </div>
  );
}

const styles = {
  wrapper: { display: "grid", gap: 20 },
  title: { fontSize: 22, fontWeight: 800 },
  input: { padding: 8 },
  card: { background: "#fff", padding: 16 },
  table: { width: "100%" },
  invoiceBox: { display: "grid", gap: 4 },
  link: { color: "blue", cursor: "pointer" },
  meta: { fontSize: 12 },
  actionBtn: {
    padding: "4px 6px",
    fontSize: 11,
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 6,
  },
  historyRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #eee",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 12,
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  },

  helper: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },

  filePreview: {
    fontSize: 11,
    color: "#065f46",
    marginTop: 4,
  },

  saveBtn: {
    padding: "6px 12px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },

  cancelBtn: {
    padding: "6px 12px",
    background: "#e5e7eb",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
};

const modal = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    background: "#fff",
    padding: 20,
    borderRadius: 10,
    width: 400,
  },
};