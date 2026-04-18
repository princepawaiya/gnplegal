import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CounselProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  return (
    <div style={styles.wrapper} ref={ref}>
      
      {/* Avatar Button */}
      <div style={styles.avatar} onClick={() => setOpen(!open)}>
        {getInitials(user?.full_name)}
      </div>

      {/* Dropdown */}
      {open && (
        <div style={styles.dropdown}>
          
          {/* User Info */}
          <div style={styles.userBox}>
            <div style={styles.name}>
              {user?.full_name || "User"}
            </div>
            <div style={styles.email}>
              {user?.email || ""}
            </div>
          </div>

          <div style={styles.divider} />

          {/* Actions */}
          <div
            style={styles.item}
            onClick={() => {
              setOpen(false);
              navigate("/lawyer/gnp/settings");
            }}
          >
            ⚙️ Settings
          </div>

          <div
            style={styles.item}
            onClick={() => {
              setOpen(false);
              navigate("/lawyer/gnp/profile");
            }}
          >
            👤 Profile
          </div>

          <div style={styles.divider} />

          <div style={styles.logout} onClick={handleLogout}>
            🚪 Logout
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= HELPERS ================= */

function getInitials(name = "") {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ================= STYLES ================= */

const styles = {
  wrapper: {
    position: "relative",
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#2563eb",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  dropdown: {
    position: "absolute",
    top: 46,
    right: 0,
    width: 220,
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    zIndex: 100,
  },

  userBox: {
    padding: 12,
  },

  name: {
    fontSize: 14,
    fontWeight: 600,
    color: "#0f172a",
  },

  email: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  divider: {
    height: 1,
    background: "#f1f5f9",
  },

  item: {
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    color: "#334155",
  },

  logout: {
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    color: "#dc2626",
    fontWeight: 600,
  },
};