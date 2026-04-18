import { useEffect, useMemo, useState } from "react";
import KnowledgeSection from "../components/dashboard/KnowledgeSection";
import UploadJudgements from "../components/knowledge/UploadJudgements";
import UploadTemplates from "../components/knowledge/UploadTemplates";

const API_BASE = import.meta.env.VITE_API_URL;

export default function GNPCounselKnowledgeHub() {
  const [bareActs, setBareActs] = useState([]);
  const [judgements, setJudgements] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function fetchCategory(category) {
    const res = await fetch(`${API_BASE}/knowledge?category=${category}`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  }

  async function loadAll() {
    try {
      setLoading(true);

      const [acts, judgementsData, templatesData] = await Promise.all([
        fetchCategory("bare_act"),
        fetchCategory("judgement"),
        fetchCategory("template"),
      ]);

      setBareActs(Array.isArray(acts) ? acts : []);
      setJudgements(Array.isArray(judgementsData) ? judgementsData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
    } catch (e) {
      console.error("Failed to load knowledge summary", e);
      setBareActs([]);
      setJudgements([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    return {
      bareActs: bareActs.length,
      judgements: judgements.filter((x) => x.file_url).length,
      templates: templates.length,
      pending: bareActs.filter((x) => !x.file_url).length,
      recent: [...bareActs]
        .filter((x) => x.file_url)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    };
  }, [bareActs, judgements, templates]);

  return (
    <div style={styles.page}>
      <div style={styles.headerBlock}>
        <div>
          <div style={styles.header}>Knowledge Hub</div>
          <div style={styles.subheader}>
            Manage bare acts, judgements, and templates in one place.
          </div>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard title="Bare Acts" value={summary.bareActs} />
        <SummaryCard title="Judgements" value={summary.judgements} />
        <SummaryCard title="Templates" value={summary.templates} />
        <SummaryCard title="Pending Uploads" value={summary.pending} warning />
      </div>

      <div style={styles.recentCard}>
        <div style={styles.sectionTitle}>List of Bare Acts</div>

        {loading ? (
          <div style={styles.empty}>Loading...</div>
        ) : summary.recent.length === 0 ? (
          <div style={styles.empty}>No items</div>
        ) : (
          <div style={styles.recentList}>
            {summary.recent.map((item) => (
              <div key={item.id} style={styles.recentRow}>
                <div style={styles.recentTitle}>{item.title}</div>

                <div style={styles.actionGroup}>
                  <button
                    style={styles.viewBtn}
                    onClick={() => window.open(`${API_BASE}${item.file_url}`, "_blank")}
                  >
                    View
                  </button>

                  <button
                    style={styles.deleteBtn}
                    onClick={async () => {
                      if (!confirm("Delete this item?")) return;

                      await fetch(`${API_BASE}/knowledge/${item.id}`, {
                        method: "DELETE",
                        headers: {
                          Authorization: "Bearer " + localStorage.getItem("token"),
                        },
                      });

                      loadAll();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.stack}>
        <KnowledgeSection
          title="Bare Acts"
          category="bare_act"
          onRefresh={loadAll}
        />

        <div style={styles.section}>
          <div style={styles.sectionTitle}>Upload Judgements</div>
          <div style={styles.sectionSub}>
            Add category, choose sub-category, upload, search, view, and delete judgements.
          </div>

          <UploadJudgements />
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Draft Templates</div>
          <div style={styles.sectionSub}>
            Add category, choose sub-category, upload, search, view, and delete templates.
          </div>

          <UploadTemplates />
        </div>

      </div>
    </div>
  );
}

function SummaryCard({ title, value, warning = false }) {
  return (
    <div
      style={{
        ...styles.summaryCard,
        ...(warning ? styles.summaryCardWarning : {}),
      }}
    >
      <div style={styles.summaryTitle}>{title}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    padding: 20,
    display: "grid",
    gap: 20,
  },

  headerBlock: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  header: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },

  subheader: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
  },

  summaryCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
  },

  summaryCardWarning: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
  },

  summaryTitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },

  summaryValue: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: 800,
    color: "#111827",
  },

  recentCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    display: "grid",
    gap: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#111827",
  },

  recentList: {
    display: "grid",
    gap: 10,
  },

  recentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 12,
    border: "1px solid #f1f5f9",
    borderRadius: 12,
    flexWrap: "wrap",
  },

  recentTitle: {
    fontWeight: 600,
    color: "#111827",
  },

  actionGroup: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  viewBtn: {
    border: "1px solid #cbd5e1",
    background: "white",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  deleteBtn: {
    background: "#ef4444",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    color: "#94a3b8",
    padding: 12,
  },

  stack: {
    display: "grid",
    gap: 20,
  },

  section: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 10,
  },

  sectionSub: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
};