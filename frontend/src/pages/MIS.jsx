import { useEffect, useMemo, useState } from "react";
import {
  getMISDashboard,
  getMISClients,
  getMISProducts,
  getMISStates,
  getMISDistricts,
  getMISForums,
  getMISCounsels,
} from "../services/api";
import { useNavigate } from "react-router-dom";
import {
  exportMISExcel,
} from "../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const COLORS = [
  "#4F46E5", // Indigo
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#06B6D4", // Cyan
];

export default function MIS() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [forums, setForums] = useState([]);
  const [counsels, setCounsels] = useState([]);

  const [filters, setFilters] = useState({
    period_type: "all",   // ✅ KEY FIX
    year: "",
    month: "",
    quarter: "",
    start_date: "",
    end_date: "",
    client_id: "",
    product_id: "",
    state_id: "",
    district_id: "",
    forum_id: "",
    counsel_id: "",
    claim_bucket: "",
  });

  // ---------------- LOAD FILTERS ----------------
  async function loadFilters() {
    try {
      const [c, p, s, f, co] = await Promise.all([
        getMISClients(),
        getMISProducts(),
        getMISStates(),
        getMISForums(),
        getMISCounsels(),
      ]);

      setClients(c || []);
      setProducts(p || []);
      setStates(s || []);
      setForums(f || []);
      setCounsels(co || []);
    } catch (err) {
      console.error("Filter load failed", err);
    }
  }

  async function loadDistricts(stateId) {
    try {
      if (!stateId) {
        setDistricts([]);
        return;
      }

      const res = await getMISDistricts(stateId);

      console.log("DISTRICTS:", res); // DEBUG

      setDistricts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("District load failed", err);
      setDistricts([]);
    }
  }

  async function loadData(customFilters = filters) {
    try {
      setLoading(true);

      const params = {};

      // ✅ ONLY APPLY DATE FILTER IF USER SELECTED
      if (
        customFilters.period_type === "monthly" &&
        customFilters.year &&
        customFilters.month
      ) {
        params.period_type = "monthly";
        params.year = customFilters.year;
        params.month = customFilters.month;
      }

      // ✅ CUSTOM DATE RANGE
      if (customFilters.start_date)
        params.start_date = customFilters.start_date;

      if (customFilters.end_date)
        params.end_date = customFilters.end_date;

      // ✅ OTHER FILTERS
      if (customFilters.client_id) params.client_id = customFilters.client_id;
      if (customFilters.product_id) params.product_id = customFilters.product_id;
      if (customFilters.state_id) params.state_id = customFilters.state_id;
      if (customFilters.district_id) params.district_id = customFilters.district_id;
      if (customFilters.forum_id) params.forum_id = customFilters.forum_id;
      if (customFilters.counsel_id) params.counsel_id = customFilters.counsel_id;
      if (customFilters.claim_bucket) params.claim_bucket = customFilters.claim_bucket;

      const res = await getMISDashboard(params);
      setDashboard(res || {});
    } catch (err) {
      console.error("Dashboard load failed", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(type) {
    try {
      let blob;

      const effectiveFields = JSON.parse(
        localStorage.getItem("mis_selected_fields") || "[]"
      );

      const params = {
        ...filters,
        selected_fields: effectiveFields.join(","),
      };

      blob = await exportMISExcel(params);

      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `MIS_Report.${type === "excel" ? "xlsx" : type}`;
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed");
    }
  }

  useEffect(() => {
    loadFilters();
    loadData();
  }, []);

  useEffect(() => {
    if (filters.state_id) {
      loadDistricts(filters.state_id);
    } else {
      setDistricts([]);
      setFilters((prev) => ({ ...prev, district_id: "" }));
    }
  }, [filters.state_id]);

  function handleChange(key, value) {
    const parsed =
      key.includes("_id") && value !== "" ? Number(value) : value;

    setFilters((prev) => ({
      ...prev,
      [key]: parsed,
    }));
  }

  function applyFilters() {
    loadData(filters);
  }

  function resetFilters() {
    const reset = {
      period_type: "all",
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      quarter: "",
      start_date: "",
      end_date: "",
      client_id: "",
      product_id: "",
      state_id: "",
      district_id: "",
      forum_id: "",
      counsel_id: "",
      claim_bucket: "",
    };
    setFilters(reset);
    loadData(reset);
  }

  const summary = dashboard?.summary || {};
  const table = dashboard?.detailed_table || [];

  const savedFields =
    JSON.parse(localStorage.getItem("mis_selected_fields") || "[]") || [];

  const effectiveFields =
    savedFields.length > 0
      ? savedFields
      : Object.keys(table[0] || {});

  const filteredTable = table.map((row, index) => {
    const newRow = {};

    effectiveFields.forEach((field) => {
      if (field === "sr_no") {
        newRow["sr_no"] = index + 1;
      } else {
        newRow[field] = row[field];
      }
    });

    return newRow;
  });

  const statusData = useMemo(() => {
    return Object.entries(dashboard?.status_distribution || {});
  }, [dashboard]);

  const monthlyData = useMemo(() => {
    return Object.entries(dashboard?.monthly_trend || {});
  }, [dashboard]);

  const clientChartData = useMemo(() => {
  const obj = dashboard?.client_distribution || {};
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value,
  }));
}, [dashboard]);

