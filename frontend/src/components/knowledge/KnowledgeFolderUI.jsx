import { useEffect, useState } from "react";

export default function KnowledgeFolderUI({ category = "judgement" }) {
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSub, setNewSub] = useState("");
  const [uploadingId, setUploadingId] = useState(null);

  useEffect(() => {
    loadItems();
  }, [category]);

  async function loadItems() {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge?category=${category}`,
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        }
      );

      const data = await res.json();
      setItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setItems([]);
    }
  }

  // ================= CLEAN GROUPING =================
  const grouped = {};

  items.forEach((item) => {
    const cat = item.category_name?.trim();
    const sub = item.sub_category_name?.trim();

    // ❌ ignore junk rows
    if (!cat) return;

    if (!grouped[cat]) grouped[cat] = {};

    const subKey = sub || "General";

    if (!grouped[cat][subKey]) grouped[cat][subKey] = [];

    // ❌ ignore placeholder rows (no file)
    if (!item.file_url && !sub) return;

    grouped[cat][subKey].push(item);
  });

  // ================= CREATE CATEGORY =================
  async function createCategory() {
    if (!newCategory.trim()) return;

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/knowledge/create-category`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          category,
          category_name: newCategory.trim(),
        }),
      });

      setNewCategory("");
      loadItems();
    } catch {
      alert("Failed to create category");
    }
  }

  // ================= CREATE SUB =================
  async function createSubCategory() {
    if (!selectedCategory || !newSub.trim()) return;

    try {
      await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge/create-sub-category`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            category,
            category_name: selectedCategory,
            sub_category_name: newSub.trim(),
          }),
        }
      );

      setNewSub("");
      loadItems();
    } catch {
      alert("Failed to create sub-category");
    }
  }

  // ================= UPLOAD =================
  async function handleUpload(e, cat, sub) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("category", "judgement");
    formData.append("category_name", cat);
    formData.append("sub_category_name", sub);

    try {
      setUploadingId(sub);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge/upload`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: formData,
        }
      );

      if (!res.ok) throw new Error();

      loadItems();
    } catch {
      alert("Upload failed");
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  }

  return (
    <div style={styles.wrapper}>
      {/* ADD CATEGORY */}
      <div style={styles.row}>
        <input
          placeholder="Add Category (e.g. Consumer)"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={styles.input}
        />
        <button style={styles.btn} onClick={createCategory}>
          Add
        </button>
      </div>

      {/* EMPTY */}
      {Object.keys(grouped).length === 0 && (
        <div style={styles.empty}>
          No categories yet. Add your first category.
        </div>
      )}

      {/* CATEGORY LIST */}
      <div style={styles.grid}>
        {Object.keys(grouped).map((cat) => (
          <div key={cat} style={styles.card}>
            <div
              style={styles.category}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedSub("");
              }}
            >
              📁 {cat}
            </div>

            {selectedCategory === cat && (
              <>
                {/* ADD SUB */}
                <div style={styles.row}>
                  <input
                    placeholder="Add Sub-category"
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    style={styles.input}
                  />
                  <button style={styles.btn} onClick={createSubCategory}>
                    +
                  </button>
                </div>

                {/* SUB LIST */}
                {Object.keys(grouped[cat]).map((sub) => (
                  <div key={sub} style={styles.subCard}>
                    <div
                      style={styles.sub}
                      onClick={() => setSelectedSub(sub)}
                    >
                      📂 {sub}
                    </div>

                    {/* FILES */}
                    {selectedSub === sub && (
                      <div style={styles.files}>
                        <label style={styles.uploadBtn}>
                          {uploadingId === sub
                            ? "Uploading..."
                            : "Upload Judgement"}
                          <input
                            hidden
                            type="file"
                            onChange={(e) => handleUpload(e, cat, sub)}
                          />
                        </label>

                        {grouped[cat][sub].map((f) => (
                          <div key={f.id} style={styles.fileRow}>
                            <span>{f.title}</span>

                            {f.file_url && (
                              <button
                                style={styles.view}
                                onClick={() =>
                                  window.open(
                                    `${import.meta.env.VITE_API_URL}${f.file_url}`,
                                    "_blank"
                                  )
                                }
                              >
                                View
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { padding: 10 },

  row: { display: "flex", gap: 10, marginBottom: 10 },

  input: {
    padding: 8,
    border: "1px solid #ccc",
    borderRadius: 8,
    flex: 1,
  },

  btn: {
    padding: "8px 12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 12,
  },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
  },

  category: {
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 8,
  },

  subCard: {
    marginTop: 8,
    paddingLeft: 10,
  },

  sub: {
    cursor: "pointer",
    fontSize: 13,
  },

  files: {
    marginTop: 6,
    display: "grid",
    gap: 6,
  },

  fileRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
  },

  view: {
    fontSize: 12,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "2px 6px",
    cursor: "pointer",
  },

  uploadBtn: {
    background: "#2563eb",
    color: "white",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    display: "inline-block",
    marginBottom: 6,
  },

  empty: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 10,
  },
};