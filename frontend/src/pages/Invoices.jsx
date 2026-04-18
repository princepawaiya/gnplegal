import { useEffect, useMemo, useState } from "react";
import {
  listInvoices,
  listClients,
  generateConsolidatedInvoice,
  previewInvoice,
  finalizeInvoice,
  downloadConsolidatedDocx,
  downloadInvoicePdf,
  getClientMatters,
  createMiscInvoice,
  updateInvoiceTotal,
  deleteInvoice,
  getClientSpocs
} from "../services/api";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [invoiceType, setInvoiceType] = useState("");

  const [clientMatters, setClientMatters] = useState([]);
  const [selectedMatterIds, setSelectedMatterIds] = useState([]);

  const [previewData, setPreviewData] = useState(null);

  const [insights, setInsights] = useState({
    part1_count: 0,
    part2_count: 0,
    estimated_total: 0,
  });
  const [clientSpocs, setClientSpocs] = useState([]);
  const [selectedSpocId, setSelectedSpocId] = useState("");
  const [matterSearch, setMatterSearch] = useState("");
  const [paymentModal, setPaymentModal] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listInvoices();

      console.log("🔥 RAW INVOICES API:", data); // ADD THIS

      setInvoices(Array.isArray(data) ? data : data?.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    listClients().then((data) => {
      setClients(Array.isArray(data) ? data : []);
    });

    setInsights({
      part1_count: 12,
      part2_count: 5,
      estimated_total: 185000,
    });
  }, []);

  useEffect(() => {
  if (!clientId) {
    setClientMatters([]);
    setSelectedMatterIds([]);
    setClientSpocs([]);
    setSelectedSpocId("");
    return;
  }

  async function loadData() {
    try {
      const [matters, spocs] = await Promise.all([
        getClientMatters(clientId),
        getClientSpocs(clientId), // 🔥 ADD THIS API
      ]);

      setClientMatters(Array.isArray(matters) ? matters : []);
      setClientSpocs(Array.isArray(spocs) ? spocs : []);
    } catch (e) {
      console.error("Failed to load data", e);
      setClientMatters([]);
      setClientSpocs([]);
    }
  }

  loadData();
  setSelectedMatterIds([]);
  setSelectedSpocId("");
}, [clientId]);

  const selectedMatters = useMemo(() => {
    return clientMatters.filter((m) =>
      selectedMatterIds.includes(m.id)
    );
  }, [clientMatters, selectedMatterIds]);

  const filteredClientMatters = useMemo(() => {
    const q = matterSearch.trim().toLowerCase();

    if (q.length < 3) return clientMatters;

    return clientMatters.filter((m) =>
      (m.matter_name || "").toLowerCase().includes(q) ||
      (m.case_no || "").toLowerCase().includes(q)
    );
  }, [clientMatters, matterSearch]);

  const allowedInvoiceTypes = useMemo(() => {
    if (selectedMatterIds.length === 0) return ["PART1", "PART2", "MISC"];

    const selected = clientMatters.filter((m) =>
      selectedMatterIds.includes(m.id)
    );

    const allPart1Pending = selected.every((m) => !m.part1_done);
    const allPart2Pending = selected.every((m) => !m.part2_done);

    const options = [];

    if (allPart1Pending) options.push("PART1");
    if (allPart2Pending) options.push("PART2");

    options.push("MISC");

    return options;
  }, [clientMatters, selectedMatterIds]);

  useEffect(() => {
    if (allowedInvoiceTypes.length === 0) {
      setInvoiceType("");
      return;
    }

    if (!allowedInvoiceTypes.includes(invoiceType)) {
      setInvoiceType(allowedInvoiceTypes[0]);
    }
  }, [allowedInvoiceTypes, invoiceType]);

  async function handleGenerate() {
    if (!selectedSpocId && invoiceType !== "MISC") {
      alert("Please select SPOC");
      return;
    }
    if (!clientId || !month || !year || selectedMatterIds.length === 0 || !invoiceType) {
      alert("Please select client, matter, month, year and invoice type");
      return;
    }

    try {
  if (invoiceType === "MISC") {
    const amount = prompt("Enter Misc Invoice Amount");

    if (!amount || Number(amount) <= 0) {
      alert("Invalid amount");
      return;
    }

    await createMiscInvoice({
      matter_ids: selectedMatterIds,
      amount: Number(amount),
    });

    alert("Misc invoice created");
  } else {
    await generateConsolidatedInvoice({
      client_id: clientId,
      matter_ids: selectedMatterIds,
      month,
      year,
      invoice_type: invoiceType,
      selected_spoc_id: selectedSpocId || "",
    });

    alert("Invoice draft created");
  }

  await refresh();

  if (clientId) {
    const refreshed = await getClientMatters(clientId);
    setClientMatters(Array.isArray(refreshed) ? refreshed : []);
  }

} catch (e) {
  alert(e.message);
}
  }

  async function handleDownload(invoice) {
    try {
      // 🔥 UNIVERSAL FIX
      const invoiceId = invoice?.id || invoice?.invoice_id;

      if (!invoiceId) {
        console.error("❌ Invalid invoice object:", invoice);
        alert("Invalid invoice ID");
        return;
      }

      let blob;

      if (invoice.invoice_mode === "CONSOLIDATED") {
        blob = await downloadConsolidatedDocx(invoiceId);
      } else {
        blob = await downloadInvoicePdf(invoiceId);
      }

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      a.download =
        invoice.invoice_mode === "CONSOLIDATED"
          ? "Invoice.docx"
          : "Invoice.pdf";

      a.click();

      window.URL.revokeObjectURL(url);

    } catch (e) {
      console.error("DOWNLOAD ERROR:", e);
      alert(e.message || "Download failed");
    }
  }

  function statusStyle(status) {
    const map = {
      Draft: { bg: "#fef3c7", color: "#92400e" },
      Raised: { bg: "#dbeafe", color: "#1e40af" },
      Paid: { bg: "#d1fae5", color: "#065f46" },
    };
    return map[status] || { bg: "#e5e7eb", color: "#374151" };
  }

  function getMatterLabel(m) {
    let suffix = "";

    if (m.part1_done && m.part2_done) {
      suffix = " - Fully Invoiced";
    } else if (m.part1_done) {
      suffix = " - Part-1 Raised";
    } else {
      suffix = " - Part-1 Pending";
    }

    return `${m.matter_name} (${m.case_no})${suffix}`;
  }

  function openPaymentModal(inv) {
    setPaymentModal({
      id: inv.id,
      amount: "",
      reference: "",
      file: null,
    });
  }

  console.log("Invoices data:", invoices);

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" style={{ height: 34 }} />
          <div>
            <div style={styles.title}>Invoices</div>
            <div style={styles.subtitle}>Billing engine for litigation</div>
          </div>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{insights.part1_count}</div>
          <div style={styles.kpiLabel}>Part-1 Ready</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>{insights.part2_count}</div>
          <div style={styles.kpiLabel}>Part-2 Ready</div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiValue}>
            ₹ {Number(insights.estimated_total).toLocaleString("en-IN")}
          </div>
          <div style={styles.kpiLabel}>Potential Revenue</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Generate Invoice</div>

        <div style={{ display: "grid", gap: 16 }}>

          {/* ROW 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={styles.input}
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.legal_name}
                </option>
              ))}
            </select>

            <select
              value={selectedSpocId}
              onChange={(e) => setSelectedSpocId(e.target.value)}
              style={styles.input}
            >
              <option value="">Select SPOC</option>
              {clientSpocs.map((spoc) => (
                <option key={spoc.id} value={spoc.id}>
                  {spoc.name}
                </option>
              ))}
            </select>
          </div>

          {/* SEARCH */}
          <input
            type="text"
            value={matterSearch}
            onChange={(e) => setMatterSearch(e.target.value)}
            placeholder="Search matter name / case no"
            style={styles.input}
          />

          {/* 🔥 MATTER SELECT (FIXED UI) */}
          <div style={styles.multiSelectBox}>
            <div style={styles.multiSelectLabel}>
              Select Matters (multi-select)
            </div>

            <div style={styles.multiSelectList}>
              {filteredClientMatters.map((m) => (
                <label key={m.id} style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedMatterIds.includes(m.id)}
                    onChange={(e) => {
                      const id = m.id;
                      if (e.target.checked) {
                        setSelectedMatterIds([...selectedMatterIds, id]);
                      } else {
                        setSelectedMatterIds(
                          selectedMatterIds.filter((x) => x !== id)
                        );
                      }
                    }}
                  />
                  <span>{getMatterLabel(m)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ROW 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={styles.input}
            >
              <option value="">Month</option>
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={styles.input}
            />

            <select
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              style={styles.input}
            >
              {allowedInvoiceTypes.map((type) => (
                <option key={type} value={type}>
                  {type === "PART1"
                    ? "Part-1"
                    : type === "PART2"
                    ? "Part-2"
                    : "Misc"}
                </option>
              ))}
            </select>
          </div>

          {/* BUTTON */}
          <button
            style={styles.primaryBtn}
            onClick={handleGenerate}
            disabled={
              !clientId ||
              selectedMatterIds.length === 0 ||
              !month ||
              !year ||
              !invoiceType
            }
          >
            Generate Invoice
          </button>

        </div>

        {selectedMatters.length > 0 && (
          <div style={styles.matterInfoBox}>
            <strong>Selected Matters:</strong>

            {selectedMatters.map((m) => (
              <div key={m.id}>
                {m.matter_name} ({m.case_no}) — 
                Part-1: {m.part1_done ? "✅" : "⏳"} | 
                Part-2: {m.part2_done ? "✅" : "⏳"}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>All Invoices</div>

        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {invoices.map((inv, index) => {
              console.log("Invoice Row:", index, inv);
              const s = statusStyle(inv.status);

              return (
                <div key={inv.id} style={styles.row}>
                  <div>
                    <div style={styles.invoiceNo}>{inv.invoice_number}</div>
                    <div style={styles.meta}>
                      {inv.client} • {inv.matter_name || "-"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {inv.matter_name || "-"}
                    </div>
                  </div>

                  <div style={styles.center}>
                    <div style={styles.meta}>Type</div>
                    <div>{inv.invoice_type}</div>
                  </div>

                  <div style={styles.center}>
                    <div style={styles.meta}>Amount</div>
                    <div style={styles.amount}>₹{inv.amount}</div>
                  </div>

                  <div>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        background: s.bg,
                        color: s.color,
                        textAlign: "center",
                      }}
                    >
                      {inv.status}
                    </div>
                  </div>

                  <div style={styles.actions}>

                    {/* DRAFT STATE */}
                    {!inv.is_locked && (
                      <>
                        <button
                          style={styles.linkBtn}
                          onClick={async () => {
                            const data = await previewInvoice(inv.id);
                            setPreviewData(data);
                          }}
                        >
                          View / Edit
                        </button>

                        <button
                          style={styles.linkBtn}
                          onClick={async () => {
                            const confirmed = confirm("Delete this invoice?");
                            if (!confirmed) return;

                            try {
                              await deleteInvoice(inv.id);
                            } catch (e) {
                              if (e.message.includes("multiple matters")) {
                                const force = confirm(
                                  "This invoice has multiple matters. Are you sure you want to delete?"
                                );

                                if (!force) return;

                                await deleteInvoice(`${inv.id}?force=true`);
                              } else {
                                alert(e.message);
                              }
                            }

                            await refresh();
                            await refresh();
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {paymentModal && (
                      <div style={modal.overlay}>
                        <div style={modal.box}>
                          <h3>Record Payment</h3>

                          <input
                            type="number"
                            placeholder="Amount"
                            onChange={(e) =>
                              setPaymentModal({ ...paymentModal, amount: e.target.value })
                            }
                          />

                          <input
                            placeholder="Reference No"
                            onChange={(e) =>
                              setPaymentModal({ ...paymentModal, reference: e.target.value })
                            }
                          />

                          <input
                            type="file"
                            onChange={(e) =>
                              setPaymentModal({ ...paymentModal, file: e.target.files[0] })
                            }
                          />

                          <button
                            onClick={async () => {
                              const formData = new FormData();
                              formData.append("amount", paymentModal.amount);
                              formData.append("reference_no", paymentModal.reference);

                              if (paymentModal.file) {
                                formData.append("file", paymentModal.file);
                              }

                              await fetch(
                                `${API_BASE}/invoices/${paymentModal.id}/payment`,
                                {
                                  method: "POST",
                                  headers: {
                                    Authorization: "Bearer " + localStorage.getItem("token"),
                                  },
                                  body: formData,
                                }
                              );

                              setPaymentModal(null);
                              refresh();
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    )}

                    {/* FINALIZED STATE */}
                    {inv.is_locked && (
                      <button
                        style={styles.linkBtn}
                        onClick={() =>
                          handleDownload({
                            ...inv,
                            id: inv.id || inv.invoice_id
                          })
                        }
                      >
                        {inv.invoice_mode === "CONSOLIDATED"
                          ? "Download DOCX"
                          : "Download PDF"}
                      </button>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewData && (
        <div style={modal.overlay}>
          <div style={modal.box}>
            <h3>Invoice Preview</h3>

            <input
              type="number"
              value={previewData.final_total}
              onChange={(e) =>
                setPreviewData({
                  ...previewData,
                  final_total: Number(e.target.value),
                })
              }
            />

            <p><b>{previewData.invoice_number}</b></p>
            <p>{previewData.client}</p>

            <table style={modal.table}>
              <tbody>
                {(previewData.matters || []).map((m, i) => (
                  <tr key={i}>
                    <td>{m.matter_name}</td>
                    <td>{m.case_no}</td>
                    <td>{m.forum}</td>
                    <td style={{ textAlign: "right" }}>
                      ₹{Number(m.amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Total: ₹{previewData.final_total}</h3>

            {/* SPOC SELECT */}
            <select
              value={previewData.selected_spoc_id || ""}
              onChange={(e) =>
                setPreviewData({
                  ...previewData,
                  selected_spoc_id: Number(e.target.value),
                })
              }
              style={styles.input}
            >
              <option value="">Select SPOC</option>
              {clientSpocs.map((spoc) => (
                <option key={spoc.id} value={spoc.id}>
                  {spoc.name || spoc.full_name || spoc.contact_name || "Unnamed"} ({spoc.email || "-"})
                </option>
              ))}
            </select>

            {/* ✅ ACTION BUTTONS */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>

              {/* CANCEL */}
              <button
                onClick={() => setPreviewData(null)}
                style={{
                  padding: "8px 12px",
                  background: "#f3f4f6",
                  color: "#111827",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>

              {/* CONFIRM */}
              <button
                style={styles.primaryBtn}
                onClick={async () => {
                  try {
                    if (!previewData.selected_spoc_id) {
                      alert("Please select SPOC before confirming");
                      return;
                    }

                    await updateInvoiceTotal(
                      previewData.invoice_id,
                      previewData.final_total,
                      previewData.selected_spoc_id
                    );

                    await finalizeInvoice(previewData.invoice_id);

                    setPreviewData(null);
                    await refresh();
                  } catch (e) {
                    console.error(e);
                    alert(e.message || "Failed to finalize invoice");
                  }
                }}
              >
                Confirm
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "grid", gap: 20 },

  header: { display: "flex", alignItems: "center" },

  title: { fontSize: 22, fontWeight: 800 },
  subtitle: { fontSize: 13, color: "#64748b" },

  sectionTitle: { fontWeight: 700, marginBottom: 10 },

  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #e5e7eb",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },

  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
    gap: 12,
    padding: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    alignItems: "center",
  },

  invoiceNo: { fontWeight: 700 },
  meta: { fontSize: 12, color: "#64748b" },
  center: { textAlign: "center" },
  amount: { fontWeight: 700 },
  actions: { display: "flex", gap: 10 },

  primaryBtn: {
    padding: "8px 12px",
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },

  linkBtn: {
    background: "none",
    border: "none",
    color: "#2563eb",
    cursor: "pointer",
  },

  empty: { textAlign: "center", padding: 20, color: "#64748b" },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },

  kpiCard: {
    background: "white",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #e5e7eb",
  },

  kpiValue: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
  },

  kpiLabel: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
  },

  matterInfoBox: {
    marginTop: 14,
    padding: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    display: "grid",
    gap: 6,
    fontSize: 14,
  },

  multiSelectBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    background: "#f9fafb",
  },

  multiSelectLabel: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: "#374151",
  },

  multiSelectList: {
    maxHeight: 140,
    overflowY: "auto",
    display: "grid",
    gap: 6,
  },

  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
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
    borderRadius: 12,
    width: 600,
    maxHeight: "80vh",
    overflowY: "auto",
  },
  table: {
    width: "100%",
    marginTop: 10,
    borderCollapse: "collapse",
  },
};