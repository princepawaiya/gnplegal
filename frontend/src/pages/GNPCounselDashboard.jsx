import { useEffect, useState } from "react";
import CounselKpiCards from "../components/dashboard/CounselKpiCards";
import CounselCaseTracker from "../components/dashboard/CounselCaseTracker";
import CounselActivityTimeline from "../components/dashboard/CounselActivityTimeline";
import CounselHearingCommandCenter from "../components/dashboard/CounselHearingCommandCenter";
import CounselNextActions from "../components/dashboard/CounselNextActions";
import {
  getGNPCounselSummary,
  getGNPCounselToday,
  getGNPCounselCases,
  getGNPCounselActivity,
} from "../services/gnpCounselApi";

export default function GNPCounselDashboard() {
  const [summary, setSummary] = useState({
    active_cases: 0,
    filed_this_month: 0,
    pending_actions: 0,
    upcoming_hearings: 0,
    revenue_generated: 0,
    performance_score: 0,
  });

  const [todayData, setTodayData] = useState({
    urgent_tasks: [],
    hearings: [],
    drafts: [],
    filings: [],
  });

  const [caseRows, setCaseRows] = useState([]);
  const [activity, setActivity] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [summaryRes, todayRes, casesRes, activityRes] = await Promise.all([
        getGNPCounselSummary().catch(() => ({})),
        getGNPCounselToday().catch(() => ({})),
        getGNPCounselCases().catch(() => ([])),
        getGNPCounselActivity().catch(() => ([])),
      ]);

      setSummary(summaryRes?.data || summaryRes || {});
      setTodayData(todayRes?.data || todayRes || {});

      const cases = Array.isArray(casesRes)
        ? casesRes
        : casesRes?.data || [];

      setCaseRows(cases);

      // ✅ ADD THIS RIGHT HERE
      setSummary((prev) => ({
        ...prev,
        active_cases: cases.length || 0,
      }));

      setActivity(Array.isArray(activityRes) ? activityRes : activityRes?.data || []);
    } catch (err) {
      console.error("Failed to load GNP Counsel dashboard", err);
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.heroCard}>
        <div>
          <div style={styles.heroTitle}>GNP Counsel Dashboard</div>
          <div style={styles.heroSub}>
            Manage hearings, filings, deadlines, and execution from one place.
          </div>
        </div>

        <div style={styles.heroRight}>
          <div style={styles.scoreCard}>
            <div style={styles.scoreLabel}>Performance Score</div>
            <div style={styles.scoreValue}>
              {summary.performance_score || 0}
            </div>
          </div>

          <button style={styles.refreshBtn} onClick={loadDashboard}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div style={styles.errorBox}>{error}</div>
      ) : loading ? (
        <div style={styles.loadingBox}>Loading dashboard...</div>
      ) : (
        <>
          <CounselKpiCards summary={summary} />

          <div style={styles.topGrid}>
            <CounselHearingCommandCenter rows={caseRows} />
            <CounselNextActions todayData={todayData} />
          </div>

          <CounselCaseTracker rows={caseRows} />
          <CounselActivityTimeline items={activity} />
        </>
      )}
    </div>
  );
}

const styles = {
  page: {
    display: "grid",
    gap: 20,
  },

  heroCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
  },

  heroTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
  },

  heroSub: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 6,
  },

  heroRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  scoreCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "12px 16px",
    minWidth: 140,
    textAlign: "center",
  },

  scoreLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },

  scoreValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#111827",
    marginTop: 4,
  },

  refreshBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 600,
    cursor: "pointer",
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 1fr",
    gap: 20,
  },

  loadingBox: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e5e7eb",
    color: "#64748b",
  },

  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 16,
    padding: 18,
  },
};