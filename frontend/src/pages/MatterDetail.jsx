import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserFromToken, hasPermission } from "../utils/permissions";
import { assignGNPCounsel } from "../services/api";
import { listClients } from "../services/api";
import { listUsers } from "../services/api";
import { listGnpCounsels } from "../services/api";

import {
  getMatterById,
  assignCounsel,
  listLocalCounsels,
  updateLDOH,
  updateStage,
  updateMatterStatus,
  getHearingHistory,
  updateNDOH,
  uploadMatterDocument,
  listMatterDocuments,
} from "../services/api";

import {
  colors,
  typography,
  components,
  spacing,
  elevation
} from "../theme";
const API_BASE = import.meta.env.VITE_API_URL;

function openSecureFile(path) {
  if (!path) {
    alert("File not available");
    return;
  }

  const token = localStorage.getItem("token");
  let cleanPath = String(path).trim();

  // already absolute url
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    window.open(cleanPath, "_blank");
    return;
  }

  // already secure-file route
  if (cleanPath.startsWith("/secure-file")) {
    const separator = cleanPath.includes("?") ? "&" : "?";
    window.open(`${API_BASE}${cleanPath}${separator}token=${token}`, "_blank");
    return;
  }

  // raw storage path
  if (cleanPath.startsWith("storage/")) {
    cleanPath = cleanPath.replace(/^storage\//, "");
  }

  const url = `${API_BASE}/secure-file?path=${encodeURIComponent(cleanPath)}&token=${token}`;
  window.open(url, "_blank");
}

function getFileUrl(path) {
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  let cleanPath = String(path).trim();

  if (!cleanPath) return null;

  if (cleanPath.startsWith("storage/")) {
    cleanPath = cleanPath.replace(/^storage\//, "");
  }

  if (!cleanPath.startsWith("/secure-file")) {
    cleanPath = cleanPath.replace(/^\/+/, "");
    cleanPath = `/secure-file?path=${encodeURIComponent(cleanPath)}`;
  }

  return `${API_BASE}${cleanPath}`;
}

export default function MatterDetail() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const user = getUserFromToken();
  const role = user?.role || "client";

  const basePath =
    role === "admin"
      ? "/admin"
      : role === "lawyer"
      ? "/lawyer"
      : role === "gnp_counsel" || role === "gnp counsel"
      ? "/gnp"
      : "/client";
  
  const canView = hasPermission("matters:view");

  if (!canView) {
    return <div style={{ padding: 20 }}>Access Denied</div>;
  }

  const [matter, setMatter] = useState(null);
  const [counselList, setCounselList] = useState([]);
  const [editingCounsel, setEditingCounsel] = useState(false);
  const [toast, setToast] = useState("");
  const [showNDOHModal, setShowNDOHModal] = useState(false);
  const [newNDOH, setNewNDOH] = useState("");
  const [ldoh, setLdoh] = useState("");
  const [ndohComment, setNDOHComment] = useState("");
  const [savingNDOH, setSavingNDOH] = useState(false);
  const [ndohHistory, setNDOHHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [selectedStage, setSelectedStage] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [selectedCounselId, setSelectedCounselId] = useState("");
  const [savingCounsel, setSavingCounsel] = useState(false);
  const [customDocs, setCustomDocs] = useState([]);
  const [invoice, setInvoice] = useState({
  total_fee: 0,
  part1_file: null,
  part2_file: null,
  miscellaneous_fee: 0,
  miscellaneous_file: null,
});
const [animateTotal, setAnimateTotal] = useState(false);
const [clientInvoice, setClientInvoice] = useState({
  total_fee: 0,
  part1_file: null,
  part2_file: null,
  miscellaneous_fee: 0,
  miscellaneous_file: null,
});
const [clientPaymentRefs, setClientPaymentRefs] = useState({
  part1: "",
  part2: "",
  misc: "",
});
const [showOrderModal, setShowOrderModal] = useState(false);
const [orderDate, setOrderDate] = useState("");
const [orderFile, setOrderFile] = useState(null);
const [pendingStatus, setPendingStatus] = useState("");
const [savingOrder, setSavingOrder] = useState(false);
const [editMode, setEditMode] = useState(false);

const [pleadingFiles, setPleadingFiles] = useState({});
const [savingPleadingType, setSavingPleadingType] = useState("");
const [documents, setDocuments] = useState([]);
const [gnpCounsels, setGnpCounsels] = useState([]);
const [selectedGnpCounsel, setSelectedGnpCounsel] = useState("");
const [savingGnp, setSavingGnp] = useState(false);
const [clients, setClients] = useState([]);
const [form, setForm] = useState({
  client_id: null,
});
const [editingClient, setEditingClient] = useState(false);
const [clientId, setClientId] = useState("");
const isAdmin = user?.role === "admin";
const isClosed = ["Allowed", "Disposed", "Dismissed"].includes(
  matter?.current_status
);
const [editingClaim, setEditingClaim] = useState(false);
const [claimAmount, setClaimAmount] = useState("");
const [savingClaim, setSavingClaim] = useState(false);

async function loadClients() {
  try {
    const res = await listClients();

    const data =
      Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];

    setClients(data);
  } catch (e) {
    console.error("Failed to load clients", e);
    setClients([]);
  }
}

function addCustomDoc() {
  setCustomDocs((prev) => [...prev, { type: "", file: null }]);
}

function updateCustomDoc(index, key, value) {
  const updated = [...customDocs];
  updated[index][key] = value;
  setCustomDocs(updated);
}

async function saveCustomDoc(doc) {
  if (!doc.file || !doc.type) {
    alert("Type and file required");
    return;
  }

  try {
    if (!id || isNaN(Number(id))) return;
    await uploadMatterDocument(id, doc.file, doc.type);
    await loadDocuments();

    setToast("Document uploaded");
    setTimeout(() => setToast(""), 2000);
  } catch (err) {
    alert(err.message);
  }
}

async function loadDocuments() {
  if (!id || isNaN(Number(id))) return;

  try {
    const data = await listMatterDocuments(id);
    setDocuments(Array.isArray(data) ? data : []);
  } catch {
    setDocuments([]);
  }
}

async function handleSave(type) {
  const file = pleadingFiles[type];

  if (!file) {
    alert(`Please select a file for ${type}`);
    return;
  }

  try {
    setSavingPleadingType(type);
    if (!id || isNaN(Number(id))) return;
    await uploadMatterDocument(id, file, type);

    setToast(`${type} saved successfully`);
    setTimeout(() => setToast(""), 2000);

    await loadDocuments();

    setPleadingFiles((prev) => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  } catch (err) {
    alert(err.message);
  } finally {
    setSavingPleadingType("");
  }
}

useEffect(() => {
  loadClients();
}, []);

useEffect(() => {
  setAnimateTotal(true);
  const timer = setTimeout(() => setAnimateTotal(false), 600);
  return () => clearTimeout(timer);
}, [invoice.total_fee, invoice.miscellaneous_fee]);

useEffect(() => {
  if (!isNew) {
    load();
    loadDocuments();
  }
}, [id]);

  async function load() {
    let data;

    try {
      data = await getMatterById(id);

      const safeData = data?.data || data?.item || data || null;

      if (!safeData) {
        alert("Invalid matter data");
        return;
      }

      setMatter(safeData);
      setClientId(safeData?.client_id || "");
      setClaimAmount(safeData.claim_amount || "");

      setInvoice({
        total_fee: safeData.counsel_invoice?.total_fee || 0,
        part1_file: safeData.counsel_invoice?.part1_file || null,
        part2_file: safeData.counsel_invoice?.part2_file || null,
        miscellaneous_fee: safeData.counsel_invoice?.miscellaneous_fee || 0,
        miscellaneous_file: safeData.counsel_invoice?.miscellaneous_file || null,
      });

      setClientInvoice({
        total_fee: safeData.client_invoice?.total_fee || 0,
        part1_file: safeData.client_invoice?.part1_file || null,
        part2_file: safeData.client_invoice?.part2_file || null,
        miscellaneous_fee: safeData.client_invoice?.miscellaneous_fee || 0,
        miscellaneous_file: safeData.client_invoice?.miscellaneous_file || null,
      });

      setClientPaymentRefs({
        part1: safeData.client_payment?.part1_reference_no || "",
        part2: safeData.client_payment?.part2_reference_no || "",
        misc: safeData.client_payment?.miscellaneous_reference_no || "",
      });

      setSelectedStage(safeData.current_stage || "");
      setLdoh(safeData.ldoh ? String(safeData.ldoh).slice(0, 10) : "");

      try {
        const historyData = await getHearingHistory(id);
        setNDOHHistory(Array.isArray(historyData) ? historyData : []);
      } catch {
        setNDOHHistory([]);
      }

      try {
        const gnp = await listGnpCounsels();
        setGnpCounsels(gnp);
      } catch (err) {
          console.error("GNP LOAD FAILED:", err);
          setGnpCounsels([]);
        }

      if (safeData?.city) {
        try {
          const counsels = await listLocalCounsels({ city: safeData.city });
          setCounselList(Array.isArray(counsels) ? counsels : []);
        } catch {
          setCounselList([]);
        }
      } else {
        setCounselList([]);
      }
    } catch (e) {
      alert("Failed to load matter");
    }
  }

  useEffect(() => {
    if (matter) {
      setForm({
        client_id: matter.client_id || "",
      });
    }
  }, [matter]);

  async function handleCounselChange(counselId) {
  if (!counselId) return;

  // Prevent duplicate API call
  if (Number(counselId) === Number(matter?.counsel?.id)) {
    return;
  }

  try {
    if (!id || isNaN(Number(id))) return;
    await assignCounsel(Number(id), Number(counselId));
    await load();
  } catch (err) {
    if (err?.message?.includes("already assigned")) {
      return; // silently ignore
    }

    alert(err.message || "Failed to assign counsel");
  }
}

async function updateStatusDirectly(newStatus) {
  try {
    await updateMatterStatus(matter.id, newStatus);

    setMatter((prev) => ({
      ...prev,
      current_status: newStatus,
    }));
  } catch (err) {
    alert(err.message);
  }
}

async function saveInvoice() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/counsel-invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          total_fee: invoice.total_fee,
          miscellaneous_fee: invoice.miscellaneous_fee,
        }),
      }
    );

    if (!res.ok) throw new Error("Failed to save invoice");

    await load();
    setToast("Invoice saved successfully");
    setTimeout(() => setToast(""), 3000);

  } catch (err) {
    alert(err.message);
  }
}

