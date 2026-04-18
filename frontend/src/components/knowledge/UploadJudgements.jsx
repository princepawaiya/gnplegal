import { useEffect, useState } from "react";

export default function UploadJudgements() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSub, setSelectedSub] = useState("");

  const [newCategory, setNewCategory] = useState("");
  const [newSub, setNewSub] = useState("");

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge?category=judgement`,
        {
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        }
      );

      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];

      setItems(list);

      const cats = [...new Set(list.map((i) => i.category_name).filter(Boolean))];
      setCategories(cats);
    } catch (e) {
      console.error("Failed to load judgements", e);
      setItems([]);
      setCategories([]);
      setSubCategories([]);
    }
  }

  function handleCategoryChange(cat) {
    setSelectedCategory(cat);
    setSelectedSub("");
    setSearch("");

    const subs = [
      ...new Set(
        items
          .filter((i) => i.category_name === cat)
          .map((i) => i.sub_category_name)
          .filter(Boolean)
      ),
    ];

    setSubCategories(subs);
  }

  async function addCategory() {
    if (!newCategory.trim()) return;

    await fetch(`${import.meta.env.VITE_API_URL}/knowledge/create-category`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        category: "judgement",
        category_name: newCategory.trim(),
      }),
    });

    setNewCategory("");
    loadItems();
  }

  async function addSubCategory() {
    if (!selectedCategory || !newSub.trim()) return;

    await fetch(`${import.meta.env.VITE_API_URL}/knowledge/create-sub-category`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        category: "judgement",
        category_name: selectedCategory,
        sub_category_name: newSub.trim(),
      }),
    });

    setNewSub("");
    loadItems();
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedCategory || !selectedSub) {
      alert("Select category and sub-category first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("category", "judgement");
    formData.append("category_name", selectedCategory);
    formData.append("sub_category_name", selectedSub);

    await fetch(`${import.meta.env.VITE_API_URL}/knowledge/upload`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: formData,
    });

    e.target.value = "";
    loadItems();
  }

  async function deleteFile(id) {
    if (!confirm("Delete this judgement?")) return;

    await fetch(`${import.meta.env.VITE_API_URL}/knowledge/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    loadItems();
  }

  const filtered = items.filter(
    (i) =>
      i.category_name === selectedCategory &&
      i.sub_category_name === selectedSub &&
      i.file_url &&
      (i.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.wrapper}>
      <div style={styles.subHeader}>
        Select category → sub-category → upload judgement
      </div>

      <div style={styles.row}>
        <input
          placeholder="Add Category (e.g. Consumer)"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          style={styles.input}
        />
        <button style={styles.primaryBtn} onClick={addCategory}>
          Add
        </button>
      </div>

      <div style={styles.row}>
        <select
          style={styles.select}
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {selectedCategory && (
        <>
          <div style={styles.row}>
            <input
              placeholder="Add Sub-category (e.g. Not a consumer)"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              style={styles.input}
            />
            <button style={styles.primaryBtn} onClick={addSubCategory}>
              Add
            </button>
          </div>

          <div style={styles.row}>
            <select
              style={styles.select}
              value={selectedSub}
              onChange={(e) => setSelectedSub(e.target.value)}
            >
              <option value="">Select Sub-category</option>
              {subCategories.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div style={styles.uploadBox}>
        {!selectedCategory && (
            <div style={{ fontSize: 12, color: "#ef4444" }}>
            ⚠️ Please select category first
            </div>
        )}

        {selectedCategory && !selectedSub && (
            <div style={{ fontSize: 12, color: "#ef4444" }}>
            ⚠️ Please select sub-category
            </div>
        )}

        <input
            type="file"
            disabled={!selectedCategory || !selectedSub}
            onChange={uploadFile}
        />
        </div>

      {selectedSub && (
        <div style={styles.listContainer}>
          <input
            placeholder="Search judgement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />

          <div style={styles.listTitle}>Judgements under this sub-category</div>

          {filtered.length === 0 ? (
            <div style={styles.empty}>No judgements uploaded</div>
          ) : (
            <div style={styles.recentList}>
              {filtered.map((f) => (
                <div key={f.id} style={styles.recentRow}>
                  <div style={styles.recentTitle}>{f.title}</div>

                  <div style={styles.actionGroup}>
                    <button
                      style={styles.viewBtn}
                      onClick={() =>
                        window.open(
                          `${import.meta.env.VITE_API_URL}${f.file_url}`,
                          "_blank"
                        )
                      }
                    >
                      View
                    </button>

                    <button
                      style={styles.deleteBtn}
                      onClick={() => deleteFile(f.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "grid",
    gap: 12,
  },

  subHeader: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },

  row: {
    display: "flex",
    gap: 10,
  },

  input: {
    flex: 1,
    padding: 10,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#fff",
  },

  select: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
  },

  primaryBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },

  uploadBox: {
    padding: 12,
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    background: "#fafafa",
  },

  listContainer: {
    marginTop: 6,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 12,
    display: "grid",
    gap: 10,
  },

  searchInput: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
  },

  listTitle: {
    fontSize: 14,
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
    background: "#fff",
    flexWrap: "wrap",
  },

  recentTitle: {
    fontWeight: 600,
    fontSize: 14,
    color: "#111827",
  },

  actionGroup: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  viewBtn: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  deleteBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  empty: {
    fontSize: 12,
    color: "#94a3b8",
    padding: 8,
  },
};