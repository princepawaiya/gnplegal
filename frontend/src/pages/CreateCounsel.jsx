import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  createLocalCounsel,
  getCounselById,
  updateLocalCounsel,
} from "../services/api";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Textarea from "../components/ui/Textarea";

export default function CreateCounsel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const params = new URLSearchParams(location.search);
  const cityFromQuery = params.get("city");   // ✅ FIX
  const returnTo = params.get("returnTo");

  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: cityFromQuery || "",   // safe now
    postal_address: "",
    type: "location",
    upi_details: "",
    bar_registration_no: "",
    pan_no: "",
    reference: "",
  });
  const user = JSON.parse(atob(localStorage.getItem("token").split(".")[1]));

  const basePath =
    user.role === "admin"
      ? "/admin"
      : user.role === "lawyer"
      ? "/lawyer"
      : "/client";

// 🔹 1. Set city from query
useEffect(() => {
  if (!isEditMode && cityFromQuery) {
    setForm((prev) => ({ ...prev, city: cityFromQuery }));
  }
}, [cityFromQuery, isEditMode]);

// 🔹 2. Load counsel in edit mode
useEffect(() => {
  if (!isEditMode) return;

  async function loadCounsel() {
    try {
      const data = await getCounselById(id);

      setForm({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        city: data.city || "",
        postal_address: data.postal_address || "",
        type: data.type || "location",
        upi_details: data.upi_details || "",
        bar_registration_no: data.bar_registration_no || "",
        pan_no: data.pan_no || "",
        reference: data.reference || "",
      });
    } catch {
      alert("Failed to load counsel");
    }
  }

  loadCounsel();
}, [id, isEditMode]);

  async function handleSubmit() {
    if (!form.name.trim() || !form.phone.trim() || !form.city.trim()) {
      alert("Name, Phone and City are mandatory");
      return;
    }

    try {
      setSubmitting(true);

      let result;

      if (isEditMode) {
        result = await updateLocalCounsel(id, form);
        alert("Counsel updated successfully");
      } else {
        result = await createLocalCounsel(form);

        if (result?.message === "Counsel already exists") {
          alert("✅ Counsel already exists → Assigned successfully");
        } else {
          alert("Counsel created successfully");
        }
      }

      if (returnTo) {
        navigate(`${basePath}/matters/${returnTo}`);
      } else {
        navigate("/admin/local-counsels");
      }
    } catch (err) {
      alert(err.message || "Failed to save counsel");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    if (returnTo) {
      navigate(`${basePath}/matters/${returnTo}`);
    } else {
      navigate("/admin/local-counsels");
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>

        {/* HEADER CARD */}
        <div style={styles.headerCard}>
          <div>
            <div style={styles.hTitle}>
              {isEditMode ? "Edit Local Counsel" : "Add Local Counsel"}
            </div>
            <div style={styles.hSub}>
              Jurisdiction:{" "}
              <span style={{ fontWeight: 700 }}>
                {form.city || "—"}
              </span>
            </div>
          </div>

          <button onClick={handleCancel} style={styles.secondaryBtn}>
            Cancel
          </button>
        </div>

        {/* FORM CARD */}
        <div style={styles.card}>

          {/* BASIC INFO */}
          <Section title="Basic Information">
            <div style={styles.grid2}>
              <Field label="Full Name *">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <Field label="Counsel Type">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  style={styles.input}
                >
                  <option value="location">Location Counsel</option>
                  <option value="gnp">GNP Counsel</option>
                </select>
              </Field>

              <Field label="Mobile No. *">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>

              <Field label="Email">
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>

              <Field label="City *">
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
            </div>
          </Section>

          {/* PROFESSIONAL */}
          <Section title="Professional Details">
            <div style={styles.grid2}>
              <Field label="Bar Registration No.">
                <Input
                  value={form.bar_registration_no}
                  onChange={(e) =>
                    setForm({ ...form, bar_registration_no: e.target.value })
                  }
                />
              </Field>

              <Field label="PAN No.">
                <Input
                  value={form.pan_no}
                  onChange={(e) =>
                    setForm({ ...form, pan_no: e.target.value.toUpperCase() })
                  }
                />
              </Field>

              <Field label="UPI / Bank Details">
                <Input
                  value={form.upi_details}
                  onChange={(e) =>
                    setForm({ ...form, upi_details: e.target.value })
                  }
                />
              </Field>

              <Field label="Reference">
                <Input
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                />
              </Field>
            </div>
          </Section>

          {/* ADDRESS */}
          <Section title="Postal Address">
            <Textarea
              value={form.postal_address}
              onChange={(e) =>
                setForm({ ...form, postal_address: e.target.value })
              }
            />
          </Section>

          {/* ACTIONS */}
          <div style={styles.actionRow}>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ opacity: submitting ? 0.6 : 1 }}
            >
              {submitting
                ? "Saving..."
                : isEditMode
                  ? "Update Counsel"
                  : "Create Counsel"}
            </Button>

            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ---------- REUSABLE ---------- */

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

/* ---------- STYLES ---------- */

const styles = {
  wrapper: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: 24
  },

  container: {
    maxWidth: 900,
    margin: "40px auto",   // ✅ better vertical spacing
    display: "grid",
    gap: 16
  },

  headerCard: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.04)", // ✅ subtle elevation
  },

  hTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
  },

  hSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },

  card: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },

  section: {
    marginBottom: 28,
    display: "grid",
    gap: 14
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 6,
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b"
  },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    outline: "none",
    transition: "all 0.2s ease",
  },

  textarea: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    minHeight: 100,
    fontSize: 14
  },

  actionRow: {
    display: "flex",
    gap: 12,
    marginTop: 10
  },

  primaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 600,
    cursor: "pointer"
  }
};