async function saveClientInvoice() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/client-invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          total_fee: clientInvoice.total_fee,
          miscellaneous_fee: clientInvoice.miscellaneous_fee,
        }),
      }
    );

    if (!res.ok) throw new Error("Failed to save invoice");

    await load();
    setToast("Client invoice saved successfully");
    setTimeout(() => setToast(""), 3000);

  } catch (err) {
    alert(err.message);
  }
}

async function uploadPaymentFile(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/payment/upload?type=${type}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }

    await load();
    setToast("Payment uploaded successfully");
    setTimeout(() => setToast(""), 2000);

  } catch (err) {
    alert(err.message);
  }
}

async function deletePaymentFile(type) {
  if (!window.confirm("Delete this payment file?")) return;

  try {
    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/payment/delete?type=${type}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Delete failed");
    }

    await load();
    setToast("Payment file deleted");
    setTimeout(() => setToast(""), 2000);

  } catch (err) {
    alert(err.message);
  }
}

async function uploadFile(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const token = localStorage.getItem("token");

  const res = await fetch(
    `${API_BASE}/matters/${matter.id}/invoice/upload?type=${type}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json();
    alert(err.detail || "Upload failed");
    return;
  }

  await load();
}

async function uploadClientFile(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${API_BASE}/matters/${matter.id}/client-invoice/upload?type=${type}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json();
    alert(err.detail || "Upload failed");
    return;
  }

  await load();
}

async function uploadClientPaymentFile(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const referenceNo =
    type === "part1"
      ? clientPaymentRefs.part1
      : type === "part2"
      ? clientPaymentRefs.part2
      : clientPaymentRefs.misc;

  if (!referenceNo.trim()) {
    alert("Please enter reference number");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("reference_no", referenceNo.trim());

  try {
    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/client-payment/upload?type=${type}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }

    await load();
    setToast("Client payment uploaded successfully");
    setTimeout(() => setToast(""), 2000);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteClientPaymentFile(type) {
  if (!window.confirm("Delete this client payment file?")) return;

  try {
    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/client-payment/delete?type=${type}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Delete failed");
    }

    await load();
    setToast("Client payment file deleted");
    setTimeout(() => setToast(""), 2000);
  } catch (err) {
    alert(err.message);
  }
}

async function deleteClientInvoiceFile(type) {
  const confirmDelete = window.confirm("Are you sure you want to delete this file?");
  if (!confirmDelete) return;

  const res = await fetch(
    `${API_BASE}/matters/${matter.id}/client-invoice/delete?type=${type}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  if (!res.ok) {
    const err = await res.json();
    alert(err.detail || "Delete failed");
    return;
  }

  await load();
}

async function deleteInvoiceFile(type) {
  const confirmDelete = window.confirm("Are you sure you want to delete this file?");
  if (!confirmDelete) return;

  try {
    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/invoice/delete?type=${type}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Delete failed");
    }

    await load();
    setToast("File deleted successfully");
    setTimeout(() => setToast(""), 3000);

  } catch (err) {
    alert(err.message);
  }
}

async function assignGNPCounselHandler(counselId) {
  if (!counselId) return;

  try {
    setSavingGnp(true);

    await assignGNPCounsel(matter.id, Number(counselId)); // ✅ keep only this

    await load();

    setSelectedGnpCounsel("");
    setToast("GNP Counsel assigned successfully");
    setTimeout(() => setToast(""), 2000);

  } catch (err) {
    alert(err.message || "Failed to assign GNP counsel");
  } finally {
    setSavingGnp(false);
  }
}

