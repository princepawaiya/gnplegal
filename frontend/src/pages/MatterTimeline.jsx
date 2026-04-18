import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMatterTimeline } from "../services/api";
import { getUserFromToken, hasPermission } from "../utils/permissions";

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB");
}

function getTypeBadge(type) {
  const map = {
    matter_created: { bg: "#e0f2fe", color: "#075985", label: "Created" },
    ldoh: { bg: "#fef3c7", color: "#92400e", label: "Last Date Of Hearing" },
    ndoh: { bg: "#dcfce7", color: "#166534", label: "Next Date Of Hearing" },
    cause_list_sync: { bg: "#ede9fe", color: "#5b21b6", label: "Tracker Sync" },
    purpose_update: { bg: "#fce7f3", color: "#9d174d", label: "Purpose" },
    lawyer_update: { bg: "#f3f4f6", color: "#374151", label: "Lawyer" },
    counsel_assignment: { bg: "#dbeafe", color: "#1d4ed8", label: "Counsel" },
    internal_counsel_assignment: { bg: "#dbeafe", color: "#1d4ed8", label: "Counsel" },
    document_upload: { bg: "#ecfccb", color: "#3f6212", label: "Document" },
    stage_snapshot: { bg: "#fee2e2", color: "#991b1b", label: "Stage" },
    status_snapshot: { bg: "#f3e8ff", color: "#7e22ce", label: "Status" },
  };

  return map[type] || { bg: "#e5e7eb", color: "#374151", label: type };
}

export default function MatterTimeline() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!hasPermission("matters:view")) {
    return <div style={{ padding: 20 }}>Access Denied</div>;
  }

  const user = getUserFromToken();
  const role = user?.role || "client";

  const basePath =
    role === "admin"
      ? "/admin"
      : role === "lawyer"
      ? "/lawyer"
      : "/client";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getMatterTimeline(id);
        setData(result);
      } catch (e) {
        setError(e.message || "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Litigation Timeline</div>
          <div style={styles.subTitle}>
            {data?.matter_name || "Matter"} • {data?.case_no || "-"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={styles.secondaryBtn}
            onClick={() => navigate(`${basePath}/matters/${id}`)}
          >
            ← Matter Details
          </button>

          <button
            style={styles.secondaryBtn}
            onClick={() => navigate(`${basePath}/matters`)}
          >
            All Matters
          </button>
        </div>
      </div>

      {loading ? (
        <div style={styles.emptyCard}>Loading timeline...</div>
      ) : error ? (
        <div style={styles.emptyCard}>{error}</div>
      ) : !data?.timeline?.length ? (
        <div style={styles.emptyCard}>
        No updates yet. Your case activity will appear here as it progresses.
        </div>
      ) : (
        <div style={styles.timeline}>
          {data.timeline.map((item, index) => {
            if (!item) return null;
            const badge = getTypeBadge(item.type);

            return (
              <div key={index} style={styles.timelineRow}>
                <div style={styles.leftRail}>
                  <div style={styles.dot} />
                  {index !== data.timeline.length - 1 && (
                    <div style={styles.line} />
                  )}
                </div>

                <div style={styles.eventCard}>
                  <div style={styles.eventTop}>
                    <span
                      style={{
                        ...styles.badge,
                        background: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>

                    <div style={styles.eventDate}>
                      {formatDateTime(item.event_date)}
                    </div>
                  </div>

                  <div style={styles.eventTitle}>{item.title}</div>
                  <div style={styles.eventDesc}>{item.description}</div>

                  {item.meta && Object.keys(item.meta).length > 0 && (
                    <div style={styles.metaGrid}>
                      {Object.entries(item.meta).map(([key, value]) => {
                        if (!value) return null;

                        if (key === "file_url") {
                          return (
                            <div key={key} style={styles.metaItem}>
                              <div style={styles.metaKey}>{key}</div>
                              <a
                                href={value}
                                target="_blank"
                                rel="noreferrer"
                                style={styles.link}
                              >
                                Open file
                              </a>
                            </div>
                          );
                        }

                        return (
                          <div key={key} style={styles.metaItem}>
                            <div style={styles.metaKey}>{key}</div>
                            <div style={styles.metaValue}>{String(value)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "grid",
    gap: 20,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },

  subTitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 4,
  },

  timeline: {
    display: "grid",
    gap: 0,
  },

  timelineRow: {
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 14,
    alignItems: "start",
  },

  leftRail: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
  },

  dot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#111827",
    marginTop: 12,
  },

  line: {
    width: 2,
    flex: 1,
    background: "#e5e7eb",
    marginTop: 6,
  },

  eventCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },

  eventTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  eventDate: {
    fontSize: 12,
    color: "#6b7280",
  },

  eventTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
  },

  eventDesc: {
    fontSize: 13,
    color: "#4b5563",
    marginTop: 6,
  },

  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px solid #f1f5f9",
  },

  metaItem: {
    background: "#f9fafb",
    border: "1px solid #f1f5f9",
    borderRadius: 10,
    padding: 10,
  },

  metaKey: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  metaValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: 600,
    wordBreak: "break-word",
  },

  link: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 13,
  },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    background: "#111827",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  },

  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
  },

  emptyCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 20,
    color: "#6b7280",
    textAlign: "center",
  },
};