import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL;

const FIELD_GROUPS = [
  {
    title: "System",
    fields: [
      { key: "id", label: "ID" },
      { key: "internal_case_no", label: "Internal Case No." },
    ],
  },
  {
    title: "Case Details",
    fields: [
      { key: "sr_no", label: "Sr. No." },
      { key: "client", label: "Client" },
      { key: "matter_name", label: "Matter Name" },
      { key: "case_no", label: "Case No." },
      { key: "status", label: "Status" },
      { key: "stage", label: "Stage" },
      { key: "disposed", label: "Disposed" },
      { key: "outcome", label: "Outcome" },
    ],
  },
  {
    title: "Financial",
    fields: [
      { key: "claim_amount", label: "Claim Amount" },
      { key: "claim_bucket", label: "Claim Bucket" },
    ],
  },
  {
    title: "Location",
    fields: [
      { key: "state", label: "State" },
      { key: "district", label: "District" },
      { key: "forum", label: "Forum" },
    ],
  },
  {
    title: "Assignment",
    fields: [
      { key: "product", label: "Product" },
      { key: "counsel", label: "Counsel" },
    ],
  },
  {
    title: "Dates",
    fields: [
      { key: "allocation_date", label: "Allocation Date" },
      { key: "ldoh", label: "LDOH" },
      { key: "ndoh", label: "NDOH" },
    ],
  },
];

export default function MISBuilder() {
  const navigate = useNavigate();

  const allFieldKeys = useMemo(() => {
    return FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.key));
  }, []);

  const [selectedFields, setSelectedFields] = useState(() => {
    const saved = localStorage.getItem("mis_selected_fields");
    return saved ? JSON.parse(saved) : allFieldKeys;
  });

  useEffect(() => {
    async function loadConfig() {
        try {
        const token = localStorage.getItem("token");

        const res = await fetch(`${API_BASE}/mis-dashboard/config`, {
            headers: {
            Authorization: "Bearer " + token,
            },
        });

        const data = await res.json();

        if (data.selected_fields && data.selected_fields.length > 0) {
            setSelectedFields(data.selected_fields);
            localStorage.setItem(
            "mis_selected_fields",
            JSON.stringify(data.selected_fields)
            );
        }
        } catch (err) {
        console.error("Failed to load MIS config", err);
        }
    }

    loadConfig();
    }, []);

  function toggleField(key) {
    setSelectedFields((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  }

  function moveUp(index) {
    if (index === 0) return;

    const newFields = [...selectedFields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];

    setSelectedFields(newFields);
    }

    function moveDown(index) {
    if (index === selectedFields.length - 1) return;

    const newFields = [...selectedFields];
    [newFields[index + 1], newFields[index]] = [newFields[index], newFields[index + 1]];

    setSelectedFields(newFields);
    }

  function isGroupChecked(group) {
    return group.fields.every((field) => selectedFields.includes(field.key));
  }

  function toggleGroup(group) {
    const groupKeys = group.fields.map((field) => field.key);
    const allSelected = groupKeys.every((key) => selectedFields.includes(key));

    if (allSelected) {
      setSelectedFields((prev) => prev.filter((key) => !groupKeys.includes(key)));
    } else {
      setSelectedFields((prev) => Array.from(new Set([...prev, ...groupKeys])));
    }
  }

  function selectAll() {
    setSelectedFields(allFieldKeys);
  }

  function deselectAll() {
    setSelectedFields([]);
  }

  async function handleSave() {
    try {
        localStorage.setItem("mis_selected_fields", JSON.stringify(selectedFields));

        const token = localStorage.getItem("token");

        await fetch(`${API_BASE}/mis-dashboard/config`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Bearer " + token,
        },
        body: new URLSearchParams({
            selected_fields: selectedFields.join(","),
        }),
        });

        navigate("/admin/mis");
    } catch (err) {
        console.error("Failed to save MIS config", err);
        alert("Failed to save MIS configuration");
    }
    }

  return (
    <div style={styles.wrapper}>
      <div style={styles.title}>Customize MIS Report</div>

      <div style={styles.topActions}>
        <button style={styles.secondaryBtn} onClick={selectAll}>
          Select All
        </button>
        <button style={styles.secondaryBtn} onClick={deselectAll}>
          Deselect All
        </button>
      </div>

      <div style={styles.grid}>
        {FIELD_GROUPS.map((group) => {
          const selectedCount = group.fields.filter((field) =>
            selectedFields.includes(field.key)
          ).length;

          return (
            <div key={group.title} style={styles.card}>
              <div style={styles.cardHeader}>
                <label style={styles.groupLabel}>
                  <input
                    type="checkbox"
                    checked={isGroupChecked(group)}
                    onChange={() => toggleGroup(group)}
                  />
                  <span style={styles.groupTitle}>{group.title}</span>
                </label>

                <div style={styles.countBadge}>
                  {selectedCount}/{group.fields.length}
                </div>
              </div>

              <div style={styles.itemsGrid}>
                {group.fields.map((field) => (
                  <label key={field.key} style={styles.itemLabel}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.orderSection}>
        <div style={styles.sectionTitle}>Column Order</div>

        {selectedFields.map((field, index) => (
            <div key={field} style={styles.orderRow}>
            <span>{field}</span>

            <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => moveUp(index)}>⬆</button>
                <button onClick={() => moveDown(index)}>⬇</button>
            </div>
            </div>
        ))}
        </div>

      <div style={styles.footer}>
        <button style={styles.primaryBtn} onClick={handleSave}>
          Save
        </button>

        <button style={styles.secondaryBtn} onClick={() => navigate("/admin/mis")}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    padding: 24,
    display: "grid",
    gap: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "#1e293b",
  },

  topActions: {
    display: "flex",
    gap: 12,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
    gap: 20,
  },

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 20,
    display: "grid",
    gap: 18,
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  groupLabel: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 16,
    fontWeight: 700,
    color: "#1e293b",
  },

  groupTitle: {
    fontSize: 16,
    fontWeight: 700,
  },

  countBadge: {
    background: "#f1f5f9",
    padding: "6px 10px",
    borderRadius: 10,
    fontSize: 14,
    color: "#64748b",
    fontWeight: 700,
  },

  itemsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  itemLabel: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#334155",
  },

  footer: {
    display: "flex",
    gap: 12,
  },

  primaryBtn: {
    padding: "10px 18px",
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "10px 18px",
    background: "#f8fafc",
    color: "#1e293b",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    fontWeight: 600,
    cursor: "pointer",
  },

  orderSection: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    display: "grid",
    gap: 10,
    },

    orderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    },
};