async function updateClient() {
  if (!clientId) {
    alert("Please select a client");
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/basic`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          client_id: Number(clientId),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || "Update failed");
      return;
    }

    await load(); // 🔥 IMPORTANT: refresh page data
    setToast("Client updated");
    setTimeout(() => setToast(""), 2000);

  } catch (e) {
    console.error(e);
    alert("Failed to update client");
  }
}

async function handleUpdateClaim() {
  if (!claimAmount) {
    alert("Please enter claim amount");
    return;
  }

  try {
    setSavingClaim(true);

    const res = await fetch(
      `${API_BASE}/matters/${matter.id}/basic`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          claim_amount: Number(claimAmount),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Update failed");
    }

    await load(); // refresh data
    setEditingClaim(false);

  } catch (err) {
    alert(err.message);
  } finally {
    setSavingClaim(false);
  }
}

async function handleUpdateNDOH() {
  if (!newNDOH || !ndohComment.trim()) {
    alert("New hearing date and comment are mandatory.");
    return;
  }

  try {
    setSavingNDOH(true);

    let userId = null;

    try {
      const token = localStorage.getItem("token");
      if (token) {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        userId = decoded?.id || null;
      }
    } catch {
      userId = null;
    }

    await updateNDOH(matter.id, {
      new_ndoh: newNDOH,
      comment: ndohComment.trim(),
      user_id: userId,
    });

    await load();
    setShowNDOHModal(false);
    setNewNDOH("");
    setNDOHComment("");
    setToast("Next hearing date updated successfully.");
    setTimeout(() => setToast(""), 3000);
  } catch (err) {
    alert(err.message || "Failed to update hearing date");
  } finally {
    setSavingNDOH(false);
  }
}

  if (!matter) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={styles.wrapper}>

      {toast && <div style={styles.toast}>{toast}</div>}

      {/* HEADER */}
      <div style={styles.header}>
        <div>

          {/* Title */}
          <div style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text)"   // ✅ FIXED
          }}>
            {matter.internal_case_no || "Matter Details"}
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: 16,
            fontWeight: 600,
            marginTop: 4,
            color: "var(--text)"   // ✅ ADD THIS
          }}>
            {matter.matter_name || "-"}
          </div>

          <div style={{ color: "#6b7280", marginTop: 6 }}>
            Court Case No: {matter.case_no || "-"}
          </div>

          {/* Chips Row */}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>

            {matter.current_stage && (
              <div style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: "#fee2e2",
                color: "#991b1b",
                fontWeight: 600,
                fontSize: 13
              }}>
                {matter.current_stage}
              </div>
            )}

            {matter.current_status && (
              <div style={{
                padding: "6px 12px",
                borderRadius: 20,
                background: "#e0f2fe",
                color: "#075985",
                fontWeight: 600,
                fontSize: 13
              }}>
                {matter.current_status}
              </div>
            )}

          </div>

        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate(`${basePath}/matters`)}
            style={styles.secondaryBtn}
          >
            ← Matters
          </button>

          <button
            onClick={() => navigate(`${basePath}`)}
            style={styles.secondaryBtn}
          >
            Dashboard
          </button>

          <button
            onClick={() => navigate(`${basePath}/matters/${matter.id}/timeline`)}
            style={styles.secondaryBtn}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* INFO GRID */}
      <div style={styles.grid}>
        <div style={styles.infoCard}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              textTransform: "uppercase",
            }}
          >
            Client
          </div>

          {/* VIEW MODE */}
          {!editingClient && matter?.client_id && (
            <>
              <div style={{ fontWeight: 600, marginTop: 8, color: "var(--text)" }}>
                {clients.find((c) => c.id === matter.client_id)?.name ||
                  clients.find((c) => c.id === matter.client_id)?.full_name ||
                  "Client Assigned"}
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingClient(true);
                    setClientId(matter.client_id);
                  }}
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    background: "#fff7ed",
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  ✏️ Edit
                </button>
              )}
            </>
          )}

          {/* EDIT MODE */}
          {editingClient && isAdmin && (
            <>
              <select
                value={clientId || ""}
                onChange={(e) => setClientId(e.target.value)}
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  fontWeight: 600,
                }}
              >
                <option value="">Select Client</option>

                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.full_name}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={async () => {
                    await updateClient();
                    setEditingClient(false);
                  }}
                  style={styles.primaryBtn}
                >
                  Save
                </button>

                <button
                  onClick={() => {
                    setEditingClient(false);
                    setClientId(matter?.client_id || "");
                  }}
                  style={styles.secondaryBtn}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* NO CLIENT LINKED */}
          {!matter?.client_id && isAdmin && !editingClient && (
            <button
              onClick={() => {
                setEditingClient(true);
                setClientId("");
              }}
              style={{
                marginTop: 8,
                width: "fit-content",
                ...styles.primaryBtn,
              }}
            >
              + Link Client
            </button>
          )}
        </div>

        <div style={styles.infoCard}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase"
          }}>
            Status
          </div>

          <select
            value={matter.current_status || ""}
            onChange={(e) => {
              const newStatus = e.target.value;

              if (["Allowed", "Disposed", "Dismissed"].includes(newStatus)) {
                setPendingStatus(newStatus);
                setShowOrderModal(true);
                return;
              }

              updateStatusDirectly(newStatus);
            }}
            style={{
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              fontWeight: 600
            }}
          >
            <option value="Pending">Pending</option>
            <option value="Allowed">Allowed</option>
            <option value="Disposed">Disposed</option>
            <option value="Dismissed">Dismissed</option>
          </select>
        </div>

        <Info label="State" value={matter.state} />
        <Info label="City" value={matter.city} />
        <Info label="Forum" value={matter.forum} />
        <div style={styles.infoCard}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            Claim Amount
          </div>

          {/* VIEW MODE */}
          {!editingClaim && (
            <>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text)",
                marginTop: 6
              }}>
                {formatCurrency(matter.claim_amount)}
              </div>

              <button
                onClick={() => setEditingClaim(true)}
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  background: "#fff7ed",
                  cursor: "pointer",
                  width: "fit-content"
                }}
              >
                ✏️ Edit
              </button>
            </>
          )}

          {/* EDIT MODE */}
          {editingClaim && (
            <>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #d1d5db",
                  fontWeight: 600,
                  color: "var(--text)"
                }}
              />

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  disabled={savingClaim}
                  onClick={handleUpdateClaim}
                  style={styles.primaryBtn}
                >
                  {savingClaim ? "Saving..." : "Save"}
                </button>

                <button
                  onClick={() => {
                    setEditingClaim(false);
                    setClaimAmount(matter.claim_amount || "");
                  }}
                  style={styles.secondaryBtn}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
        <div style={styles.infoCard}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            Next Hearing Date
          </div>

          <div style={{
            fontSize: 18,
            fontWeight: 700,
            marginTop: 6,
            color: "var(--text)"
          }}>
            {formatDate(matter.ndoh)}
          </div>

          <button
              onClick={() => setShowNDOHModal(true)}
              disabled={isClosed}
              style={{
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "white",
                opacity: isClosed ? 0.5 : 1,
                cursor: isClosed ? "not-allowed" : "pointer"
              }}
            >
            Update
          </button>
        </div>
        <div style={styles.infoCard}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            Last Hearing Date
          </div>

          <button
            style={{
              marginTop: 8,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              background: "#fee2e2",
              color: "#991b1b",
              border: "none",
              cursor: "pointer"
            }}
            onClick={async () => {
              if (!window.confirm("Undo last hearing update?")) return;

              try {
                await fetch(`${API_BASE}/hearings/undo-last-hearing/${matter.id}`, {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                  },
                });

                await load();
                setToast("Last update undone");
                setTimeout(() => setToast(""), 2000);
              } catch (err) {
                alert("Undo failed");
              }
            }}
          >
            ↩ Undo Last Hearing Update
          </button>


          <input
            type="date"
            value={ldoh || ""}
            onChange={(e) => setLdoh(e.target.value)}
            style={{
              marginTop: 6,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              color: "var(--text)"
            }}
          />

          <button
            style={{
              marginTop: 10,
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              background: "#111827",
              color: "white",
              border: "none",
              cursor: "pointer"
            }}
            onClick={async () => {
              if (!ldoh) {
                alert("Please select a date");
                return;
              }

              try {
                if (!id || isNaN(Number(id))) return;
                await updateLDOH(matter.id, ldoh);
                await load();
                setToast("Last hearing date updated");
                setTimeout(() => setToast(""), 2000);
              } catch (err) {
                alert(err.message);
              }
            }}
          >
            Save
          </button>
          <button
            onClick={() => setEditMode(true)}
            style={{
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff7ed",
              cursor: "pointer"
            }}
          >
            ✏️ Edit Last Entry
          </button>
        </div>
      </div>

      {editMode && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.modal}>
            <h3>Edit Last Hearing</h3>

            <input
              type="date"
              value={newNDOH}
              onChange={(e) => setNewNDOH(e.target.value)}
              style={{ ...styles.select, width: "100%" }}
            />

            <textarea
              placeholder="Reason for correction"
              value={ndohComment}
              onChange={(e) => setNDOHComment(e.target.value)}
              style={{ ...styles.select, height: 80 }}
            />

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <button
                style={styles.primaryBtn}
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE}/edit-last-ndoh/${matter.id}`, {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                      },
                      body: JSON.stringify({
                        new_ndoh: newNDOH,
                        comment: ndohComment,
                      }),
                    });

                    await load();
                    setEditMode(false);
                  } catch (err) {
                    alert("Edit failed");
                  }
                }}
              >
                Save
              </button>

              <button
                style={styles.secondaryBtn}
                onClick={() => setEditMode(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.infoCard}>
        <div style={typography.highlightLabel}>Stage</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            style={{
              ...styles.select,
              ...typography.valueStrong,
              width: "100%"
            }}
          >
            <option value="">Select Stage</option>
            <option value="Admission">Admission</option>
            <option value="Notice Issued">Notice Issued</option>
            <option value="Reply Filed">Reply Filed</option>
            <option value="Evidence">Evidence</option>
            <option value="Arguments">Arguments</option>
            <option value="Order Reserved">Order Reserved</option>
            <option value="Disposed">Disposed</option>
          </select>

          <button
            style={{
              ...components.primaryBtn,
              padding: "6px 14px",
              fontSize: 16,
              width: "auto"
            }}
            disabled={savingStage}
            onClick={async () => {
              if (!selectedStage) {
                alert("Please select a stage");
                return;
              }

              try {
                setSavingStage(true);
                await updateStage(matter.id, selectedStage);
                setMatter((prev) => ({
                  ...prev,
                  current_stage: selectedStage,
                }));
                setToast("Stage updated successfully");
                setTimeout(() => setToast(""), 2000);
              } catch (err) {
                alert(err.message);
              } finally {
                setSavingStage(false);
              }
            }}
          >
            {savingStage ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
                
      {/* HEARING HISTORY SECTION */}
        <Section
          title="Hearing History"
          actions={
            <button
              onClick={() => setShowNDOHModal(true)}
              disabled={isClosed}
              style={{
                fontSize: 13,
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "white",
                opacity: isClosed ? 0.5 : 1,
                cursor: isClosed ? "not-allowed" : "pointer"
              }}
            >
              + Update
            </button>
          }
        >
          {ndohHistory.length === 0 ? (
            <div style={styles.small}>No hearing updates yet.</div>
          ) : (
            <select
              style={{
                ...styles.select,
                ...typography.valueStrong,
                width: "100%"
              }}
              onChange={(e) => {
                const selected = ndohHistory.find(
                  (h) => h.id === Number(e.target.value)
                );
                setSelectedHistory(selected || null);
              }}
              defaultValue=""
            >
              <option value="">Select Hearing Date</option>
              {ndohHistory.map((h) => (
                <option key={h.id} value={h.id}>
                  {formatDate(h.new_ndoh)} {h.is_edited ? "✏️ (Edited)" : ""}
                </option>
              ))}
            </select>
          )}
        </Section>

      {/* COUNSEL SECTION */}
      <Section
        title="Local Counsel"
        actions={
          !matter.counsel && (
            <button
              style={components.primaryBtn}
              onClick={() => {
                setSelectedCounselId("");
                setEditingCounsel(true);
              }}
            >
              Assign Counsel
            </button>
          )
        }
      >

        {/* ---------------- VIEW MODE ---------------- */}
        {matter.counsel && !editingCounsel && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 16,
              marginTop: 8
            }}
          >

            <Field label="Full Name" value={matter.counsel.name} />
            <Field label="Mobile No." value={matter.counsel.phone} />
            <Field label="Alternate Mobile" value={matter.counsel.alternate_phone} />
            <Field label="Email" value={matter.counsel.email} />
            <Field label="City" value={matter.counsel.city} />
            <Field label="State" value={matter.counsel.state} />
            <Field label="Postal Address" value={matter.counsel.postal_address} />
            <Field label="Bar Registration No." value={matter.counsel.bar_registration_no} />
            <Field label="PAN No." value={matter.counsel.pan_no} />
            <Field label="UPI / Bank Details" value={matter.counsel.upi_details} />
            <Field label="Reference" value={matter.counsel.reference} />

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                style={components.secondaryBtn}
                onClick={() =>
                  navigate(`${basePath}/local-counsels/${matter.counsel.id}/edit`)
                }
              >
                Edit
              </button>

              <button
                style={components.primaryBtn}
                onClick={() => {
                  setEditingCounsel(true);
                  setSelectedCounselId("");
                }}
              >
                Change
              </button>

              <button
                style={{
                  ...components.secondaryBtn,
                  whiteSpace: "nowrap"
                }}
                onClick={() =>
                  navigate(`${basePath}/local-counsels/create?city=${matter.city}&returnTo=${id}`)
                }
              >
                + Add New
              </button>
            </div>

          </div>
        )}

        <Section title="GNP Counsel">

          {matter.gnp_lawyer_id ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 600 }}>
                Assigned Counsel:
              </div>

              <div style={{ marginTop: 6 }}>
                {
                  gnpCounsels.find(c => c.id === matter.gnp_lawyer_id)?.full_name
                  || "Assigned"
                }
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              {matter.gnp_counsel ? (
                <div style={{ fontWeight: 600 }}>
                  {matter.gnp_counsel.full_name || matter.gnp_counsel.name}
                </div>
              ) : (
                <div>No GNP Counsel Assigned</div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>

            <select
              value={selectedGnpCounsel}
              onChange={(e) => setSelectedGnpCounsel(e.target.value)}
              style={{ ...styles.select, minWidth: 220 }}
            >
              <option value="">Select GNP Counsel</option>

              {gnpCounsels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.name}
                </option>
              ))}
            </select>

            <button
              style={styles.primaryBtn}
              disabled={savingGnp}
              onClick={() => assignGNPCounselHandler(selectedGnpCounsel)}
            >
              {savingGnp ? "Assigning..." : "Assign"}
            </button>

          </div>

        </Section>

        {/* ---------------- EDIT MODE (Change) ---------------- */}
        {editingCounsel && (
          <div style={modalStyles.overlay}>
            <div style={modalStyles.modal}>
              
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    Assign / Change Counsel
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Select local counsel for this matter
                  </div>
                </div>

                <button
                  onClick={() => setEditingCounsel(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Dropdown */}
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Counsel
                </label>

                <select
                  value={selectedCounselId}
                  onChange={(e) => setSelectedCounselId(e.target.value)}
                  style={{
                    ...styles.select,
                    width: "100%",
                    marginTop: 6
                  }}
                >
                  <option value="">Select Counsel</option>
                  {counselList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10
              }}>
                <button
                  style={components.secondaryBtn}
                  onClick={() => setEditingCounsel(false)}
                >
                  Cancel
                </button>

                <button
                  style={components.primaryBtn}
                  disabled={savingCounsel}
                  onClick={async () => {
                    if (!selectedCounselId) {
                      alert("Please select a counsel");
                      return;
                    }

                    try {
                      setSavingCounsel(true);
                      if (!id || isNaN(Number(id))) return;  
                      await assignCounsel(Number(matter.id), Number(selectedCounselId));
                      await load();
                      setEditingCounsel(false);

                    } catch (err) {
                      alert(err.message);
                    } finally {
                      setSavingCounsel(false);
                    }
                  }}
                >
                  {savingCounsel ? "Saving..." : "Save"}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ---------------- NO COUNSEL ASSIGNED ---------------- */}
        {!matter.counsel && !editingCounsel && (
          <div>

            <div style={typography.valueStrong}>
              No counsel assigned
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>

              <button
                style={components.primaryBtn}
                onClick={() => {
                  setSelectedCounselId("");
                  setEditingCounsel(true);
                }}
              >
                Assign Counsel
              </button>

              <button
                style={components.secondaryBtn}
                onClick={() =>
                  navigate(`${basePath}/local-counsels/create?city=${matter.city}&returnTo=${id}`)
                }
              >
                + Add New
              </button>

            </div>

          </div>
        )}

      </Section>

      {/* UPLOAD PLEADINGS */}
      <Section title="Upload Pleadings">
        {[
          "Complaint",
          "Vakalatnama",
          "Written Statement / Reply",
          "Evidence",
          "Written Arguments",
          "Complainant Evidence",
          "Complainant Rejoinder",
          "Complainant Written Arguments",
          "Annexures",
          "Judgements",
          "Other"
        ].map((type) => (
          <div key={type} style={styles.uploadRow}>
            <label style={{ ...typography.valueStrong, minWidth: 220 }}>
              {type}
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="file"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] || null;
                  setPleadingFiles((prev) => ({
                    ...prev,
                    [type]: selectedFile,
                  }));
                }}
              />

              <button
                onClick={() => handleSave(type)}
                disabled={!pleadingFiles[type] || savingPleadingType === type}
                style={{
                  ...styles.primaryBtn,
                  opacity: !pleadingFiles[type] || savingPleadingType === type ? 0.6 : 1,
                }}
              >
                {savingPleadingType === type ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ))}

        {/* CUSTOM DOCUMENTS */}
          <div style={{ marginTop: 20 }}>

            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              Custom Documents
            </div>

            {customDocs.map((doc, index) => (
              <div key={index} style={styles.uploadRow}>

                <input
                  type="text"
                  placeholder="Enter document type"
                  value={doc.type}
                  onChange={(e) =>
                    updateCustomDoc(index, "type", e.target.value)
                  }
                  style={{
                    ...styles.select,
                    width: 220
                  }}
                />

                <input
                  type="file"
                  onChange={(e) =>
                    updateCustomDoc(index, "file", e.target.files[0])
                  }
                />

                <button
                  onClick={() => saveCustomDoc(doc)}
                  style={styles.primaryBtn}
                >
                  Save
                </button>

              </div>
            ))}

            <button
              onClick={addCustomDoc}
              style={{ ...styles.secondaryBtn, marginTop: 10 }}
            >
              ➕ Add More Documents
            </button>

          </div>
      </Section>

      {/* DOCUMENTS */}
      <Section title="Documents">
        {documents.length > 0 ? (
          documents.map((doc) => (
            <DocumentRow 
              key={doc.id} 
              doc={doc} 
              load={loadDocuments} 
              API_BASE={API_BASE}
            />
          ))
        ) : (
          <div style={typography.valueStrong}>
            No documents uploaded
          </div>
        )}
      </Section>

      {/* FINANCIALS */}
        <Section title="Counsel Invoice">

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 1fr 280px",
              gap: 20,
            }}
          >

            {/* TOTAL AGREED FEE */}
            <div style={styles.invoiceCard}>
              <div style={styles.invoiceLabel}>Total Agreed Fee</div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  value={invoice.total_fee || ""}
                  onChange={(e) =>
                    setInvoice({ ...invoice, total_fee: Number(e.target.value) })
                  }
                  style={{ ...styles.smallInput, width: "140px" }}
                />
                <div style={styles.invoiceAmount}>
                  {invoice.total_fee
                    ? formatCurrency(invoice.total_fee)
                    : "₹ 0"}
                </div>

                <button
                  onClick={saveInvoice}
                  style={{ ...styles.smallBtn, padding: "8px 14px" }}
                >
                  Save
                </button>
              </div>
            </div>


            {/* PART 1 */}
            <div style={styles.invoiceCard}>
              <div style={styles.invoiceLabel}>Part-1 (50%)</div>

              <div style={styles.invoiceAmount}>
                {invoice.total_fee
                  ? formatCurrency(invoice.total_fee * 0.5)
                  : "₹ 0"}
              </div>

              <input
                type="file"
                onChange={(e) => uploadFile(e, "part1")}
                style={{ marginTop: 8 }}
              />

              {invoice.part1_file && (
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => openSecureFile(invoice.part1_file)}
                    style={styles.openBtn}
                  >
                    View / Download
                  </button>

                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteInvoiceFile("part1")}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>


            {/* PART 2 */}
            <div style={styles.invoiceCard}>
              <div style={styles.invoiceLabel}>Part-2 (50%)</div>

              <div style={styles.invoiceAmount}>
                {invoice.total_fee
                  ? formatCurrency(invoice.total_fee * 0.5)
                  : "₹ 0"}
              </div>

              <input
                type="file"
                onChange={(e) => uploadFile(e, "part2")}
                style={{ marginTop: 8 }}
              />

              {invoice.part2_file && (
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => openSecureFile(invoice.part2_file)}
                    style={styles.openBtn}
                  >
                    View / Download
                  </button>

                  <button
                    style={styles.deleteBtn}
                    onClick={() => deleteInvoiceFile("part2")}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>


            {/* MISCELLANEOUS */}
              <div style={styles.invoiceCard}>
                <div style={styles.invoiceLabel}>Miscellaneous</div>

                <input
                  type="number"
                  value={invoice.miscellaneous_fee || ""}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      miscellaneous_fee: Number(e.target.value)
                    })
                  }
                  onBlur={async () => {
                    if (
                      invoice.miscellaneous_fee ===
                      (matter.counsel_invoice?.miscellaneous_fee || 0)
                    ) {
                      return; // no change → no API call
                    }

                    try {
                      const token = localStorage.getItem("token");

                      const res = await fetch(
                        `${API_BASE}/matters/${matter.id}/counsel-invoice`,
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            total_fee: invoice.total_fee,
                            miscellaneous_fee: invoice.miscellaneous_fee,
                          }),
                        }
                      );

                      if (!res.ok) throw new Error("Failed to save");

                      await load();
                      setToast("Miscellaneous updated");
                      setTimeout(() => setToast(""), 2000);

                    } catch (err) {
                      alert(err.message);
                    }
                  }}
                  style={{
                    ...styles.smallInput,
                    width: "140px",
                    marginTop: 6
                  }}
                />

                <div style={styles.invoiceAmount}>
                  {invoice.miscellaneous_fee
                    ? formatCurrency(invoice.miscellaneous_fee)
                    : "₹ 0"}
                </div>

                <input
                  type="file"
                  onChange={(e) => uploadFile(e, "misc")}
                  style={{ marginTop: 8 }}
                />

                {invoice.miscellaneous_file && (
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button
                      onClick={() => openSecureFile(invoice.miscellaneous_file)}
                      style={styles.openBtn}
                    >
                      View / Download
                    </button>

                    <button
                      style={styles.deleteBtn}
                      onClick={() => deleteInvoiceFile("misc")}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

                      {/* GRAND TOTAL */}
                        <div
                          style={{
                            ...styles.grandTotalCard,
                            ...(animateTotal ? styles.grandTotalHighlight : {}),
                            alignSelf: "start",
                            height: "fit-content"
                          }}
                        >
                          <div style={styles.grandTotalLabel}>
                            Amount Payable to Counsel
                          </div>

                          <div style={styles.grandTotalBreakup}>
                            <div>
                              {formatCurrency(invoice.total_fee || 0)}
                            </div>
                            <div>
                              + {formatCurrency(invoice.miscellaneous_fee || 0)}
                            </div>
                          </div>

                          <div style={styles.grandTotalAmount}>
                            {formatCurrency(
                              (invoice.total_fee || 0) +
                              (invoice.miscellaneous_fee || 0)
                            )}
                          </div>
                        </div>

                    </div>   {/* closes grid */}
                  </Section>

                {/* COUNSEL PAYMENT */}
                <Section title="Counsel Payment">

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr 1fr 280px",
                      gap: 20,
                      alignItems: "start",
                    }}
                  >

                    {/* PART 1 */}
                    <div style={styles.invoiceCard}>
                      <div style={styles.invoiceLabel}>Part-1 (50%)</div>

                      <div style={styles.invoiceAmount}>
                        {invoice.total_fee
                          ? formatCurrency(invoice.total_fee * 0.5)
                          : "₹ 0"}
                      </div>

                      <input
                        type="file"
                        onChange={(e) => uploadPaymentFile(e, "part1")}
                        style={{ marginTop: 8 }}
                      />

                      {matter.counsel_payment?.part1_file && (
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button
                            onClick={() => openSecureFile(matter.counsel_payment.part1_file)}
                            style={styles.openBtn}
                          >
                            View / Download
                          </button>

                          <button
                            style={styles.deleteBtn}
                            onClick={() => deletePaymentFile("part1")}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>


                    {/* PART 2 */}
                    <div style={styles.invoiceCard}>
                      <div style={styles.invoiceLabel}>Part-2 (50%)</div>

                      <div style={styles.invoiceAmount}>
                        {invoice.total_fee
                          ? formatCurrency(invoice.total_fee * 0.5)
                          : "₹ 0"}
                      </div>

                      <input
                        type="file"
                        onChange={(e) => uploadPaymentFile(e, "part2")}
                        style={{ marginTop: 8 }}
                      />

                      {matter.counsel_payment?.part2_file && (
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button
                            onClick={() => openSecureFile(matter.counsel_payment.part2_file)}
                            style={styles.openBtn}
                          >
                            View / Download
                          </button>

                          <button
                            style={styles.deleteBtn}
                            onClick={() => deletePaymentFile("part2")}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>


                    {/* MISCELLANEOUS */}
                    <div style={styles.invoiceCard}>
                      <div style={styles.invoiceLabel}>Miscellaneous</div>

                      <div style={styles.invoiceAmount}>
                        {formatCurrency(invoice.miscellaneous_fee || 0)}
                      </div>

                      <input
                        type="file"
                        onChange={(e) => uploadPaymentFile(e, "misc")}
                        style={{ marginTop: 8 }}
                      />

                      {matter.counsel_payment?.miscellaneous_file && (
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <button
                            onClick={() => openSecureFile(matter.counsel_payment.miscellaneous_file)}
                            style={styles.openBtn}
                          >
                            View / Download
                          </button>

                          <button
                            style={styles.deleteBtn}
                            onClick={() => deletePaymentFile("misc")}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>


                    {/* AMOUNT PENDING */}
                    <div
                      style={{
                        background: "#f9fafb",
                        padding: 18,
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxWidth: 240
                      }}
                    >
                      <div style={styles.invoiceLabel}>Amount Pending</div>

                      {(() => {
                        const totalDue =
                          (invoice.total_fee || 0) +
                          (invoice.miscellaneous_fee || 0);

                        const totalPaid =
                          (matter.counsel_payment?.part1_paid || 0) +
                          (matter.counsel_payment?.part2_paid || 0) +
                          (matter.counsel_payment?.miscellaneous_paid || 0);

                        const pending = totalDue - totalPaid;

                        if (pending <= 0 && totalDue > 0) {
                          return (
                            <div style={{ color: "#16a34a", fontWeight: 700 }}>
                              ✅ All dues cleared
                            </div>
                          );
                        }

                        return (
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: "#dc2626"
                            }}
                          >
                            {formatCurrency(pending)}
                          </div>
                        );
                      })()}
                    </div>

                  </div>


                  {/* PAYMENT HISTORY (INSIDE SAME SECTION) */}
                  <div style={{ marginTop: 24 }}>

                    <div style={styles.invoiceLabel}>
                      Amount Paid to Counsel
                    </div>

                    {matter.counsel_payment?.part1_paid > 0 && (
                      <div style={styles.paymentHistoryRow}>
                        Part-1 {formatCurrency(matter?.counsel_payment?.part1_paid)}
                        {" "}on {formatDate(matter.counsel_payment.part1_paid_at)}
                      </div>
                    )}

                    {matter.counsel_payment?.part2_paid > 0 && (
                      <div style={styles.paymentHistoryRow}>
                        Part-2 {formatCurrency(matter?.counsel_payment?.part2_paid)}
                        {" "}on {formatDate(matter.counsel_payment.part2_paid_at)}
                      </div>
                    )}

                    {matter.counsel_payment?.miscellaneous_paid > 0 && (
                      <div style={styles.paymentHistoryRow}>
                        Misc {formatCurrency(matter.counsel_payment.miscellaneous_paid)}
                        {" "}on {formatDate(matter.counsel_payment.miscellaneous_paid_at)}
                      </div>
                    )}

                  </div>

                </Section>

      <Section title="Client Invoice">

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 280px",
            gap: 20,
            alignItems: "start",
          }}
        >

          {/* TOTAL AGREED FEE */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Total Agreed Fee</div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="number"
                value={clientInvoice.total_fee || ""}
                onChange={(e) =>
                  setClientInvoice({
                    ...clientInvoice,
                    total_fee: Number(e.target.value)
                  })
                }
                style={{ ...styles.smallInput, width: "140px" }}
              />

              <div style={styles.invoiceAmount}>
                {clientInvoice.total_fee
                  ? formatCurrency(clientInvoice.total_fee)
                  : "₹ 0"}
              </div>

              <button
                onClick={saveClientInvoice}
                style={{ ...styles.smallBtn, padding: "8px 14px" }}
              >
                Save
              </button>
            </div>
          </div>


          {/* PART 1 */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Part-1 (50%)</div>

            <div style={styles.invoiceAmount}>
              {clientInvoice.total_fee
                ? formatCurrency(clientInvoice.total_fee * 0.5)
                : "₹ 0"}
            </div>

            <input
              type="file"
              onChange={(e) => uploadClientFile(e, "part1")}
              style={{ marginTop: 8 }}
            />

            {clientInvoice.part1_file && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => openSecureFile(clientInvoice.part1_file)}
                  style={styles.openBtn}
                >
                  View / Download
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteClientInvoiceFile("part1")}
                >
                  Delete
                </button>
              </div>
            )}
          </div>


          {/* PART 2 */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Part-2 (50%)</div>

            <div style={styles.invoiceAmount}>
              {clientInvoice.total_fee
                ? formatCurrency(clientInvoice.total_fee * 0.5)
                : "₹ 0"}
            </div>

            <input
              type="file"
              onChange={(e) => uploadClientFile(e, "part2")}
              style={{ marginTop: 8 }}
            />

            {clientInvoice.part2_file && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => openSecureFile(clientInvoice.part2_file)}
                  style={styles.openBtn}
                >
                  View / Download
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteClientInvoiceFile("part2")}
                >
                  Delete
                </button>
              </div>
            )}
          </div>


          {/* MISCELLANEOUS */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Miscellaneous</div>

            <input
              type="number"
              value={clientInvoice.miscellaneous_fee || ""}
              onChange={(e) =>
                setClientInvoice({
                  ...clientInvoice,
                  miscellaneous_fee: Number(e.target.value)
                })
              }
              style={{
                ...styles.smallInput,
                width: "140px",
                marginTop: 6
              }}
            />

            <div style={styles.invoiceAmount}>
              {clientInvoice.miscellaneous_fee
                ? formatCurrency(clientInvoice.miscellaneous_fee)
                : "₹ 0"}
            </div>

            <input
              type="file"
              onChange={(e) => uploadClientFile(e, "misc")}
              style={{ marginTop: 8 }}
            />

            {clientInvoice.miscellaneous_file && (
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => openSecureFile(matter.client_invoice.miscellaneous_file)}
                  style={styles.openBtn}
                >
                  View / Download
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteClientInvoiceFile("misc")}
                >
                  Delete
                </button>
              </div>
            )}
          </div>


          {/* GRAND TOTAL */}
          <div
            style={{
              ...styles.grandTotalCard,
              ...(animateTotal ? styles.grandTotalHighlight : {})
            }}
          >
            <div style={styles.grandTotalLabel}>
              Amount Payable
            </div>

            <div style={styles.grandTotalBreakup}>
              <div>
                {formatCurrency(clientInvoice.total_fee || 0)}
              </div>
              <div>
                + {formatCurrency(clientInvoice.miscellaneous_fee || 0)}
              </div>
            </div>

            <div style={styles.grandTotalAmount}>
              {formatCurrency(
                (clientInvoice.total_fee || 0) +
                (clientInvoice.miscellaneous_fee || 0)
              )}
            </div>
          </div>

        </div>

      </Section>

      <Section title="Client Payment">

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 280px",
            gap: 20,
            alignItems: "start",
          }}
        >

          {/* PART 1 */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Part-1 (50%)</div>

            <div style={styles.invoiceAmount}>
              {clientInvoice.total_fee
                ? formatCurrency(clientInvoice.total_fee * 0.5)
                : "₹ 0"}
            </div>

            <input
              type="text"
              placeholder="Reference No."
              value={clientPaymentRefs.part1}
              onChange={(e) =>
                setClientPaymentRefs((prev) => ({
                  ...prev,
                  part1: e.target.value,
                }))
              }
              style={{ ...styles.smallInput, marginTop: 8 }}
            />

            <input
              type="file"
              onChange={(e) => uploadClientPaymentFile(e, "part1")}
              style={{ marginTop: 8 }}
            />

            {matter.client_payment?.part1_file && (
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => openSecureFile(matter.client_payment.part1_file)}
                  style={styles.openBtn}
                >
                  View / Download
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteClientPaymentFile("part1")}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* PART 2 */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Part-2 (50%)</div>

            <div style={styles.invoiceAmount}>
              {clientInvoice.total_fee
                ? formatCurrency(clientInvoice.total_fee * 0.5)
                : "₹ 0"}
            </div>

            <input
              type="text"
              placeholder="Reference No."
              value={clientPaymentRefs.part2}
              onChange={(e) =>
                setClientPaymentRefs((prev) => ({
                  ...prev,
                  part2: e.target.value,
                }))
              }
              style={{ ...styles.smallInput, marginTop: 8 }}
            />

            <input
              type="file"
              onChange={(e) => uploadClientPaymentFile(e, "part2")}
              style={{ marginTop: 8 }}
            />

            {matter.client_payment?.part2_file && (
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => openSecureFile(matter.client_payment.part2_file)}
                  style={styles.openBtn}
                >
                  View / Download
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteClientPaymentFile("part2")}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* MISC */}
          <div style={styles.invoiceCard}>
            <div style={styles.invoiceLabel}>Miscellaneous</div>

            <div style={styles.invoiceAmount}>
              {formatCurrency(clientInvoice.miscellaneous_fee || 0)}
            </div>

            <input
              type="text"
              placeholder="Reference No."
              value={clientPaymentRefs.misc}
              onChange={(e) =>
                setClientPaymentRefs((prev) => ({
                  ...prev,
                  misc: e.target.value,
                }))
              }
              style={{ ...styles.smallInput, marginTop: 8 }}
            />

            <input
              type="file"
              onChange={(e) => uploadClientPaymentFile(e, "misc")}
              style={{ marginTop: 8 }}
            />

            {matter.client_payment?.miscellaneous_file && (
              <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => openSecureFile(matter.client_payment.miscellaneous_file)}
                  style={styles.openBtn}
                >
                  View / Download
                </button>

                <button
                  style={styles.deleteBtn}
                  onClick={() => deleteClientPaymentFile("misc")}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* AMOUNT PENDING */}
          <div
            style={{
              background: "#f9fafb",
              padding: 18,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxWidth: 240
            }}
          >
            <div style={styles.invoiceLabel}>Amount Pending</div>

            {(() => {
              const totalDue =
                (clientInvoice.total_fee || 0) +
                (clientInvoice.miscellaneous_fee || 0);

              const totalPaid =
                (matter.client_payment?.part1_paid || 0) +
                (matter.client_payment?.part2_paid || 0) +
                (matter.client_payment?.miscellaneous_paid || 0);

              const pending = totalDue - totalPaid;

              if (pending <= 0 && totalDue > 0) {
                return (
                  <div style={{ color: "#16a34a", fontWeight: 700 }}>
                    ✅ All dues cleared
                  </div>
                );
              }

              return (
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#dc2626"
                  }}
                >
                  {formatCurrency(pending)}
                </div>
              );
            })()}
          </div>
        </div>

        {/* PAYMENT HISTORY */}
        <div style={{ marginTop: 24 }}>
          <div style={styles.invoiceLabel}>Amount Received From Client</div>

          {matter.client_payment?.part1_paid > 0 && (
            <div style={styles.paymentHistoryRow}>
              Part-1 {formatCurrency(matter.client_payment.part1_paid)}
              {" "}on {formatDate(matter.client_payment.part1_paid_at)}
              {" "}| Ref No: {matter.client_payment.part1_reference_no || "-"}
            </div>
          )}

          {matter.client_payment?.part2_paid > 0 && (
            <div style={styles.paymentHistoryRow}>
              Part-2 {formatCurrency(matter.client_payment.part2_paid)}
              {" "}on {formatDate(matter.client_payment.part2_paid_at)}
              {" "}| Ref No: {matter.client_payment.part2_reference_no || "-"}
            </div>
          )}

          {matter.client_payment?.miscellaneous_paid > 0 && (
            <div style={styles.paymentHistoryRow}>
              Misc {formatCurrency(matter.client_payment.miscellaneous_paid)}
              {" "}on {formatDate(matter.client_payment.miscellaneous_paid_at)}
              {" "}| Ref No: {matter.client_payment.miscellaneous_reference_no || "-"}
            </div>
          )}
        </div>
      </Section>

      {showNDOHModal && (
  <div style={modalStyles.overlay}>
    <div style={modalStyles.modal}>
      <h3>Update Next Hearing Date</h3>

      <label style={{ fontSize: 14 }}>New Date</label>

      <input
        type="date"
        value={newNDOH}
        onChange={(e) => setNewNDOH(e.target.value)}
        style={{ ...styles.select, width: "100%" }}
      />

      <label style={{ fontSize: 14, marginTop: 12 }}>
        Comment (Mandatory)
      </label>
      <textarea
        value={ndohComment}
        onChange={(e) => setNDOHComment(e.target.value)}
        style={{ ...styles.select, height: 80 }}
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          onClick={handleUpdateNDOH}
          disabled={savingNDOH}
          style={styles.primaryBtn}
        >
          {savingNDOH ? "Saving..." : "Save"}
        </button>

        <button
          onClick={() => setShowNDOHModal(false)}
          style={styles.secondaryBtn}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{selectedHistory && (
  <div style={modalStyles.overlay}>
    <div style={modalStyles.modal}>
      <h3>Hearing Update Details</h3>

      <div style={{ fontSize: 14 }}>
        <strong>Old Date:</strong> {formatDate(selectedHistory.old_ndoh)}
      </div>

      <div style={{ fontSize: 14 }}>
        <strong>New Date:</strong> {formatDate(selectedHistory.new_ndoh)}
      </div>

      <div style={{ marginTop: 12 }}>
        <strong>Comment:</strong>
        <div style={{ marginTop: 6 }}>
          {selectedHistory.comment}
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
        Updated on {new Date(selectedHistory.created_at).toLocaleString()}
      </div>

      <button
        style={{ ...styles.secondaryBtn, marginTop: 20 }}
        onClick={() => setSelectedHistory(null)}
      >
        Close
      </button>
    </div>
  </div>
)}

{showOrderModal && (
  <div style={modalStyles.overlay}>
    <div style={modalStyles.modal}>
      <h3>Upload Final Order</h3>

      <label>Order Date *</label>
      <input
        type="date"
        value={orderDate}
        onChange={(e) => setOrderDate(e.target.value)}
        style={{ ...styles.select, width: "100%" }}
      />

      <label style={{ marginTop: 12 }}>Upload Order *</label>
      <input
        type="file"
        onChange={(e) => setOrderFile(e.target.files[0])}
      />

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          style={styles.primaryBtn}
          disabled={savingOrder}
          onClick={async () => {
            if (!orderDate || !orderFile) {
              alert("Order date and file are mandatory.");
              return;
            }

            try {
              setSavingOrder(true);

              const formData = new FormData();
              formData.append("status", pendingStatus);
              formData.append("order_date", orderDate);
              formData.append("file", orderFile);
              const token = localStorage.getItem("token");
              if (!token) {
                alert("Session expired. Please login again.");
                return;
              }

              const res = await fetch(
                `${API_BASE}/matters/${matter.id}/dispose`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                  },
                  body: formData,
                }
              );

              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed");
              }

              await load();

              setShowOrderModal(false);
              setOrderDate("");
              setOrderFile(null);

              navigate(`${basePath}/disposed-matters`);

            } catch (err) {
              alert(err.message);
            } finally {
              setSavingOrder(false);
            }
          }}
        >
          {savingOrder ? "Saving..." : "Save"}
        </button>

        <button
          style={styles.secondaryBtn}
          onClick={() => {
            setShowOrderModal(false);
            setOrderDate("");
            setOrderFile(null);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Info({ label, value }) {
  return (
    <div
      style={styles.infoCard}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: 0.5
      }}>
        {label}
      </div>

      <div style={{
        fontSize: 16,
        fontWeight: 700,
        color: "var(--text)",
        marginTop: 4
      }}>
        {value || "-"}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;

  return (
    <div
      style={{
        background: "#f9fafb",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid #e5e7eb"
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#6b7280",
          marginBottom: 4
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: 600,
          wordBreak: "break-word"
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ValueDisplay({ children }) {
  return (
    <div style={{ ...typography.valueStrong, marginTop: 8 }}>
      {children || "-"}
    </div>
  );
}

function Section({ title, children, actions }) {
  return (
    <div style={styles.section}>

      {/* HEADER */}
      <div style={styles.sectionHeader}>
        <div style={styles.sectionTitle}>{title}</div>

        {actions && (
          <div style={styles.sectionActions}>
            {actions}
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div style={styles.sectionBody}>
        {children}
      </div>

    </div>
  );
}

function DocumentRow({ doc, load, API_BASE }) {

  async function handleDelete() {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${API_BASE}/matters/documents/${doc.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Delete failed");
      }

      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  const openUrl = getFileUrl(doc.file_url);

  console.log("DOC OBJECT:", doc);
  console.log("FILE URL:", doc.file_url);
  console.log("OPEN URL:", openUrl);

  return (
    <div style={styles.docRow}>
      <div style={styles.fileName}>{doc.file_name}</div>

      <div style={styles.filePath}>{doc.file_url}</div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => openSecureFile(doc.file_url)}
          style={styles.openBtn}
        >
          Open
        </button>

        <button style={styles.deleteBtn} onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

/* ---------------- HELPERS ---------------- */

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return isNaN(d) ? "-" : d.toLocaleDateString("en-GB");
}

function formatCurrency(value) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

/* ---------------- STYLES ---------------- */

const styles = {
  wrapper: {
    padding: "32px 40px",
    background: "#f5f7fb",
    minHeight: "100vh",
    fontFamily: "Inter, sans-serif"
  },

  header: {
    marginBottom: 28,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 16
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    marginBottom: 28
  },

  infoCard: {
    background: "#ffffff",
    padding: 18,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    transition: "all 0.2s ease"
  },

  section: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    marginBottom: 24,
    overflow: "hidden"
  },

  sectionHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: 0.3
  },

  sectionActions: {
    display: "flex",
    gap: 10
  },

  sectionBody: {
    padding: "20px"
  },

  counselCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.lg
  },

  lockedSelectWrapper: {
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm
  },

  lockedInput: {
    padding: spacing.sm,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#f3f4f6"
  },

  editIconBtn: {
    background: "#e5e7eb",
    border: "none",
    padding: spacing.sm,
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s ease"
  },

  uploadRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9"
  },

  docRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9"
  },

  link: {
    color: colors.primary,
    textDecoration: "none",
    fontWeight: 600
  },

  select: {
    padding: spacing.sm,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 16
  },

  toast: {
    position: "fixed",
    top: spacing.lg,
    right: spacing.lg,
    background: "#16a34a",
    color: "white",
    padding: spacing.md,
    borderRadius: 12,
    boxShadow: elevation.level3
  },

  stageBadge: {
    marginTop: 12,
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: 20,
    background: "#257e40ff",
    color: "#f9f5f5ff",
    fontWeight: 700,
    fontSize: 14,
    animation: "blinkStage 1.2s infinite"
  },

  fileName: {
    fontWeight: 600,
    fontSize: 14,
    marginBottom: 4
  },

  filePath: {
    fontSize: 12,
    color: "#6b7280",
    wordBreak: "break-all",
    marginBottom: 8
  },

  openBtn: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 8,
    background: "#ff5e00ff",
    color: "white",
    textDecoration: "none",
    fontSize: 12,
    border: "none",
    cursor: "pointer"
  },

  deleteBtn: {
    background: "#ff5e00ff",
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    cursor: "pointer"
  },

  primaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "white",
    fontWeight: 600,
    cursor: "pointer"
  },

  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "white",
    fontWeight: 600,
    cursor: "pointer"
  },

  small: {
    fontSize: 13,
    color: "#6b7280"
  },

  invoiceCard: {
    background: "#ffffff",
    padding: 16,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    transition: "all 0.2s ease"
  },

  invoiceLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },

  invoiceAmount: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text)"
  },

  invoiceLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "#1e3a8a",
    textDecoration: "none"
  },

  smallInput: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14
  },

  smallBtn: {
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13
  },

  grandTotalCard: {
    background: "rgba(255, 255, 255, 1)",
    color: "black",
    padding: 18,
    borderRadius: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 75,
    height: "80%",
  },

  grandTotalHighlight: {
    transform: "scale(1.13)",
    boxShadow: "0 0 0 4px rgba(30,58,138,0.15)"
  },

  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 500,
    opacity: 0.7,
    textTransform: "uppercase"
  },

  grandTotalBreakup: {
    fontSize: 13,
    opacity: 0.7
  },

  grandTotalAmount: {
    fontSize: 26,
    fontWeight: 800,
    marginTop: 6
  },

  smallPaymentBox: {
    background: "#f9fafb",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    width: "200px",
    height: "fit-content"
  },

  paymentHistoryRow: {
    padding: "6px 0",
    fontSize: 14,
    borderBottom: "1px solid #f1f5f9"
  },

  clearedBadge: {
    marginTop: 12,
    padding: "10px 14px",
    background: "#16a34a",
    color: "white",
    borderRadius: 12,
    fontWeight: 600,
    width: "fit-content"
  },

  performanceCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#f9fafb"
  },

  performanceTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12
  },

  performanceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12
  },

  metricLabel: {
    fontSize: 11,
    color: "#6b7280"
  },

  metricValue: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--text)"
  }
};

const modalStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "var(--card)",
    color: "var(--text)",
    padding: 32,
    borderRadius: 16,
    width: 420,
    boxShadow: elevation.level2,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
};