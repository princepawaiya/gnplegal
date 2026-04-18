import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL;

export default function ImportMatters() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [columns, setColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);

  /* ================= PREVIEW ================= */

  async function handlePreview() {
    if (!file) return alert("Select file");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(mapping));

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/import/matters/preview`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: formData,
      });

      const data = await res.json();

      setPreview(data.rows || []);
      setColumns(data.columns || []);
      setMapping(data.mapping || {});
    } catch (e) {
      alert("Preview failed");
    } finally {
      setLoading(false);
    }
  }

  /* ================= MAPPING ================= */

  function handleMappingChange(field, column) {
    setMapping((prev) => ({
      ...prev,
      [field]: column,
    }));
  }

  /* ================= IMPORT ================= */

  async function handleImport() {
    if (!preview.length) return alert("No data to import");

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/import/matters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          rows: preview.map(r => ({
            ...r.data,
            _suggestions: r._suggestions || r.suggestions || {},
          })),
          mapping,
        }),
      });

      const data = await res.json();

      alert(`Imported: ${data.created}, Skipped: ${data.skipped_duplicates}`);
    } catch (e) {
      alert("Import failed");
    } finally {
      setLoading(false);
    }
  }

  /* ================= EDIT CELL ================= */

  function updateCell(rowIndex, key, value) {
    const updated = [...preview];
    updated[rowIndex].data[key] = value;
    setPreview(updated);
  }

  function applyAllSuggestions() {
    const updated = preview.map((row) => {
      const suggestions = row.suggestions || {};
      const newData = { ...row.data };

      Object.keys(suggestions).forEach((field) => {
        const value = suggestions[field];

        // skip "Create 'XYZ'"
        if (!value || value.startsWith("Create")) return;

        const mappedColumn = mapping[field];

        if (mappedColumn) {
          newData[mappedColumn] = value;
        }
      });

      return {
        ...row,
        data: newData,
        _suggestions: suggestions, // 🔥 important for backend
      };
    });

    setPreview(updated);
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Import Matters</h2>

      {/* FILE */}
      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button onClick={handlePreview}>
        {loading ? "Loading..." : "Preview"}
      </button>

      {/* ================= MAPPING ================= */}

      {columns.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>Column Mapping</h3>

          {[
            "client",
            "matter_name",
            "case_no",
            "forum_name",
            "state",
            "district",
            "claim_amount",
            "current_status",
          ].map((field) => (
            <div key={field} style={{ marginBottom: 8 }}>
              <label>{field}</label>

              <select
                onChange={(e) =>
                  handleMappingChange(field, e.target.value)
                }
              >
                <option value="">Select Column</option>
                {columns.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* ================= PREVIEW ================= */}

      {preview.length > 0 && (
        <div style={{ marginTop: 20, overflowX: "auto" }}>
          <h3>Preview</h3>

          <button
            onClick={applyAllSuggestions}
            style={{
              marginBottom: 10,
              padding: "6px 12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            Apply All Suggestions
          </button>

          <table border="1" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Row</th>
                <th>Client</th>
                <th>Matter</th>
                <th>Case</th>
                <th>Forum</th>
                <th>Issues</th>
              </tr>
            </thead>

            <tbody>
                            {preview.map((row, i) => (
                <tr
                  key={i}
                  style={
                    row.issues?.length
                      ? { background: "#ffecec" }
                      : {}
                  }
                >
                  <td>{row.row_number}</td>

                  <td>
                    <input
                      value={row.data?.[mapping.client || "Client"] || ""}
                      onChange={(e) =>
                        updateCell(i, mapping.client || "Client", e.target.value)
                      }
                    />
                    {row.suggestions?.client && (
                      <div style={{ color: "#d97706", fontSize: 12, marginTop: 4 }}>
                        Suggested: {row.suggestions.client}
                        <button
                          type="button"
                          style={{ marginLeft: 8 }}
                          onClick={() =>
                            updateCell(i, mapping.client || "Client", row.suggestions.client)
                          }
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </td>

                  <td>
                    <input
                      value={row.data?.[mapping.matter_name || "Matter Name"] || ""}
                      onChange={(e) =>
                        updateCell(i, mapping.matter_name || "Matter Name", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={row.data?.[mapping.case_no || "Case No"] || ""}
                      onChange={(e) =>
                        updateCell(i, mapping.case_no || "Case No", e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={row.data?.[mapping.forum_name || "Forum Name"] || ""}
                      onChange={(e) =>
                        updateCell(i, mapping.forum_name || "Forum Name", e.target.value)
                      }
                    />
                    {row.suggestions?.forum_name && (
                      <div style={{ color: "#d97706", fontSize: 12, marginTop: 4 }}>
                        Suggested: {row.suggestions.forum_name}
                        <button
                          type="button"
                          style={{ marginLeft: 8 }}
                          onClick={() =>
                            updateCell(i, mapping.forum_name || "Forum Name", row.suggestions.forum_name)
                          }
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </td>

                  <td>
                    {row.issues?.length ? (
                      <ul>
                        {row.issues.map((issue, idx) => (
                          <li key={idx} style={{ color: "red" }}>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: "green" }}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* IMPORT */}
      {preview.length > 0 && (
        <button onClick={handleImport} style={{ marginTop: 20 }}>
          Confirm Import
        </button>
      )}
    </div>
  );
}