const statusChartData = useMemo(() => {
  const obj = dashboard?.status_distribution || {};
  return Object.entries(obj).map(([name, value]) => ({
    name,
    value,
  }));
}, [dashboard]);

const monthlyChartData = useMemo(() => {
  const obj = dashboard?.monthly_trend || {};
  return Object.entries(obj).map(([month, value]) => ({
    month,
    value,
  }));
}, [dashboard]);

  return (
    <div style={styles.wrapper}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>MIS Dashboard</div>
          <div style={styles.subtitle}>
            Litigation analytics with filters & insights
          </div>
        </div>
        <button
          style={styles.customizeBtn}
          onClick={() => navigate("/admin/mis-builder")}
        >
          ⚙ Customize MIS
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => handleExport("excel")} style={styles.exportBtn}>
            ⬇ Excel
          </button>

          <button style={styles.secondaryBtn} onClick={resetFilters}>
            Reset
          </button>

          <button style={styles.primaryBtn} onClick={applyFilters}>
            Apply
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div style={styles.filterGrid}>
        <div>
          <label style={styles.label}>Period</label>
          <select
            style={styles.input}
            value={filters.period_type}
            onChange={(e) => handleChange("period_type", e.target.value)}
          >
            <option value="all">All</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {/* ✅ CONDITIONAL MONTH + YEAR */}
        {filters.period_type === "monthly" && (
          <>
            <div>
              <label style={styles.label}>Month</label>
              <select
                style={styles.input}
                value={filters.month}
                onChange={(e) => handleChange("month", e.target.value)}
              >
                <option value="">Select</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Year</label>
              <input
                style={styles.input}
                type="number"
                value={filters.year}
                onChange={(e) => handleChange("year", e.target.value)}
              />
            </div>
          </>
        )}

        <Select label="Client" value={filters.client_id} onChange={(v) => handleChange("client_id", v)} options={clients} />
        <Select label="Product" value={filters.product_id} onChange={(v) => handleChange("product_id", v)} options={products} />
        <Select label="State" value={filters.state_id} onChange={(v) => handleChange("state_id", v)} options={states} />
        <Select
          label="District"
          value={filters.district_id}
          onChange={(v) => handleChange("district_id", v)}
          options={districts || []}
        />
        <Select label="Forum" value={filters.forum_id} onChange={(v) => handleChange("forum_id", v)} options={forums} />
        <Select label="Counsel" value={filters.counsel_id} onChange={(v) => handleChange("counsel_id", v)} options={counsels} />

        <div>
          <label style={styles.label}>Claim Bucket</label>
          <select
            style={styles.input}
            value={filters.claim_bucket}
            onChange={(e) => handleChange("claim_bucket", e.target.value)}
          >
            <option value="">All</option>
            <option value="gt_500000">Above 5L</option>
            <option value="lte_500000">Upto 5L</option>
          </select>
        </div>
      </div>

      {/* KPI */}
      <div style={styles.grid}>
        <Card label="Total Matters" value={summary.total_matters} />
        <Card label="Pending" value={summary.pending_matters} />
        <Card label="Disposed" value={summary.disposed_matters} />
        <Card label="Claim Amount" value={`₹ ${format(summary.total_claim_amount)}`} />
        <Card label="Exposure" value={`₹ ${format(summary.pending_exposure)}`} />
      </div>

      {/* ================= CHARTS ================= */}

        <div style={styles.chartGrid}>

          {/* CLIENT DISTRIBUTION */}
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Client-wise Matters</div>

            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={clientChartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value">
                  {clientChartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* STATUS PIE */}
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Status Distribution</div>

            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                >
                  {statusChartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* MONTHLY TREND */}
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Monthly Trend</div>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyChartData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4F46E5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>

      {/* STATUS CHART */}
      <Section title="Status Distribution">
        {statusData.map(([k, v]) => (
          <ProgressBar key={k} label={k} value={v} total={summary.total_matters} />
        ))}
      </Section>

      {/* MONTHLY TREND */}
      <Section title="Monthly Trend">
        {monthlyData.map(([k, v]) => (
          <ProgressBar key={k} label={k} value={v} total={summary.total_matters} />
        ))}
      </Section>

      {/* TABLE */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Detailed Matters</div>

        <div style={styles.table}>
          <div
            style={{
              ...styles.trHead,
              gridTemplateColumns: `repeat(${effectiveFields.length}, 1fr)`,
            }}
          >
            {effectiveFields.map((field, index) => (
              <div key={`${field}-header-${index}`}>
                {formatHeader(field)}
              </div>
            ))}
          </div>

          {filteredTable.map((m, rowIndex) => (
            <div
              key={`${m.id || "row"}-${rowIndex}`}
              style={{
                ...styles.tr,
                gridTemplateColumns: `repeat(${effectiveFields.length}, 1fr)`,
              }}
              onClick={() => navigate(`/admin/matters/${m.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              {effectiveFields.map((field, index) => (
                <div key={`${field}-${index}`}>
                  {field === "claim_amount"
                    ? `₹ ${format(m[field])}`
                    : m[field] ?? "-"}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function Card({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.metric}>{value || 0}</div>
      <div style={styles.label}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function ProgressBar({ label, value, total }) {
  const width = total ? (value / total) * 100 : 0;
  return (
    <div style={styles.barRow}>
      <div style={{ width: 120 }}>{label}</div>
      <div style={styles.barTrack}>
        <div style={{ ...styles.barFill, width: `${width}%` }} />
      </div>
      <div>{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <select
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function format(v) {
  return Number(v || 0).toLocaleString("en-IN");
}

function formatHeader(key) {
  const map = {
    sr_no: "Sr. No.",
    id: "ID",
    internal_case_no: "Internal Case No.",
    client: "Client",
    matter_name: "Matter Name",
    case_no: "Case No.",
    allocation_date: "Allocation Date",
    claim_amount: "Claim Amount",
    status: "Status",
    stage: "Stage",
    product: "Product",
    state: "State",
    district: "District",
    forum: "Forum",
    counsel: "Counsel",
    ldoh: "LDOH",
    ndoh: "NDOH",
    disposed: "Disposed",
    outcome: "Outcome",
    claim_bucket: "Claim Bucket",
  };

  return map[key] || key;
}

/* ================= STYLES ================= */

const styles = {
  wrapper: { display: "grid", gap: 20 },

  header: { display: "flex", justifyContent: "space-between" },

  title: { fontSize: 22, fontWeight: 800 },
  subtitle: { fontSize: 13, color: "#64748b" },

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
    gap: 12,
  },

  input: {
    width: "100%",
    padding: 8,
    borderRadius: 8,
    border: "1px solid #e2e8f0",
  },

  label: { fontSize: 12, marginBottom: 4 },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
    gap: 12,
  },

  card: {
    background: "white",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },

  metric: { fontSize: 20, fontWeight: 700 },

  section: { display: "grid", gap: 10 },

  sectionTitle: { fontWeight: 700 },

  barRow: { display: "flex", alignItems: "center", gap: 10 },

  barTrack: {
    flex: 1,
    background: "#e2e8f0",
    height: 8,
    borderRadius: 6,
  },

  barFill: {
    height: 8,
    background: "#4f46e5",
    borderRadius: 6,
  },

  table: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
  },

  trHead: {
    display: "grid",
    background: "#f1f5f9",
    padding: 10,
    fontWeight: 600,
  },

  primaryBtn: {
    padding: "8px 12px",
    background: "#111827",
    color: "white",
    border: "none",
    borderRadius: 8,
  },

  secondaryBtn: {
    padding: "8px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
  },

  customizeBtn: {
    padding: "10px 16px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
  },

  tr: {
    display: "grid",
    padding: 10,
    borderTop: "1px solid #e2e8f0",
    transition: "0.2s",
  },

  trHover: {
    background: "#f9fafb",
  },

  exportBtn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  chartGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))",
    gap: 16,
  },

  chartCard: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
  },

  chartTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 10,
  },
};