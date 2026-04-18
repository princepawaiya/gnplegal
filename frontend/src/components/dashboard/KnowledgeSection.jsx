import { useEffect, useState } from "react";

export default function KnowledgeSection({ title, category, onRefresh }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploadingId, setUploadingId] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubCategory, setNewSubCategory] = useState("");

  const safeItems = Array.isArray(items) ? items : [];
  // ✅ REMOVE DUPLICATES (IMPORTANT)
  const uniqueItemsMap = {};
  safeItems.forEach((item) => {
    const key = (item.title || "").toLowerCase().trim();
    if (!uniqueItemsMap[key]) {
      uniqueItemsMap[key] = item;
    }
  });

  const uniqueItems = Object.values(uniqueItemsMap);
  const uploadedItems = safeItems.filter((i) => i.file_url);
  const pendingItems = uniqueItems.filter((i) => !i.file_url);

  const categories = [...new Set(
    safeItems
      .map((i) => i.category_name || i.category_label || i.parent_category || "")
      .filter(Boolean)
  )];

  const subCategories = [...new Set(
    safeItems
      .filter((i) => {
        const itemCategory =
          i.category_name || i.category_label || i.parent_category || "";
        return !selectedCategory || itemCategory === selectedCategory;
      })
      .map((i) => i.sub_category_name || i.sub_category_label || i.sub_category || "")
      .filter(Boolean)
  )];

  useEffect(() => {
    loadItems();
    onRefresh?.();
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

      const normalized = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      setItems(normalized);
    } catch (e) {
      console.error("Failed to load knowledge items", e);
      setItems([]);
    }
  }

  async function handleCreateCategory() {
  const cleanCategory = newCategory.trim();

  if (!cleanCategory) {
    alert("Enter category name");
    return;
  }

  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/knowledge/create-category`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          category,
          category_name: cleanCategory,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || "Failed to create category");
    }

    setSelectedCategory(cleanCategory);
    setNewCategory("");
    await loadItems();
    onRefresh?.();
  } catch (e) {
    alert(e.message || "Failed to create category");
  }
}

async function handleCreateSubCategory() {
  const cleanSubCategory = newSubCategory.trim();

  if (!selectedCategory) {
    alert("Select or create category first");
    return;
  }

  if (!cleanSubCategory) {
    alert("Enter sub-category name");
    return;
  }

  try {
    const res = await fetch(
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
          sub_category_name: cleanSubCategory,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || "Failed to create sub-category");
    }

    setSelectedSubCategory(cleanSubCategory);
    setNewSubCategory("");
    await loadItems();
    onRefresh?.();
  } catch (e) {
    alert(e.message || "Failed to create sub-category");
  }
}

  async function handleCreate() {
    const cleanTitle = newTitle.trim();

    if (!cleanTitle) {
      alert("Enter name");
      return;
    }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            title: cleanTitle,
            category,
            category_name: category === "important_judgement" ? selectedCategory : null,
            sub_category_name:
              category === "important_judgement" ? selectedSubCategory : null,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Failed to create item");
      }

      setNewTitle("");
      await loadItems();
      onRefresh?.();
      setSelected(""); // reset dropdown
    } catch (e) {
      alert(e.message || "Failed to create item");
    }
  }

  async function handleUpload(e, id) {
    const file = e.target.files?.[0];
    if (!file) return;

    const item = safeItems.find((i) => i.id === id);
    if (!item) {
      alert("Invalid item selected");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", item.title);
    formData.append("category", category);

    if (category === "important_judgement") {
      formData.append(
        "category_name",
        item.category_name || item.category_label || item.parent_category || selectedCategory || ""
      );
      formData.append(
        "sub_category_name",
        item.sub_category_name || item.sub_category_label || item.sub_category || selectedSubCategory || ""
      );
    }

    try {
      setUploadingId(id);

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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Upload failed");
      }

      await loadItems();
      onRefresh?.();
    } catch (e) {
      alert(e.message || "Upload failed");
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this item?")) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/knowledge/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Delete failed");
      }

      if (String(selected) === String(id)) {
        setSelected("");
      }

      await loadItems();
      onRefresh?.();
    } catch (e) {
      alert(e.message || "Delete failed");
    }
  }

  const filtered = safeItems
    .filter((i) =>
      String(i.title || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .filter((i) => {
      if (selected && Number(selected) !== i.id) {
        return false;
      }

      if (category === "bare_act") {
        return true;
      }

      if (category === "important_judgement") {
        const itemCategory =
          i.category_name || i.category_label || i.parent_category || "";
        const itemSubCategory =
          i.sub_category_name || i.sub_category_label || i.sub_category || "";

        if (selectedCategory && itemCategory !== selectedCategory) {
          return false;
        }

        if (selectedSubCategory && itemSubCategory !== selectedSubCategory) {
          return false;
        }
      }

      if (filter === "uploaded") return !!i.file_url;
      if (filter === "pending") return !i.file_url;
      return true;
    });
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.title}>{title}</div>

        <div style={styles.headerRight}>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.search}
          />

          <select
            style={styles.select}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="uploaded">Uploaded</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {category === "important_judgement" && (
        <>
          <div style={styles.filterRow}>
            <select
              style={styles.select}
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubCategory("");
              }}
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              placeholder="Add category manually"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={styles.input}
            />

            <button style={styles.addBtn} onClick={handleCreateCategory}>
              Add Category
            </button>
          </div>

          <div style={styles.filterRow}>
            <select
              style={styles.select}
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              disabled={!selectedCategory}
            >
              <option value="">Select Sub-category</option>
              {subCategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <input
              placeholder="Add sub-category manually"
              value={newSubCategory}
              onChange={(e) => setNewSubCategory(e.target.value)}
              style={styles.input}
              disabled={!selectedCategory}
            />

            <button
              style={styles.addBtn}
              onClick={handleCreateSubCategory}
              disabled={!selectedCategory}
            >
              Add Sub-category
            </button>
          </div>
        </>
      )}

      <div style={styles.addRow}>
        <input
          placeholder={
            category === "important_judgement"
              ? "Add new judgement..."
              : "Add new document..."
          }
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={styles.input}
        />
        <button style={styles.addBtn} onClick={handleCreate}>
          Add
        </button>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          Step 1: Add name → Step 2: Upload file
        </div>
      </div>

      <div style={styles.table}>
        <div style={styles.tableHead}>
          <div>Name</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {category === "bare_act" ? (
          <div style={styles.dropdownBox}>

            {/* SELECTED ITEM ACTIONS */}
            {category === "bare_act" && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                  Bare Acts
                </div>

                {uniqueItems.length === 0 ? (
                  <div style={styles.empty}>No bare acts added</div>
                ) : (
                  uniqueItems.map((item) => (
                    <div key={item.id} style={styles.row}>
                      <div style={styles.name}>{item.title}</div>

                      <div>
                        <span
                          style={{
                            ...styles.badge,
                            background: item.file_url ? "#dcfce7" : "#fef3c7",
                            color: item.file_url ? "#16a34a" : "#d97706",
                          }}
                        >
                          {item.file_url ? "Uploaded" : "Pending"}
                        </span>
                      </div>

                      <div style={styles.actions}>
                        {item.file_url && (
                          <button
                            style={styles.viewBtn}
                            onClick={() =>
                              window.open(
                                `${import.meta.env.VITE_API_URL}${item.file_url}`,
                                "_blank"
                              )
                            }
                          >
                            View
                          </button>
                        )}

                        {!item.file_url && (
                          <label style={styles.uploadBtn}>
                            {uploadingId === item.id ? "Uploading..." : "Upload"}
                            <input
                              hidden
                              type="file"
                              onChange={(e) => handleUpload(e, item.id)}
                            />
                          </label>
                        )}

                        <button
                          style={styles.deleteBtn}
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          No items

          <div style={{ marginTop: 10 }}>
            Add a template name above, then upload file
          </div>
        </div>
      ) : (
          filtered.map((item) => (
            <div key={item.id} style={styles.row}>
              <div>
                <div style={styles.name}>{item.title}</div>

                {category === "important_judgement" && (
                  <div style={styles.metaLine}>
                    {(item.category_name || item.category_label || item.parent_category || "-")}
                    {" → "}
                    {(item.sub_category_name || item.sub_category_label || item.sub_category || "-")}
                  </div>
                )}
              </div>

              <div>
                <span
                  style={{
                    ...styles.badge,
                    background: item.file_url ? "#dcfce7" : "#fef3c7",
                    color: item.file_url ? "#16a34a" : "#d97706",
                  }}
                >
                  {item.file_url ? "Uploaded" : "Pending"}
                </span>
              </div>

              <div style={styles.actions}>
                {item.file_url && (
                  <button
                    style={styles.viewBtn}
                    onClick={() =>
                      window.open(
                        `${import.meta.env.VITE_API_URL}${item.file_url}`,
                        "_blank"
                      )
                    }
                  >
                    View
                  </button>
                )}

                {!item.file_url && (
                  <label style={styles.uploadBtn}>
                    {uploadingId === item.id ? "Uploading..." : "Upload"}
                    <input
                      hidden
                      type="file"
                      onChange={(e) => handleUpload(e, item.id)}
                    />
                  </label>
                )}

                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--card)",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e5e7eb",
    display: "grid",
    gap: 16,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  title: {
    fontWeight: 700,
    fontSize: 16,
  },

  headerRight: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  search: {
    padding: 8,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },

  select: {
    padding: 8,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },

  addRow: {
    display: "flex",
    gap: 10,
  },

  input: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
  },

  addBtn: {
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
  },

  table: {
    display: "grid",
    gap: 10,
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 2fr",
    fontSize: 12,
    color: "#64748b",
    fontWeight: 600,
  },

  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 2fr",
    alignItems: "center",
    padding: 10,
    border: "1px solid #f1f5f9",
    borderRadius: 10,
    gap: 10,
  },

  name: {
    fontWeight: 600,
  },

  badge: {
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
  },

  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  uploadBtn: {
    background: "#2563eb",
    color: "white",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
  },

  viewBtn: {
    border: "1px solid #cbd5e1",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    background: "#fff",
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
    padding: 20,
  },

  pendingBox: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: 10,
  },

  pendingTitle: {
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: "#c2410c",
  },

  pendingItem: {
    fontSize: 13,
    color: "#9a3412",
  },

  dropdownBox: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  selectedActions: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },

  filterRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  metaLine: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
};