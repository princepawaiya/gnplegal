import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import React from "react";
import { useToast } from "../components/Toast.jsx";
import { createClient, listClients, updateClient, deleteClient } from "../services/api";


const PAGE_SIZE = 8;

export default function Clients() {
  const navigate = useNavigate();
  const toast = useToast();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clientName, setClientName] = useState("");
  const [spocs, setSpocs] = useState([{ spoc_name: "", email: "", phone: "" }]);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSpocs, setEditSpocs] = useState([]);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [deletedSpocs, setDeletedSpocs] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listClients();

      console.log("CLIENT RESPONSE →", data);

      const safeClients =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.items)
          ? data.items
          : [];

      setClients(safeClients);
    } catch (e) {
      toast.push({ variant: "error", title: "Failed", message: e.message });

      if (String(e.message).toLowerCase().includes("token")) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  /* ================= CREATE ================= */

  function updateSpoc(index, field, value) {
    const copy = [...spocs];
    copy[index] = { ...copy[index], [field]: value };
    setSpocs(copy);
  }

  function addSpoc() {
    setSpocs([...spocs, { spoc_name: "", email: "", phone: "" }]);
  }

  function removeSpoc(index) {
    const copy = spocs.filter((_, i) => i !== index);
    setSpocs(copy.length ? copy : [{ spoc_name: "", email: "", phone: "" }]);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = clientName.trim();
    if (!name) {
      toast.push({ variant: "warning", title: "Missing", message: "Client name is required." });
      return;
    }

    const cleaned = spocs.filter((s) => s.spoc_name || s.email || s.phone);

    try {
      await createClient(name, cleaned);
      setClientName("");
      setSpocs([{ spoc_name: "", email: "", phone: "" }]);
      toast.push({ variant: "success", title: "Created", message: "Client created successfully." });
      refresh();
    } catch (e2) {
      toast.push({ variant: "error", title: "Create failed", message: e2.message });
    }
  }

  /* ================= EDIT ================= */

  function startEdit(client) {
    setEditingId(client.id);
    setEditName(client.name);
    setEditSpocs(client.spocs?.length ? client.spocs : [{ spoc_name: "", email: "", phone: "" }]);
    setDeletedSpocs([]); // 🔥 FIX: reset deleted SPOCs per client
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSpocs([]);
  }

  function updateEditSpoc(index, field, value) {
    const copy = [...editSpocs];
    copy[index] = { ...copy[index], [field]: value };
    setEditSpocs(copy);
  }

  function addEditSpoc() {
    setEditSpocs([...editSpocs, { spoc_name: "", email: "", phone: "" }]);
  }

  function removeEditSpoc(index) {
    const spocToDelete = editSpocs[index];

    const confirmed = window.confirm(
      `Delete SPOC: ${spocToDelete?.spoc_name || "this contact"}?`
    );
    if (!confirmed) return;

    const copy = editSpocs.filter((_, i) => i !== index);
    setEditSpocs(copy.length ? copy : [{ spoc_name: "", email: "", phone: "" }]);

    setDeletedSpocs((prev) => [...prev, spocToDelete]);
  }

  async function saveEdit(id) {
  try {
    const cleaned = editSpocs.filter((s) => s.spoc_name || s.email || s.phone);

    await updateClient(
      id,
      {
        spocs: cleaned,
        deleted_spocs: deletedSpocs,
      },
      editName
    );

    toast.push({
      variant: "success",
      title: "Saved",
      message: "Client updated successfully.",
    });

    setDeletedSpocs([]);
    cancelEdit();
    refresh();
  } catch (err) {
    toast.push({
      variant: "error",
      title: "Save failed",
      message: err.message,
    });
  }
}

async function handleDeleteClient(id) {
  const confirmed = window.confirm("Are you sure you want to delete this client?");
  if (!confirmed) return;

  try {
    await deleteClient(id);

    toast.push({
      variant: "success",
      title: "Deleted",
      message: "Client deleted successfully.",
    });

    refresh();
  } catch (e) {
    toast.push({
      variant: "error",
      title: "Delete failed",
      message: e.message,
    });
  }
}

  /* ================= SEARCH ================= */

  const filtered = useMemo(() => {
    const base = Array.isArray(clients) ? clients : [];

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((c) =>
      (c.name || "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const safeFiltered = Array.isArray(filtered) ? filtered : [];

  const paged = safeFiltered.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Clients</div>
          <div style={styles.subtitle}>
            Where cases become workflows
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={styles.secondaryBtn}
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </button>

          <button
            style={styles.primaryBtn}
            onClick={() => setShowCreateModal(true)}
          >
            + Create Client
          </button>
        </div>
      </div>

      {/* DIRECTORY */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Client Directory</div>

        <input
          placeholder="Search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1); // 🔥 FIX: reset to first page on search
          }}
          style={styles.search}
        />

        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {paged.length === 0 && (
              <div style={styles.empty}>No clients found</div>
            )}
            {Array.isArray(paged) &&
              paged.map((c) => (
                <div style={{
                  ...styles.row,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  background: "white"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                >
                  {/* HEADER */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={styles.clientName}>{c.name}</div>

                      <div style={styles.spocList}>
                        {(Array.isArray(c.spocs) ? c.spocs : []).map((s, i) => (
                          <div style={styles.spocItem}>
                            👤 {s.spoc_name || "-"} &nbsp;
                            📧 {s.email || "-"} &nbsp;
                            📞 {s.phone || "-"}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editingId === c.id ? cancelEdit() : startEdit(c);
                      }}
                      style={styles.secondaryBtn}
                    >
                      {editingId === c.id ? "Cancel" : "Edit"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(c.id);
                      }}
                      style={styles.dangerBtn}
                    >
                      Delete
                    </button>
                  </div>
                  </div>

                  {/* EDIT SECTION */}
                  {editingId === c.id && (
                    <div
                      onClick={(e) => e.stopPropagation()} // 🚨 THIS FIXES YOUR ISSUE
                      style={{
                        marginTop: 10,
                        display: "grid",
                        gap: 10,
                        padding: 12,
                        border: "1px dashed #cbd5f5",
                        borderRadius: 8,
                        background: "#fafbff",
                      }}
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={styles.input}
                      />

                      {editSpocs.map((s, i) => (
                        <div key={i} style={styles.spocRow}>
                          <input
                            value={s.spoc_name}
                            onChange={(e) =>
                              updateEditSpoc(i, "spoc_name", e.target.value)
                            }
                            placeholder="Name"
                            style={styles.input}
                          />
                          <input
                            value={s.email}
                            onChange={(e) =>
                              updateEditSpoc(i, "email", e.target.value)
                            }
                            placeholder="Email"
                            style={styles.input}
                          />
                          <input
                            value={s.phone}
                            onChange={(e) =>
                              updateEditSpoc(i, "phone", e.target.value)
                            }
                            placeholder="Phone"
                            style={styles.input}
                          />
                        </div>
                      ))}

                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={addEditSpoc} style={styles.secondaryBtn}>
                          + Add SPOC
                        </button>

                        <button
                          onClick={() => saveEdit(c.id)}
                          style={styles.primaryBtn}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
      {showCreateModal && (
        <div style={modal.overlay}>
          <div style={{ ...modal.box, width: 600 }}>
            <h3 style={{ marginBottom: 10 }}>Create Client</h3>

            <form onSubmit={(e) => {
              handleCreate(e);
              setShowCreateModal(false);
            }} style={{ display: "grid", gap: 10 }}>

              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
                style={styles.input}
              />

              {spocs.map((s, i) => (
                <div key={i} style={styles.spocRow}>
                  <input
                    placeholder="SPOC name"
                    value={s.spoc_name}
                    onChange={(e) => updateSpoc(i, "spoc_name", e.target.value)}
                    style={styles.input}
                  />
                  <input
                    placeholder="Email"
                    value={s.email}
                    onChange={(e) => updateSpoc(i, "email", e.target.value)}
                    style={styles.input}
                  />
                  <input
                    placeholder="Phone"
                    value={s.phone}
                    onChange={(e) => updateSpoc(i, "phone", e.target.value)}
                    style={styles.input}
                  />
                </div>
              ))}

              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={addSpoc} style={styles.secondaryBtn}>
                  + Add SPOC
                </button>

                <button type="submit" style={styles.primaryBtn}>
                  Create
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={styles.secondaryBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: 800 },
  subtitle: { fontSize: 12, color: "#64748b" },

  card: {
    background: "white",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #e2e8f0",
  },

  cardTitle: {
    fontWeight: 700,
    marginBottom: 8,
  },

  input: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    width: "100%",
  },

  search: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    width: "100%",
  },

  row: {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },

  clientName: { fontWeight: 700 },

  spocList: {
    marginTop: 6,
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  spocItem: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 6,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },

  spocRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },

  primaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "#111827",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  },

  secondaryBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
  },

  empty: {
    padding: 12,
    textAlign: "center",
    color: "#64748b",
  },

  dangerBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#374151",
    cursor: "pointer",
  }
};

const modal = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  box: {
    background: "white",
    padding: 20,
    borderRadius: 12,
    maxHeight: "80vh",
    overflowY: "auto",
  },
};