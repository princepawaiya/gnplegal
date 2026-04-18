import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  listClients,
  listForums,
  getMatterById,
  updateMatter,
  createMatter,
} from "../services/api";

export default function EditMatter() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [forums, setForums] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    client_id: "",
    matter_name: "",
    product: "",
    allocation_date: "",
    case_no: "",
    dc_sc_no: "",
    forum_id: "",
    summary: "",
    claim_amount: "",
    current_status: "Pending",
    ldoh: "",
    ndoh: "",
    comments: "",
    pleadings_status: "Pending",
  });

useEffect(() => {
  async function load() {
    try {
      const [clientData, forumData, matterData] = await Promise.all([
        listClients(),
        listForums(),
        isNew ? Promise.resolve(null) : getMatterById(id),
      ]);

      setClients(clientData);
      setForums(forumData);

      if (!isNew && matterData) {
        setForm({
          ...matterData,
          product: matterData.product || "",
          allocation_date: matterData.allocation_date?.slice(0, 10) || "",
          ldoh: matterData.ldoh?.slice(0, 10) || "",
          ndoh: matterData.ndoh?.slice(0, 10) || "",
          claim_amount: matterData.claim_amount ?? "",
        });
      }

    } catch (e) {
      alert("Failed to load matter");
      navigate("/matters");
    } finally {
      setLoading(false);
    }
  }

  load();
}, [id, navigate]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit() {
    try {
      const cleanData = {
        ...form,
        client_id: Number(form.client_id),
        forum_id: Number(form.forum_id),
        allocation_date: form.allocation_date || null,
        ldoh: form.ldoh || null,
        ndoh: form.ndoh || null,
        claim_amount: form.claim_amount
          ? Number(form.claim_amount)
          : null,
      };

      if (isNew) {
        // 👉 call create API (IMPORTANT)
        await createMatter(cleanData);
      } else {
        await updateMatter(id, cleanData);
      }

      alert("Matter updated successfully");
      navigate("/matters");
    } catch (e) {
      alert(e.message);
    }
  }

  if (loading) return <p style={{ padding: 40 }}>Loading...</p>;

  return (
  <div style={styles.wrapper}>
    <div style={styles.container}>

      {/* HEADER */}
      <div style={styles.headerCard}>
        <div>
          <div style={styles.title}>Edit Matter</div>
          <div style={styles.sub}>Update case details</div>
        </div>

        <button
          onClick={() => navigate("/matters")}
          style={styles.secondaryBtn}
        >
          Cancel
        </button>
      </div>

      {/* FORM */}
      <div style={styles.card}>

        <Section title="Basic Information">
          <div style={styles.grid2}>
            <Field label="Client">
              <select name="client_id" value={form.client_id} onChange={handleChange} style={styles.input}>
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Matter Name">
              <input name="matter_name" value={form.matter_name} onChange={handleChange} style={styles.input}/>
            </Field>

            <Field label="Product">
              <input name="product" value={form.product} onChange={handleChange} style={styles.input}/>
            </Field>

            <Field label="Case Number">
              <input name="case_no" value={form.case_no} onChange={handleChange} style={styles.input}/>
            </Field>

            <Field label="Forum">
              <select name="forum_id" value={form.forum_id} onChange={handleChange} style={styles.input}>
                <option value="">Select Forum</option>
                {forums.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Dates & Status">
          <div style={styles.grid3}>
            <Field label="Allocation Date">
              <input type="date" name="allocation_date" value={form.allocation_date} onChange={handleChange} style={styles.input}/>
            </Field>

            <Field label="LDOH">
              <input type="date" name="ldoh" value={form.ldoh} onChange={handleChange} style={styles.input}/>
            </Field>

            <Field label="NDOH">
              <input type="date" name="ndoh" value={form.ndoh} onChange={handleChange} style={styles.input}/>
            </Field>
          </div>

          <div style={styles.grid2}>
            <Field label="Status">
              <select name="current_status" value={form.current_status} onChange={handleChange} style={styles.input}>
                <option value="Pending">Pending</option>
                <option value="Disposed">Disposed</option>
                <option value="Allowed">Allowed</option>
                <option value="Dismissed">Dismissed</option>
              </select>
            </Field>

            <Field label="Pleadings">
              <select name="pleadings_status" value={form.pleadings_status} onChange={handleChange} style={styles.input}>
                <option value="Pending">Pending</option>
                <option value="Evidence Filed">Evidence Filed</option>
                <option value="WA Filed">WA Filed</option>
                <option value="Evidence & WA Filed">Evidence & WA Filed</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Financial">
          <Field label="Claim Amount">
            <input name="claim_amount" value={form.claim_amount} onChange={handleChange} style={styles.input}/>
          </Field>
        </Section>

        <Section title="Details">
          <Field label="Summary">
            <textarea name="summary" value={form.summary} onChange={handleChange} style={styles.textarea}/>
          </Field>

          <Field label="Comments">
            <textarea name="comments" value={form.comments} onChange={handleChange} style={styles.textarea}/>
          </Field>
        </Section>

        <div style={styles.actionRow}>
          <button onClick={handleSubmit} style={styles.primaryBtn}>
            Save Changes
          </button>
        </div>

      </div>
    </div>
  </div>
);
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  wrapper: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: 24,
  },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },

  headerCard: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 18,
    fontWeight: 800,
  },

  sub: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },

  card: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 20,
  },

  section: {
    marginBottom: 28,
    display: "grid",
    gap: 14,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },

  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
  },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
  },

  textarea: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    minHeight: 100,
  },

  actionRow: {
    marginTop: 10,
  },

  primaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    background: "#1d4ed8",
    color: "white",
    border: "none",
    fontWeight: 700,
  },

  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
  },
};