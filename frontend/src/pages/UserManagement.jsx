import { useEffect, useState } from "react";
import { hasPermission } from "../utils/permissions";
import { listRoles } from "../services/api";
import { assignRole as assignRoleApi } from "../services/api";
import { listAllPermissions, updateUserPermissions } from "../services/api";
import { changeUserPassword } from "../services/api";

function formatPermission(code) {
  if (!code) return "";

  return code
    .replace(":", " ")        // mis:view → mis view
    .replace(/_/g, " ")       // matters:view → view matters
    .split(" ")
    .map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

const RAW_API = import.meta.env.VITE_API_URL;

const API_BASE =
  RAW_API && RAW_API.startsWith("http")
    ? RAW_API
    : "http://localhost:8000";

function buildPermissionMap(user) {
  const role = user.role_permissions || [];
  const userPerms = user.user_permissions || [];

  const map = {};

  role.forEach((p) => {
    map[p] = { code: p, source: "role" };
  });

  userPerms.forEach((p) => {
    map[p] = { code: p, source: "user" };
  });

  return Object.values(map);
}

function getPermissionMeta(code) {
  return {
    icon: "•",
    color: "#6b7280",
    bg: "transparent",
  };
}

export default function UserManagement() {
  const canManageUsers = hasPermission("users:manage");

  if (!canManageUsers) {
    return (
      <div style={{ padding: 40 }}>
        <h2>🔒 Access Restricted</h2>
        <p>You do not have permission to manage users.</p>
      </div>
    );
  }

  const token = localStorage.getItem("token");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionModal, setPermissionModal] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "client",
  });
  const [deletedUsers, setDeletedUsers] = useState([]);
  const [showDeleted, setShowDeleted] = useState(false);

  /* ✅ FIXED: single useEffect */
  useEffect(() => {
    fetchUsers();
    fetchRoles();
    loadPermissions();
  }, []);

  useEffect(() => {
  function handleClickOutside(e) {
    if (!e.target.closest(".permission-dropdown")) {
      setOpenDropdownId(null);
    }
  }

  document.addEventListener("click", handleClickOutside);
  return () => document.removeEventListener("click", handleClickOutside);
}, []);

  async function loadPermissions() {
    try {
      const data = await listAllPermissions();
      setAllPermissions(data);
    } catch {
      console.error("Failed to load permissions");
    }
  }

  /* ================= FETCH ================= */

  async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    const safe =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.items)
        ? data.items
        : [];

    const normalized = safe.map((u) => ({
      ...u,
      role_permissions: Array.isArray(u.role_permissions) ? u.role_permissions : [],
      user_permissions: Array.isArray(u.user_permissions) ? u.user_permissions : [],
    }));

    setUsers(normalized);
  } catch (err) {
    console.error("Failed to load users", err);
    alert("Failed to load users");
  }
}

  async function fetchRoles() {
    try {
      const data = await listRoles();

      console.log("ROLES FROM API:", data);

      setRoles(data || []);
    } catch (e) {
      console.error("Roles load failed", e);
      setRoles([]);
    }
  }

  async function fetchDeletedUsers() {
    try {
      const res = await fetch(`${API_BASE}/auth/users/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setDeletedUsers(data.data || []);
    } catch {
      console.error("Failed to load deleted users");
    }
  }

  /* ================= OLD PROMPT METHOD (UNCHANGED) ================= */

  async function editPermissions(user) {
    const input = prompt(
      "Enter permissions (comma separated)",
      (user.permissions || []).join(",")
    );

    if (!input) return;

    const permissions = input.split(",").map(p => p.trim());

    try {
      await fetch(`${API_BASE}/auth/users/${user.id}/permissions`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ permissions }),
      });

      alert("Permissions updated");
      fetchUsers();
    } catch {
      alert("Failed to update permissions");
    }
  }

  /* ================= NEW MODAL SYSTEM ================= */

  function openPermissionModal(user) {
    setPermissionModal(user);
    setSelectedPermissions(
      [
        ...(user.role_permissions || []),
        ...(user.user_permissions || []),
      ].filter((v, i, arr) => arr.indexOf(v) === i)
    );
  }

  function togglePermission(code) {
    setSelectedPermissions(prev =>
      prev.includes(code)
        ? prev.filter(p => p !== code)
        : [...prev, code]
    );
  }

  async function savePermissions() {
    try {
      await updateUserPermissions(
        permissionModal.id,
        selectedPermissions
      );

      alert("Permissions updated");

      setPermissionModal(null);
      fetchUsers();
    } catch {
      alert("Failed to update permissions");
    }
  }

  /* ================= ACTIONS ================= */

  async function createUser() {
    try {
      const res = await fetch(`${API_BASE}/auth/users/create-user`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(JSON.stringify(err, null, 2));
        return;
      }

      alert("User created");
      setForm({ full_name: "", email: "", password: "", role: "client" });
      fetchUsers();
    } catch {
      alert("Failed to create user");
    }
  }

  async function approveUser(id) {
    try {
      await fetch(`${API_BASE}/auth/users/${id}/approve`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchUsers();
    } catch {
      alert("Approval failed");
    }
  }

  async function deleteUser(id) {
    const confirmDelete = window.confirm(
      "⚠️ Are you sure?\n\nUser will be deactivated.\nYou can restore later."
    );

    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_BASE}/auth/users/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Delete failed");
        return;
      }

      alert("User deleted");
      fetchUsers();
    } catch {
      alert("Delete failed");
    }
  }

  async function handleChangePassword(user) {
    const newPassword = prompt(`Enter new password for ${user.email}`);

    if (!newPassword) return;

    try {
      await changeUserPassword(user.id, newPassword);
      alert("Password updated successfully");
    } catch (e) {
      alert(e.message || "Failed to update password");
    }
  }

  async function assignRole(userId, roleId) {
    try {
      await assignRoleApi(userId, roleId);
      await fetchUsers();
    } catch {
      alert("Role assign failed");
    }
  }

  /* ================= UI ================= */

  return (
    <div style={styles.wrapper}>
      
      {/* HEADER */}
        <div style={styles.headerRow}>
          <h2 style={styles.heading}>User Management</h2>

          <button
            style={styles.primaryBtn}
            onClick={() => setShowCreateModal(true)}
          >
            + Create User
          </button>
        </div>

      <div style={styles.card}>
        <h3>All Users</h3>

        <button onClick={() => {
          setShowDeleted(!showDeleted);
          fetchDeletedUsers();
        }}>
          {showDeleted ? "Hide Deleted Users" : "View Deleted Users"}
        </button>

        {showDeleted && (
          <div style={styles.card}>
            <h3>Deleted Users</h3>

            {deletedUsers.length === 0 ? (
              <p>No deleted users</p>
            ) : (
              deletedUsers.map((u) => (
                <div key={u.id} style={{ marginBottom: 10 }}>
                  {u.full_name} ({u.email})

                  <button
                    onClick={async () => {
                      await fetch(`${API_BASE}/auth/users/${u.id}/restore`, {
                        method: "PUT",
                        headers: { Authorization: `Bearer ${token}` },
                      });

                      alert("User restored");
                      fetchDeletedUsers();
                      fetchUsers();
                    }}
                    style={{ marginLeft: 10 }}
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <div style={styles.filterBar}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </select>

            <input
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <table style={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {users
              .filter((u) => {
                if (filter === "active") return u.is_approved;
                if (filter === "pending") return !u.is_approved;
                return true;
              })
              .filter((u) =>
                u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                u.email?.toLowerCase().includes(search.toLowerCase())
              )
              .map((u) => {
              console.log("USER DATA:", u);

              return (
                <tr
                  key={u.id}
                  style={styles.row}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                >
                  <td>{u.full_name || "-"}</td>
                  <td>{u.email || "-"}</td>

                  <td>
                    <span style={{
                      ...styles.roleBadge,
                      ...(u.role === "admin"
                        ? styles.roleAdmin
                        : u.role === "lawyer"
                        ? styles.roleLawyer
                        : styles.roleClient)
                    }}>
                      {u.role_name || u.role || "-"}
                    </span>
                  </td>

                  <td>
                    <span style={{
                      ...styles.statusBadge,
                      ...(u.is_approved ? styles.statusApproved : styles.statusPending)
                    }}>
                      {u.is_approved ? "Approved" : "Pending"}
                    </span>
                  </td>

                  {/* Permissions moved to modal */}

                  <td>
                    <div style={{ position: "relative" }}>
                      <button
                        style={styles.moreBtn}
                        onClick={() =>
                          setActionMenuId(actionMenuId === u.id ? null : u.id)
                        }
                      >
                        ⋮
                      </button>

                      {actionMenuId === u.id && (
                        <div style={styles.actionMenu}>

                          {!u.is_approved && (
                            <>
                              <div onClick={() => approveUser(u.id)}>✔ Approve</div>
                              <div onClick={() => deleteUser(u.id)}>✖ Decline</div>
                            </>
                          )}

                          <div onClick={() => openPermissionModal(u)}>
                            Edit Permissions
                          </div>

                          <div>
                            <select
                              value={u.role_id ?? ""}
                              onChange={(e) =>
                                assignRole(u.id, Number(e.target.value))
                              }
                            >
                              <option value="">Assign Role</option>
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div onClick={() => handleChangePassword(u)}>
                            Change Password
                          </div>

                          <div onClick={() => deleteUser(u.id)} style={{ color: "red" }}>
                            Delete
                          </div>

                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        
        </table>
        </div>
      </div>

      {/* ✅ MODAL */}
      {permissionModal && (
        <div style={modal.overlay}>
          <div style={modal.box}>
            <h3 style={{ marginBottom: 10 }}>Edit Permissions</h3>

            {/* GLOBAL ACTIONS */}
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() =>
                  setSelectedPermissions(
                    allPermissions.flatMap((g) => g.items.map((i) => i.code))
                  )
                }
              >
                Select All
              </button>

              <button
                onClick={() => setSelectedPermissions([])}
                style={{ marginLeft: 10 }}
              >
                Deselect All
              </button>
            </div>

            {/* ✅ GRID CONTAINER */}
            <div style={styles.permissionContainer}>
              {allPermissions.map((group) => {
                const selectedCount = group.items.filter((i) =>
                  selectedPermissions.includes(i.code)
                ).length;

                const allSelected =
                  group.items.length > 0 && selectedCount === group.items.length;

                return (
                  <div key={group.group} style={styles.permissionCard}>
                    {/* HEADER */}
                    <div style={styles.permissionHeader}>
                      <div style={styles.permissionTitle}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            const groupCodes = group.items.map((i) => i.code);

                            if (allSelected) {
                              setSelectedPermissions((prev) =>
                                prev.filter((p) => !groupCodes.includes(p))
                              );
                            } else {
                              setSelectedPermissions((prev) => [
                                ...new Set([...prev, ...groupCodes]),
                              ]);
                            }
                          }}
                        />
                        <span>{group.group}</span>
                      </div>

                      <span style={styles.count}>
                        {selectedCount}/{group.items.length}
                      </span>
                    </div>

                    {/* CHECKBOX GRID */}
                    <div style={styles.permissionGrid}>
                      {group.items.map((item) => (
                        <label key={item.code} style={styles.permissionItem}>
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(item.code)}
                            onChange={() => {
                              setSelectedPermissions((prev) =>
                                prev.includes(item.code)
                                  ? prev.filter((p) => p !== item.code)
                                  : [...prev, item.code]
                              );
                            }}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ACTIONS */}
            <div style={{ marginTop: 15 }}>
              <button onClick={savePermissions} style={styles.primaryBtn}>
                Save
              </button>
              <button
                onClick={() => setPermissionModal(null)}
                style={{ marginLeft: 10 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateModal && (
        <div style={modal.overlay}>
          <div style={{ ...modal.box, width: 500 }}>
            <h3>Create User</h3>

            <div style={styles.formGrid}>
              <input
                placeholder="Full Name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />

              <input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />

              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="client">Client</option>
                <option value="lawyer">Lawyer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ marginTop: 15 }}>
              <button
                style={styles.primaryBtn}
                onClick={() => {
                  createUser();
                  setShowCreateModal(false);
                }}
              >
                Create
              </button>

              <button
                onClick={() => setShowCreateModal(false)}
                style={{ marginLeft: 10 }}
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

/* ================= STYLES ================= */

const styles = {
  wrapper: {
    padding: 20,
    display: "grid",
    gap: 16,   // ✅ FIX
  },

  heading: { marginBottom: 16 },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    marginBottom: 16,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",   // ✅ FIX
    gap: 12,
  },

  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 8px",
    position: "relative",   // ✅ FIX
  },

  primaryBtn: {
    background: "#1d4ed8",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  approveBtn: {
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  badge: {
    padding: "4px 8px",
    borderRadius: 6,
    background: "#e5e7eb",
    fontSize: 12,
  },

  permissionWrap: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  permissionChip: {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 20,
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 500,
    border: "1px solid #e0e7ff",
  },

  moreChip: {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 20,
    background: "#f3f4f6",
    color: "#6b7280",
    fontWeight: 500,
    border: "1px solid #e5e7eb",
  },

  permissionContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 16,
  },

  permissionCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    background: "#fff",
  },

  permissionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  permissionTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 500,
  },

  count: {
    fontSize: 12,
    color: "#6b7280",
    background: "#f3f4f6",
    padding: "2px 6px",
    borderRadius: 6,
  },

  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  permissionItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
  },

  tooltipWrapper: {
    position: "relative",
    display: "inline-block",
  },

  tooltip: {
    position: "absolute",
    top: "120%",
    left: 0,
    background: "#111827",
    color: "white",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 12,
    minWidth: 160,
    zIndex: 100,
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    opacity: 0,
    transform: "translateY(5px)",
    transition: "all 0.2s ease",
    pointerEvents: "none",
  },

  tooltipWrapperHover: {
    position: "relative",
    display: "inline-block",
  },

  tooltipItem: {
    padding: "4px 0",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },

  emptyText: {
    fontSize: 12,
    color: "#9ca3af",
  },

  permissionGroup: {
    marginBottom: 10,
  },

  permissionSummary: {
    color: "#374151",
  },

  dropdownArrow: {
    fontSize: 10,
    color: "#6b7280",
  },

  permissionRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    fontSize: 13,
    borderRadius: 6,
    cursor: "default",
    transition: "background 0.2s ease",
  },

  icon: {
    fontSize: 14,
    width: 18,
    display: "inline-flex",
    justifyContent: "center",
  },

  permissionRowHover: {
    background: "#f3f4f6",
  },

  permissionGroupTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    position: "sticky",       // ✅ STICKY HEADER
    top: 0,
    background: "white",
    padding: "4px 0",
    zIndex: 1,
  },

  dot: {
    width: 6,
    height: 6,
    background: "#6366f1",
    borderRadius: "50%",
  },

  permissionDropdownWrapper: {
    position: "relative",
    minWidth: 180,
    zIndex: 10,   // ✅ FIX
  },

  permissionDropdownHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 13,
  },

  permissionDropdown: {
    position: "absolute",
    top: "110%",
    left: 0,
    width: "280px",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 1000,

    maxHeight: "260px",     // ✅ controlled scroll
    overflowY: "auto",
  },

  permissionDropdownGroupTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottom: "1px solid #f1f5f9",
  },

  lockedRow: {
    opacity: 0.6,
  },

  lockIcon: {
    fontSize: 12,
    color: "#9ca3af",
  },

  editIcon: {
    fontSize: 12,
    color: "#16a34a",
  },

  declineBtn: {
    background: "#f59e0b",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    marginLeft: 6,
  },

  deleteBtn: {
    background: "#dc2626",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    marginLeft: 6,
  },

  activeText: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: 600,
    marginRight: 6,
  },

  row: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    transition: "all 0.2s ease",
  },

  rowHover: {
    background: "#f9fafb",
  },

  actionBtn: {
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    marginRight: 6,
    marginTop: 4,   // ✅ FIX spacing
  },

  activeBadge: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: 600,
    marginRight: 8,
  },

  /* ROLE BADGES */

  roleBadge: {
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 500,
  },

  /* STATUS BADGES */

  statusBadge: {
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 500,
  },

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
    width: "800px",
    maxHeight: "80vh",     // ✅ FIX
    overflowY: "auto",     // ✅ FIX
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  filterBar: {
    display: "flex",
    gap: 10,
    marginBottom: 10,
  },

  moreBtn: {
    border: "none",
    background: "transparent",
    fontSize: 18,
    cursor: "pointer",
  },

  actionMenu: {
    position: "absolute",
    right: 0,
    top: "100%",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 8,
    display: "grid",
    gap: 6,
    zIndex: 1000,
    minWidth: 160,
  },
};
