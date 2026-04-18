import { useEffect, useState } from "react";
import { listRoles } from "../services/api";

const ALL_PERMISSIONS = [
  "dashboard",
  "manage_users",
  "view_clients",
  "matters:view",
  "edit_matters",
  "assign_counsel",
  "view_cause_list",
  "view_mis",
  "view_invoices",
  "view_alerts",
];

export default function RoleManagement() {
  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const token = localStorage.getItem("token") || "";

  const [roles, setRoles] = useState([]);
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    fetchRoles();
  }, []);

  async function fetchRoles() {
    try {
      const data = await listRoles();
      setRoles(
        Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.items)
            ? data.items
            : []
        );
    } catch {
      alert("Failed to load roles");
    }
  }

  function togglePermission(p) {
    if (selectedPermissions.includes(p)) {
      setSelectedPermissions(selectedPermissions.filter((x) => x !== p));
    } else {
      setSelectedPermissions([...selectedPermissions, p]);
    }
  }

  async function createRole() {
    try {
      const res = await fetch(`${API_BASE}/roles/create`, {
        method: "POST",
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

      setName("");
      setSelectedPermissions([]);
      fetchRoles();
    } catch {
      alert("Create failed");
    }
  }

  async function updateRole() {
    try {
      const res = await fetch(
        `${API_BASE}/roles/${editingRole.id}/update`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            permissions: selectedPermissions,
          }),
        }
      );

      if (!res.ok) throw new Error();

      setEditingRole(null);
      setName("");
      setSelectedPermissions([]);
      fetchRoles();
    } catch {
      alert("Update failed");
    }
  }

  async function deleteRole(id) {
    const confirmDelete = window.confirm("Delete this role?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/roles/${id}/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error();

      fetchRoles();
    } catch {
      alert("Delete failed");
    }
  }

  function startEdit(role) {
    setEditingRole(role);
    setName(role.name);
    setSelectedPermissions(
    Array.isArray(role.permissions)
        ? role.permissions
        : Object.keys(role.permissions || {}).filter((p) => role.permissions[p])
    );
  }

  function cancelEdit() {
    setEditingRole(null);
    setName("");
    setSelectedPermissions([]);
  }

  return (
    <div style={styles.wrapper}>
      <h2>Role Management</h2>

      {/* CREATE / EDIT */}
      <div style={styles.card}>
        <h3>{editingRole ? "Edit Role" : "Create Role"}</h3>

        <input
          placeholder="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
        />

        <div style={styles.permissionGrid}>
          {ALL_PERMISSIONS.map((p) => (
            <label key={p} style={styles.permissionItem}>
              <input
                type="checkbox"
                checked={selectedPermissions.includes(p)}
                onChange={() => togglePermission(p)}
              />
              {p}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {editingRole ? (
            <>
              <button
                style={styles.primaryBtn}
                onClick={updateRole}
                disabled={!name.trim()}
                >
                Update
              </button>
              <button style={styles.secondaryBtn} onClick={cancelEdit}>
                Cancel
              </button>
            </>
          ) : (
            <button
            style={styles.primaryBtn}
            onClick={createRole}
            disabled={!name.trim()}
            >
              Create
            </button>
          )}
        </div>
      </div>

      {/* ROLE LIST */}
      <div style={styles.card}>
        <h3>All Roles</h3>

        {roles.map((r) => (
          <div key={r.id} style={styles.row}>
            <div>
              <div style={styles.roleName}>{r.name}</div>

              <div style={styles.permissionWrap}>
                {(r.permissions || []).map((p, i) => (
                  <span key={i} style={styles.permissionChip}>
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={styles.secondaryBtn}
                onClick={() => startEdit(r)}
              >
                Edit
              </button>

              <button
                style={styles.deleteBtn}
                onClick={() => deleteRole(r.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  wrapper: { padding: 20 },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    marginBottom: 16,
  },

  input: {
    width: "100%",
    padding: 10,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    marginBottom: 10,
  },

  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 6,
    marginBottom: 10,
  },

  permissionItem: {
    fontSize: 12,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderBottom: "1px solid #f1f5f9",
  },

  roleName: {
    fontWeight: 700,
  },

  permissionWrap: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 6,
  },

  permissionChip: {
    fontSize: 10,
    padding: "4px 6px",
    background: "#eef2ff",
    borderRadius: 6,
  },

  primaryBtn: {
    background: "#1d4ed8",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },

  secondaryBtn: {
    border: "1px solid #e5e7eb",
    padding: "8px 12px",
    borderRadius: 6,
    background: "#f9fafb",
    cursor: "pointer",
  },

  deleteBtn: {
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
};