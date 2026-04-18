import { useEffect, useState } from "react";
import { listPermissions } from "../services/api";
import { hasPermission } from "../utils/permissions";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Roles() {
  const token = localStorage.getItem("token");

  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const canManage = hasPermission("users:manage");
  const [editingRoleId, setEditingRoleId] = useState(null);

  if (!canManage) {
    return (
      <div style={{ padding: 40 }}>
        <h2>🔒 Access Restricted</h2>
        <p>You do not have permission to manage roles.</p>
      </div>
    );
  }

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

async function fetchPermissions() {
  try {
    const data = await listPermissions();
    setPermissionGroups(Array.isArray(data) ? data : []);
  } catch {
    setPermissionGroups([]);
  }
}

  async function fetchRoles() {
    const res = await fetch(`${API_BASE}/roles/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to fetch roles");

    const data = await res.json();
    setRoles(Array.isArray(data) ? data : data?.items || data?.data || []);
  }

  function togglePermission(p) {
    setSelectedPermissions((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : [...prev, p]
    );
  }

  function toggleGroup(items) {
  const codes = items.map((p) => p.code);

  const allSelected = codes.every((p) =>
    selectedPermissions.includes(p)
  );

  if (allSelected) {
    setSelectedPermissions((prev) =>
      prev.filter((p) => !codes.includes(p))
    );
  } else {
    setSelectedPermissions((prev) => [
      ...new Set([...prev, ...codes]),
    ]);
  }
}

  function selectAll() {
  const all = permissionGroups.flatMap((g) => g.items.map(p => p.code));
  setSelectedPermissions(all);
}

  function clearAll() {
    setSelectedPermissions([]);
  }

  function editRole(role) {
    setName(role.name);
    setSelectedPermissions(role.permissions || []);
    setEditingRoleId(role.id); // ✅ REQUIRED
    setOpen(true);
  }

  async function createRole() {
  try {
    const url = editingRoleId
      ? `${API_BASE}/roles/${editingRoleId}/update`
      : `${API_BASE}/roles/create`;

    const method = editingRoleId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        permissions: selectedPermissions,
      }),
    });

    if (!res.ok) throw new Error();

    alert(editingRoleId ? "Role updated" : "Role created");

    setName("");
    setSelectedPermissions([]);
    setEditingRoleId(null);
    setOpen(false);

    fetchRoles();
  } catch {
    alert("Failed");
  }
}

  return (
    <div style={styles.wrapper}>
      {/* HEADER */}
      <div style={styles.header}>
        <h2>Roles & Permissions</h2>

        <button style={styles.primaryBtn} onClick={() => setOpen(true)}>
          + Create Role
        </button>
      </div>

      {/* ROLE LIST */}
      <div style={styles.card}>
        {roles.map((r) => (
          <div key={r.id} style={styles.roleCard}>
            <div style={styles.roleHeader}>
              <div style={styles.roleName}>{r.name}</div>
              <div style={styles.roleMeta}>
                {r.permissions?.length || 0} permissions
              </div>
            </div>
            <button style={styles.editBtn} onClick={() => editRole(r)}>
              ✏️ Edit
            </button>

            <div style={styles.permissionWrap}>
              {(r.permissions || []).slice(0, 6).map((p, i) => (
                <span key={i} style={styles.permissionChip}>
                  {p}
                </span>
              ))}

              {(r.permissions || []).length > 6 && (
                <span style={styles.moreChip}>
                  +{r.permissions.length - 6}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {open && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>{editingRoleId ? "Edit Role" : "Create New Role"}</h3>

            <input
              placeholder="Role name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.input}
            />

            <div style={styles.topBar}>
              <span>{selectedPermissions.length} selected</span>

              <div>
                <button onClick={selectAll}>Select All</button>
                <button onClick={clearAll}>Clear</button>
              </div>
            </div>

            <div style={styles.permissionBox}>
              {permissionGroups.map((group) => {
                const allSelected = group.items.every((p) =>
                  selectedPermissions.includes(p.code)
                );

                return (
                  <div key={group.group} style={styles.group}>
                    <div style={styles.groupHeader}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => toggleGroup(group.items)}
                      />
                      <span>{group.group}</span>
                    </div>

                    <div style={styles.grid}>
                      {group.items.map((p) => (
                        <label key={p.code}>
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(p.code)}
                            onChange={() => togglePermission(p.code)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.footer}>
              <button
                onClick={() => {
                  setOpen(false);
                  setEditingRoleId(null);
                  setName("");
                  setSelectedPermissions([]);
                }}
              >
                Cancel
              </button>
              <button style={styles.primaryBtn} onClick={createRole}>
                {editingRoleId ? "Update Role" : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  wrapper: { padding: 20 },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
  },

  roleRow: {
    padding: 12,
    borderBottom: "1px solid #f1f5f9",
  },

  roleName: { fontWeight: 700 },

  permissionWrap: {
    marginTop: 6,
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  permissionChip: {
    fontSize: 11,
    padding: "4px 6px",
    background: "#eef2ff",
    borderRadius: 6,
  },

  moreChip: {
    fontSize: 11,
    padding: "4px 6px",
    background: "#f3f4f6",
    borderRadius: 6,
  },

  primaryBtn: {
    background: "#111827",
    color: "white",
    padding: "8px 12px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  modal: {
    width: 520,
    background: "white",
    borderRadius: 12,
    padding: 20,
  },

  input: {
    width: "100%",
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    marginBottom: 10,
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  permissionBox: {
    maxHeight: 320,
    overflow: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 10,
  },

  group: { marginBottom: 12 },

  groupHeader: {
    display: "flex",
    gap: 8,
    fontWeight: 600,
    marginBottom: 6,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },

  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },

  roleCard: {
    padding: 14,
    borderBottom: "1px solid #f1f5f9",
  },

  roleHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  roleMeta: {
    fontSize: 12,
    color: "#6b7280",
  },
  
  editBtn: {
    marginTop: 6,
    fontSize: 12,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: "pointer",
  },
};