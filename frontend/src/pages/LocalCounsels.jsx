import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listLocalCounsels, approveLocalCounsel } from "../services/api";

export default function LocalCounsels() {
  const navigate = useNavigate();
  const [counsels, setCounsels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const res = await listLocalCounsels();
      setCounsels(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      alert("Failed to load counsels");
    } finally {
      setLoading(false);
    }
  }

  async function approveCounsel(id) {
    try {
      await approveLocalCounsel(id);
      alert("Counsel approved");
      load();
    } catch (err) {
      alert(err.message || "Approval failed");
    }
  }

  return (
    <div style={{ padding: 40, background: "#f3f4f6", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
        <h2>Local Counsels</h2>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/admin/local-counsels/create")}
            style={styles.primaryBtn}
          >
            + Add Counsel
          </button>

          <button
            onClick={() => navigate("/admin")}
            style={styles.secondaryBtn}
          >
            Dashboard
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["all", "gnp", "location", "pending"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.secondaryBtn,
              background: filter === f ? "#111827" : "white",
              color: filter === f ? "white" : "#111827"
            }}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* TABLE */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table width="100%" cellPadding="10">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>City</th>
                <th>Bar Reg.</th>
                <th>PAN</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {counsels
                .filter((c) => {
                  if (filter === "all") return true;
                  if (filter === "pending") return !c.is_approved;
                  return c.type === filter;
                })
                .map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.name}</td>

                  {/* ✅ TYPE */}
                  <td>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background:
                        c.type === "gnp"
                          ? "#dbeafe"
                          : "#ecfdf5",
                      color:
                        c.type === "gnp"
                          ? "#1e40af"
                          : "#065f46",
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {c.type === "gnp" ? "GNP Counsel" : "Location Counsel"}
                    </span>
                  </td>

                  {/* ✅ STATUS */}
                  <td>
                    <span style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      background:
                        c.is_approved
                          ? "#dcfce7"
                          : "#fef3c7",
                      color:
                        c.is_approved
                          ? "#166534"
                          : "#92400e",
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      {c.is_approved ? "Approved" : "Pending"}
                    </span>
                  </td>

                  <td>{c.phone || "-"}</td>
                  <td>{c.email || "-"}</td>
                  <td>{c.city || "-"}</td>
                  <td>{c.bar_registration_no || "-"}</td>
                  <td>{c.pan_no || "-"}</td>

                  {/* ✅ ACTION */}
                  <td style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => navigate(`/admin/local-counsels/${c.id}/edit`)}
                      style={styles.secondaryBtn}
                    >
                      Edit
                    </button>

                    {!c.is_approved && (
                      <button
                        onClick={() => approveCounsel(c.id)}
                        style={{
                          ...styles.primaryBtn,
                          background: "#16a34a"
                        }}
                      >
                        Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {counsels.length === 0 && (
            <div style={{ marginTop: 20 }}>No counsels found.</div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  primaryBtn: {
    padding: "10px 20px",
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  secondaryBtn: {
    padding: "8px 16px",
    background: "white",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
};