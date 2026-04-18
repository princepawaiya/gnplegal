import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listClients,
  createMatter,
  listProducts,
  createProduct,
  listStates,
  listDistricts,
  listForums,
  listForumTypes,
  createState,
  createDistrict,
  createForum,
  suggestJurisdiction
} from "../services/api";

const DCDRC = 1;
const SCDRC = 2;
const NCDRC = 3;

export default function CreateMatter() {
  const navigate = useNavigate();
  const user = JSON.parse(atob(localStorage.getItem("token").split(".")[1]));

  const basePath =
    user.role_id === 3
      ? "/gnp"
      : user.role === "admin"
      ? "/admin"
      : user.role === "lawyer"
      ? "/lawyer"
      : "/client";

  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [forums, setForums] = useState([]);
  const [forumTypes, setForumTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddState, setShowAddState] = useState(false);
  const [newStateName, setNewStateName] = useState("");
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [jurisdictionHint, setJurisdictionHint] = useState("");
  const [jurisdictionLoading, setJurisdictionLoading] = useState(false);
  const [caseNoLocked, setCaseNoLocked] = useState(false);
  const [savedCaseNo, setSavedCaseNo] = useState("");
  const [prayerClause, setPrayerClause] = useState("");
  const [savedPrayer, setSavedPrayer] = useState("");

  const [documents, setDocuments] = useState([
    { type: "complaint", file: null },
    { type: "annexure", file: null },
  ]);

  const [oppositeParties, setOppositeParties] = useState([
    { name: "", address: "", phone: "", email: "" }
  ]);

  const [matterNameLocked, setMatterNameLocked] = useState(false);
  const [savedMatterName, setSavedMatterName] = useState("");
  const [caseCategories, setCaseCategories] = useState(["CC", "FA", "RP", "EA"]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  
  // ✅ PRODUCT
  async function handleAddProduct() {
    if (!newProductName.trim()) {
      alert("Enter product name");
      return;
    }

    try {
      const p = await createProduct(newProductName);
      setProducts(prev => [...prev, p]);
      setForm(prev => ({ ...prev, product_id: p.id }));
      setNewProductName("");
      setShowAddProduct(false);
    } catch {
      alert("Failed to create product");
    }
  }

  // ✅ STATE
  async function handleAddState() {
    if (!newStateName.trim()) {
      alert("Enter state name");
      return;
    }

    try {
      const s = await createState(newStateName.trim());

      setStates(prev => [...prev, s]);

      setForm(prev => ({
        ...prev,
        state_id: String(s.id),
        district_id: "",
        forum_id: "",
      }));

      setNewStateName("");
      setShowAddState(false);
      alert("State added successfully");
    } catch (e) {
      alert(e.message || "Failed to create state");
    }
  }

  // ✅ DISTRICT
  async function handleAddDistrict() {
    const selectedType = forumTypes.find(
    ft => Number(ft.id) === Number(form.forum_type_id)
  )?.name;

  const isDistrictBased =
    Number(form.forum_type_id) === DCDRC ||
    selectedType?.toLowerCase() === "district court";

  if (!isDistrictBased) {
    alert("District can only be added for district-based forums");
    return;
  }

  if (!newDistrictName.trim()) {
    alert("Enter district name");
    return;
  }

  if (!form.state_id) {
    alert("Select state first");
    return;
  }

  try {
    const d = await createDistrict(
      newDistrictName.trim(),
      Number(form.state_id)
    );

    setDistricts(prev => [...prev, d]);

    setForm(prev => ({
      ...prev,
      district_id: String(d.id),
      forum_id: "",
    }));

    setNewDistrictName("");
    setShowAddDistrict(false);

  } catch (e) {
    alert(e.message || "Failed to create district");
  }
}

  // ✅ FORUM
  async function handleAddForum() {
  if (!newForumName.trim()) {
    alert("Enter forum name");
    return;
  }

  if (!form.forum_type_id) {
    alert("Select forum type first");
    return;
  }

  if (Number(form.forum_type_id) === DCDRC) {
    if (!form.state_id || !form.district_id) {
      alert("Select state and district");
      return;
    }
  }

  if (Number(form.forum_type_id) === SCDRC) {
    if (!form.state_id) {
      alert("Select state");
      return;
    }
  }

  try {
    const f = await createForum({
      name: newForumName.trim(),
      forum_type_id: Number(form.forum_type_id),
      state_id:
        Number(form.forum_type_id) === NCDRC
          ? null
          : Number(form.state_id),
      district_id:
        Number(form.forum_type_id) === DCDRC
          ? Number(form.district_id)
          : null,
    });

    setForums(prev => [...prev, f]);

    setForm(prev => ({
      ...prev,
      forum_id: String(f.id),
    }));

    setNewForumName("");
    setShowAddForum(false);

  } catch (e) {
    alert(e.message || "Failed to create forum");
  }
}

  const [showAddForum, setShowAddForum] = useState(false);
  const [newForumName, setNewForumName] = useState("");

  const [form, setForm] = useState({
    client_id: "",
    matter_name: "",
    product_id: "",
    forum_type_id: "",
    state_id: "",
    district_id: "",
    forum_id: "",
    allocation_date: "",
    case_prefix: "CC",
    case_number: "",
    case_year: new Date().getFullYear(),
    case_no: "", // final combined
    dc_sc_no: "",
    summary: "",
    claim_amount: "",
    current_status: "Pending",
    ldoh: "",
    ndoh: "",
    comments: "",
    pleadings_status: "Pending",
    allegation: "",
    court_mode: "consumer", // NEW
  });

  useEffect(() => {
    if (form.court_mode !== "consumer") return;
    if (!form.forum_type_id) return;

    const forumTypeId = Number(form.forum_type_id);

    const filters = {
      forum_type_id: forumTypeId,
    };

    // ✅ DCDRC
    if (forumTypeId === DCDRC) {
      if (!form.state_id || !form.district_id) return;

      filters.state_id = Number(form.state_id);
      filters.district_id = Number(form.district_id);
    }

    // ✅ SCDRC
    else if (forumTypeId === SCDRC) {
      if (!form.state_id) return;

      filters.state_id = Number(form.state_id);
    }

    // ✅ NCDRC → no filters

    console.log("FINAL FILTERS:", filters);

    listForums(filters)
  .then((res) => {
    const list = Array.isArray(res) ? res : [];

    setForums(list);

    // 🚀 AUTO SELECT LOGIC
    if (list.length === 1) {
      setForm(prev => ({
        ...prev,
        forum_id: String(list[0].id),
      }));
    }
  })
  .catch(() => alert("Failed to load forums"));

  }, [
    form.forum_type_id,
    form.state_id,
    form.district_id
  ]);

  useEffect(() => {
    if (form.court_mode !== "court") return;
    if (!form.forum_type_id) return;

    const filters = {
      forum_type_id: Number(form.forum_type_id),
    };

    const selectedType = forumTypes.find(
      ft => ft.id == form.forum_type_id
    )?.name?.toLowerCase();

    if (selectedType?.toLowerCase() === "district court") {
      if (!form.state_id || !form.district_id) return;

      filters.state_id = Number(form.state_id);
      filters.district_id = Number(form.district_id);
    }

    else if (selectedType === "high court" || selectedType === "drt") {
      if (!form.state_id) return;

      filters.state_id = Number(form.state_id);
    }

    listForums(filters)
      .then(res => {
        const list = Array.isArray(res) ? res : [];

        setForums(list);

        if (list.length === 1) {
          setForm(prev => ({
            ...prev,
            forum_id: String(list[0].id),
          }));
        }
      })
      .catch(() => alert("Failed to load courts"));

  }, [
    form.court_mode,
    form.forum_type_id,
    form.state_id,
    form.district_id,
    forumTypes
  ]);

  /* ---------------- LOAD ---------------- */

  useEffect(() => {
    async function load() {
      try {
        const clientRes = await listClients();
        setClients(
          Array.isArray(clientRes)
            ? clientRes
            : clientRes?.data || clientRes?.items || []
        );
        const productRes = await listProducts();

        const safeProducts =
          Array.isArray(productRes)
            ? productRes
            : Array.isArray(productRes?.data)
            ? productRes.data
            : Array.isArray(productRes?.items)
            ? productRes.items
            : [];

        setProducts(safeProducts);

        const forumTypeRes = await listForumTypes();

        const safeForumTypes = Array.isArray(forumTypeRes)
          ? forumTypeRes
          : forumTypeRes?.data || forumTypeRes?.items || [];

        setForumTypes(safeForumTypes);
        console.log("FORUM TYPES:", forumTypeRes);

        const stateRes = await listStates();
        setStates(Array.isArray(stateRes) ? stateRes : []);
        console.log("STATES:", stateRes);
      } catch {
        alert("Failed to load data");
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!form.state_id || isNaN(Number(form.state_id))) return;

    console.log("STATE ID:", form.state_id);

    listDistricts(Number(form.state_id))
      .then((res) => {
        console.log("DISTRICTS API RESPONSE:", res);

        const data = Array.isArray(res) ? res : [];

        setDistricts(data);
      })
      .catch((err) => {
        console.error("DISTRICT LOAD ERROR:", err);
        alert("Failed to load districts");
      });
  }, [form.state_id]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("caseCategories"));
    if (saved && saved.length) {
      setCaseCategories(saved);
    }
  }, []);

useEffect(() => {
  async function runJurisdiction() {
    if (!form.claim_amount) {
      setJurisdictionHint("");
      return;
    }

    try {
      setJurisdictionLoading(true);

      const result = await suggestJurisdiction({
        claim_amount: Number(form.claim_amount),
        state_id: form.state_id || null,
        district_id: form.district_id || null,
      });

      setForm(prev => ({
        ...prev,
        forum_type_id: result?.forum_type_id || "",
        forum_id: result?.forum_id || "",
      }));

      if (result?.forum_name) {
        setJurisdictionHint(
          `Recommended forum: ${result.forum_name} (${result.forum_type_code})`
        );
      } else if (result?.message) {
        setJurisdictionHint(result.message);
      } else {
        setJurisdictionHint("");
      }
    } catch (e) {
      setJurisdictionHint("Unable to suggest jurisdiction right now.");
    } finally {
      setJurisdictionLoading(false);
    }
  }

  runJurisdiction();
}, [form.claim_amount, form.state_id, form.district_id]);

useEffect(() => {
  const type = Number(form.forum_type_id);

  if (form.court_mode === "consumer") {
    setForm(prev => ({
      ...prev,
      district_id: type === DCDRC ? prev.district_id : "",
      state_id: type === NCDRC ? "" : prev.state_id,
      forum_id: prev.forum_type_id !== type ? "" : prev.forum_id,
    }));
    return;
  }

  const selectedType = forumTypes.find(
    ft => Number(ft.id) === type
  )?.name?.toLowerCase();

  setForm(prev => ({
    ...prev,
    district_id: selectedType?.toLowerCase() === "district court" ? prev.district_id : "",
    forum_id: "",
  }));
}, [form.forum_type_id, form.court_mode, forumTypes]);

  function handleChange(e) {
    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]:
        name === "case_number" || name === "case_year" || name === "claim_amount"
          ? (value === "" ? "" : Number(value))
          : value
    }));
  }

function handleSavePrayer() {
  if (!prayerClause.trim()) {
    alert("Enter prayer clause");
    return;
  }

  setSavedPrayer(prayerClause);
  alert("Prayer clause saved");
}

function handleFileChange(index, file) {
  const updated = [...documents];
  updated[index].file = file;
  setDocuments(updated);
}

function handleAddMoreDocuments() {
  setDocuments(prev => [
    ...prev,
    { type: "additional", file: null }
  ]);
}

  /* ---------------- SUBMIT ---------------- */

  function handleSaveCaseNo() {
    if (!form.case_prefix || !form.case_number || !form.case_year) {
      alert("Complete case number is required");
      return;
    }

    const finalCaseNo = `${form.case_prefix}/${form.case_number}/${form.case_year}`;

    setForm(prev => ({
      ...prev,
      case_no: finalCaseNo,
    }));

    setSavedCaseNo(finalCaseNo);
    setCaseNoLocked(true);
  }

  function handleEditCaseNo() {
    setCaseNoLocked(false);
  }

  async function handleSubmit() {
    if (
      !form.client_id ||
      !form.matter_name ||
      !form.forum_id
    ) {
      alert("Please fill mandatory fields");
      return;
    }

    if (!form.case_no) {
      alert("Please save the case number first");
      return;
    }

    try {
      setSubmitting(true);

      await createMatter({
        ...form,
        client_id: Number(form.client_id),
        forum_id: form.forum_id ? Number(form.forum_id) : null,
        product_id: form.product_id ? Number(form.product_id) : null,
        claim_amount: form.claim_amount ? Number(form.claim_amount) : null,
        opposite_parties: oppositeParties,
        court_mode: form.court_mode,
      });

      alert("Matter created successfully");
      navigate(
        user.role_id === 3
          ? "/gnp/cases"
          : `${basePath}/matters`
      );
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function addOppositeParty() {
  setOppositeParties(prev => [
    ...prev,
    { name: "", address: "", phone: "", email: "" }
  ]);
}

async function loadStates() {
  const data = await listStates();
  setStates(data || []);
}

async function loadDistricts(stateId) {
  const data = await listDistricts(stateId);
  setDistricts(data || []);
}

function updateOppositeParty(index, field, value) {
  const updated = [...oppositeParties];
  updated[index][field] = value;
  setOppositeParties(updated);
}

function removeOppositeParty(index) {
  const updated = oppositeParties.filter((_, i) => i !== index);
  setOppositeParties(updated);
}

function generateMatterTitle() {
  if (!form.matter_name) return "";

  const partiesText = oppositeParties
    .map((p, i) => `${i + 1}. ${p.name || "Opposite Party"}`)
    .join("\n");

  return `${form.matter_name} vs\n${partiesText}`;
}

function handleSaveMatterName() {
  const title = generateMatterTitle();

  if (!title) {
    alert("Enter matter name and opposite parties");
    return;
  }

  setForm(prev => ({
    ...prev,
    matter_name: title
  }));

  setSavedMatterName(title);
  setMatterNameLocked(true);
}

function handleEditMatterName() {
  setMatterNameLocked(false);
}

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.headerCard}>
          <div>
            <div style={styles.hTitle}>Create New Matter</div>
            <div style={styles.hSub}>Case setup • Forum • Financials</div>
          </div>

          <button
            onClick={() => navigate(`${basePath}/matters`)}
            style={styles.compactAddBtn}
          >
            Cancel
          </button>
        </div>

        {/* FORM */}
        <div style={styles.card}>

          <Section title="Basic Information">
  <div style={styles.basicGrid}>

    {/* LEFT COLUMN */}
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <Field label="Client *">
        <div style={styles.inlineFieldCompact}>
          <select
            value={form.client_id}
            onChange={(e) =>
              setForm({ ...form, client_id: Number(e.target.value) })
            }
            style={{ ...styles.input, flex: 1 }}
          >
            <option value="">Select Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Field>

      <Field label="Product / Services">
        <div style={styles.inlineFieldCompact}>
          <select
            name="product_id"
            value={form.product_id}
            onChange={handleChange}
            style={{ ...styles.input, flex: 1 }}
          >
            <option value="">Select Product or Services</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAddProduct(prev => !prev)}
            style={styles.compactAddBtn}
          >
            + Add
          </button>
        </div>

        {showAddProduct && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              placeholder="New product name"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              style={{ ...styles.input, flex: 1 }}
            />

            <button
              type="button"
              onClick={handleAddProduct}
              style={styles.primaryBtn}
            >
              Save
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAddProduct(false);
                setNewProductName("");
              }}
              style={styles.secondaryBtn}
            >
              Cancel
            </button>
          </div>
        )}
      </Field>

    </div>

    {/* RIGHT COLUMN */}
    <div>
      <Field label="Matter Name *">
        {!matterNameLocked ? (
          <>
            <input
              name="matter_name"
              value={form.matter_name}
              onChange={handleChange}
              placeholder="Enter Complainant Name (e.g. ABC)"
              style={styles.input}
            />

            {/* OPPOSITE PARTIES */}
            <div style={{ marginTop: 12 }}>
              {oppositeParties.map((party, index) => (
                <div key={index} style={styles.partyCard}>
                  <div style={styles.partyTitle}>
                    Opposite Party No. {index + 1}
                  </div>

                  <input
                    placeholder="Name"
                    value={party.name}
                    onChange={(e) =>
                      updateOppositeParty(index, "name", e.target.value)
                    }
                    style={styles.input}
                  />

                  <input
                    placeholder="Address"
                    value={party.address}
                    onChange={(e) =>
                      updateOppositeParty(index, "address", e.target.value)
                    }
                    style={styles.input}
                  />

                  <input
                    placeholder="Phone"
                    value={party.phone}
                    onChange={(e) =>
                      updateOppositeParty(index, "phone", e.target.value)
                    }
                    style={styles.input}
                  />

                  <input
                    placeholder="Email"
                    value={party.email}
                    onChange={(e) =>
                      updateOppositeParty(index, "email", e.target.value)
                    }
                    style={styles.input}
                  />

                  {oppositeParties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOppositeParty(index)}
                      style={styles.removeBtn}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addOppositeParty}
                style={styles.compactAddBtn}
              >
                + Add Opposite Party
              </button>
            </div>

            {/* SAVE BUTTON */}
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={handleSaveMatterName}
                style={styles.primaryBtn}
              >
                Save Matter Name
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              value={savedMatterName}
              readOnly
              style={styles.textarea}
            />

            <button
              type="button"
              onClick={handleEditMatterName}
              style={styles.compactAddBtn}
            >
              Edit
            </button>
          </>
        )}
      </Field>
    </div>

  </div>
</Section>

          <Section title="Forum Details">
            <div style={{ marginBottom: 10 }}>
              <label style={styles.label}>Forum Category</label>
              <select
                value={form.court_mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    court_mode: e.target.value,
                    forum_id: "",
                    forum_type_id: "",
                    state_id: "",
                    district_id: "",
                  })
                }
                style={styles.input}
              >
                <option value="consumer">Consumer Forum</option>
                <option value="court">Court</option>
              </select>
            </div>

            {/* ROW 1 */}
            {form.court_mode === "consumer" && (
              <>
            <div style={styles.basicGrid}>
              <Field label="Forum Type">
                <select
                  name="forum_type_id"
                  value={form.forum_type_id?.toString() || ""}
                  onChange={handleChange}
                  style={styles.input}
                >
                  <option value="">Select</option>
                  {forumTypes
                    .filter(ft => [1, 2, 3].includes(Number(ft.id)))
                    .map(ft => (
                      <option key={ft.id} value={String(ft.id)}>
                        {ft.name}
                      </option>
                  ))}
                </select>
              </Field>

              {showAddState && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="New state name"
                    value={newStateName}
                    onChange={(e) => setNewStateName(e.target.value)}
                    style={{ ...styles.input, flex: 1 }}
                  />

                  <button
                    type="button"
                    onClick={handleAddState}
                    style={styles.primaryBtn}
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddState(false);
                      setNewStateName("");
                    }}
                    style={styles.compactAddBtn}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {Number(form.forum_type_id) !== NCDRC && (
                <Field label="State">
                  <div style={styles.inlineFieldCompact}>
                    <select
                      value={form.state_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          state_id: Number(e.target.value),
                          district_id: "",
                          forum_id: "",
                        })
                      }
                      style={{ ...styles.input, flex: 1 }}
                    >
                      <option value="">Select State</option>
                      {states.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowAddState(prev => !prev)}
                      style={styles.compactAddBtn}
                    >
                      + Add
                    </button>
                  </div>

                  {showAddState && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="New state name"
                        value={newStateName}
                        onChange={(e) => setNewStateName(e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                      />

                      <button onClick={handleAddState} style={styles.primaryBtn}>Save</button>

                      <button
                        onClick={() => {
                          setShowAddState(false);
                          setNewStateName("");
                        }}
                        style={styles.compactAddBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </Field>
              )}
            </div>
            </>
          )}

          {form.court_mode === "court" && (
            <div style={styles.basicGrid}>

              <Field label="Court Type">
                <select
                  value={form.forum_type_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      forum_type_id: e.target.value,
                      forum_id: "",
                      state_id: "",
                      district_id: "",
                    })
                  }
                  style={styles.input}
                >
                  <option value="">Select Court</option>

                  {forumTypes
                    .filter(ft => ![1, 2, 3].includes(Number(ft.id))) // exclude consumer
                    .map(ft => (
                      <option key={ft.id} value={ft.id}>
                        {ft.name}
                      </option>
                    ))}
                </select>
              </Field>

              {/* STATE */}
              <Field label="State">
                <div style={styles.inlineFieldCompact}>
                  <select
                    value={form.state_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        state_id: Number(e.target.value),
                        district_id: "",
                        forum_id: "",
                      })
                    }
                    style={{ ...styles.input, flex: 1 }}
                  >
                    <option value="">Select State</option>
                    {states.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddState(prev => !prev)}
                    style={styles.compactAddBtn}
                  >
                    + Add
                  </button>
                </div>

                {showAddState && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="New state name"
                      value={newStateName}
                      onChange={(e) => setNewStateName(e.target.value)}
                      style={{ ...styles.input, flex: 1 }}
                    />

                    <button onClick={handleAddState} style={styles.primaryBtn}>
                      Save
                    </button>

                    <button
                      onClick={() => {
                        setShowAddState(false);
                        setNewStateName("");
                      }}
                      style={styles.compactAddBtn}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Field>

              {/* DISTRICT (ONLY FOR DISTRICT COURT) */}
              {forumTypes.find(ft => Number(ft.id) === Number(form.forum_type_id))?.name === "District Court" && (
                <Field label="District">
                  <div style={styles.inlineFieldCompact}>
                    <select
                      value={form.district_id}
                      onChange={(e) =>
                        setForm({ ...form, district_id: Number(e.target.value) })
                      }
                      style={{ ...styles.input, flex: 1 }}
                    >
                      <option value="">Select District</option>
                      {districts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowAddDistrict(prev => !prev)}
                      style={styles.compactAddBtn}
                    >
                      + Add
                    </button>
                  </div>

                  {showAddDistrict && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="New district"
                        value={newDistrictName}
                        onChange={(e) => setNewDistrictName(e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                      />

                      <button onClick={handleAddDistrict} style={styles.primaryBtn}>
                        Save
                      </button>

                      <button
                        onClick={() => {
                          setShowAddDistrict(false);
                          setNewDistrictName("");
                        }}
                        style={styles.compactAddBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </Field>
              )}

              <Field label="Court / Forum *">
                <div style={styles.inlineFieldCompact}>
                  <select
                    name="forum_id"
                    value={form.forum_id}
                    onChange={handleChange}
                    style={{ ...styles.input, flex: 1 }}
                  >
                    <option value="">Select Court</option>
                    {forums.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddForum(prev => !prev)}
                    style={styles.compactAddBtn}
                  >
                    + Add
                  </button>
                </div>

                {showAddForum && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="New court / forum"
                      value={newForumName}
                      onChange={(e) => setNewForumName(e.target.value)}
                      style={{ ...styles.input, flex: 1 }}
                    />

                    <button onClick={handleAddForum} style={styles.primaryBtn}>
                      Save
                    </button>

                    <button
                      onClick={() => {
                        setShowAddForum(false);
                        setNewForumName("");
                      }}
                      style={styles.compactAddBtn}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Field>

            </div>
          )}

            {/* ROW 2 */}
            {form.court_mode === "consumer" && (
            <div style={styles.basicGrid}>
              <Field label="District">
                  <div style={styles.inlineFieldCompact}>
                    <select
                      value={form.district_id}
                      onChange={(e) =>
                        setForm({ ...form, district_id: Number(e.target.value) })
                      }
                      style={{ ...styles.input, flex: 1 }}
                    >
                      <option value="">Select City</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setShowAddDistrict(prev => !prev)}
                      style={styles.compactAddBtn}
                    >
                      + Add
                    </button>
                  </div>

                  {showAddDistrict && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <input
                        type="text"
                        placeholder="New district"
                        value={newDistrictName}
                        onChange={(e) => setNewDistrictName(e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                      />

                      <button
                        type="button"
                        onClick={handleAddDistrict}
                        style={styles.primaryBtn}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddDistrict(false);
                          setNewDistrictName("");
                        }}
                        style={styles.compactAddBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </Field>

              <Field label="Forum *">
                <div style={styles.inlineFieldCompact}>
                  <select
                    name="forum_id"
                    value={form.forum_id}
                    onChange={handleChange}
                    style={{ ...styles.input, flex: 1 }}
                  >
                    <option value="">Select</option>
                    {forums.map(f => (
                      <option key={f.id} value={String(f.id)}>{f.name}</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setShowAddForum(prev => !prev)}
                    style={styles.compactAddBtn}
                  >
                    + Add
                  </button>
                </div>

                {showAddForum && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input
                      type="text"
                      placeholder="New forum"
                      value={newForumName}
                      onChange={(e) => setNewForumName(e.target.value)}
                      style={{ ...styles.input, flex: 1 }}
                    />

                    <button
                      type="button"
                      onClick={handleAddForum}
                      style={styles.primaryBtn}
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForum(false);
                        setNewForumName("");
                      }}
                      style={styles.compactAddBtn}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </Field>
            </div>
          )}

            {/* ROW 3 */}
            <div style={styles.grid2Compact}>
              <Field label="Case Number *">
                <div style={styles.caseWrapper}>
                  <div style={styles.caseInputGroup}>
                    <div style={styles.inlineFieldCompact}>
                      <select
                        name="case_prefix"
                        value={form.case_prefix}
                        onChange={handleChange}
                        disabled={caseNoLocked}
                        style={styles.caseSmall}
                      >
                        <option value="">Select</option>
                        {caseCategories.map((c, i) => (
                          <option key={i} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setShowAddCategory(prev => !prev)}
                        style={styles.compactAddBtn}
                      >
                        + Add
                      </button>
                    </div>

                    <span style={styles.caseDivider}>/</span>

                    <input
                      name="case_number"
                      type="number"
                      value={form.case_number}
                      onChange={handleChange}
                      disabled={caseNoLocked}
                      style={styles.caseMedium}
                      placeholder="Number"
                    />

                    <span style={styles.caseDivider}>/</span>

                    <input
                      name="case_year"
                      type="number"
                      value={form.case_year}
                      onChange={handleChange}
                      disabled={caseNoLocked}
                      style={styles.caseSmall}
                    />
                  </div>

                  <div style={styles.caseBtnRight}>
                    {!caseNoLocked ? (
                      <button type="button" onClick={handleSaveCaseNo} style={styles.primaryBtn}>
                        Save
                      </button>
                    ) : (
                      <button type="button" onClick={handleEditCaseNo} style={styles.compactAddBtn}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {showAddCategory && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <input
                          placeholder="Enter category (e.g. IA)"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value.toUpperCase())}
                          style={{ ...styles.input, flex: 1 }}
                        />

                        <button
                          type="button"
                          onClick={() => {
                            if (!newCategory.trim()) {
                              alert("Enter category");
                              return;
                            }

                            if (caseCategories.map(c => c.toUpperCase()).includes(newCategory.toUpperCase())) {
                              alert("Already exists");
                              return;
                            }

                            const updated = [...caseCategories, newCategory];
                            setCaseCategories(updated);
                            localStorage.setItem("caseCategories", JSON.stringify(updated));

                            setForm(prev => ({
                              ...prev,
                              case_prefix: newCategory
                            }));

                            setNewCategory("");
                            setShowAddCategory(false);
                            setCaseNoLocked(false);
                          }}
                          style={styles.primaryBtn}
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategory(false);
                            setNewCategory("");
                          }}
                          style={styles.secondaryBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                <div style={styles.hint}>Format: CC / 123 / 2024</div>

                {savedCaseNo && (
                  <div style={styles.savedCaseNo}>
                    Saved: {savedCaseNo}
                  </div>
                )}
              </Field>

              <div />
            </div>

          </Section>

          <Section title="Dates & Status">
            <div style={styles.basicGrid}>
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
          </Section>

          {(jurisdictionHint || jurisdictionLoading) && (
            <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 10 }}>
              {jurisdictionLoading ? "Checking jurisdiction..." : jurisdictionHint}
            </div>
          )}

          <Section title="Prayer Clause">
            <Field label="Paste Prayer Clause from Complaint">
              <textarea
                value={prayerClause}
                onChange={(e) => setPrayerClause(e.target.value)}
                placeholder="Paste full prayer clause here..."
                style={styles.textarea}
              />
            </Field>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleSavePrayer}
                style={styles.primaryBtn}
              >
                Save Prayer
              </button>
            </div>

            {savedPrayer && (
              <div style={styles.savedBox}>
                Prayer clause saved successfully
              </div>
            )}
          </Section>

          <Section title="Financial">
            <Field label="Claim Amount">
              <input type="number" name="claim_amount" value={form.claim_amount} onChange={handleChange} style={styles.input}/>
            </Field>
          </Section>

          <Section title="Documents Upload">
            {documents.map((doc, index) => (
              <div key={index} style={styles.uploadRow}>
                <label style={styles.label}>
                  {index === 0
                    ? "Consumer Complaint"
                    : index === 1
                    ? "Annexures"
                    : "Additional Document"}
                </label>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(index, e.target.files[0])}
                  style={styles.fileInput}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddMoreDocuments}
              style={styles.compactAddBtn}
            >
              + Add More Documents
            </button>
          </Section>

          <div style={styles.actionRow}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ ...styles.primaryBtn, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Creating..." : "Create Matter"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ---------- COMPONENTS ---------- */

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

/* ---------- STYLES ---------- */

const styles = {
  wrapper: { background: "#f8fafc", minHeight: "100vh", padding: 24 },
  container: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 },

  headerCard: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  hTitle: { fontSize: 18, fontWeight: 800 },
  hSub: { fontSize: 13, color: "#64748b", marginTop: 4 },

  card: {
    background: "white",
    border: "1px solid #e6e8ef",
    borderRadius: 14,
    padding: 24,
  },

  section: {
    marginBottom: 24,
    display: "grid",
    gap: 14,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e293b",
  },

  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start" // 🔥 IMPORTANT FIX
  },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#64748b",
  },

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
  },

  actionRow: { marginTop: 10 },

  primaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    background: "#1d4ed8",
    color: "white",
    border: "none",
    fontWeight: 700,
    minHeight: 44,
  },

  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 600,
    minHeight: 44,
  },

  hint: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
  },

  savedCaseNo: {
    fontSize: 12,
    color: "#16a34a",
    marginTop: 6,
    fontWeight: 600,
  },

  inlineField: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  inlineAddRow: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },

  forumCaseRow: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr",
    gap: 16,
    marginTop: 8,
    alignItems: "start",
  },

  forumBox: {
    minWidth: 0,
  },

  caseNoBox: {
    minWidth: 0,
  },

  caseNoRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  addBtn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "white",
    fontWeight: 600,
    whiteSpace: "nowrap",
    minWidth: 72,
  },

  textarea: {
    width: "100%",
    minHeight: 120,
    padding: "12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    resize: "vertical",
  },

  savedBox: {
    marginTop: 10,
    fontSize: 12,
    color: "#16a34a",
    fontWeight: 600,
  },

  uploadRow: {
    display: "grid",
    gap: 6,
    marginBottom: 12,
  },

  fileInput: {
    padding: "8px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "white",
  },

  caseSmall: {
    width: 90,
    padding: "10px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "white",
  },

  caseMedium: {
    flex: 1,
    padding: "10px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "white",
  },

  caseRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },

  caseBtnRight: {
    minWidth: 90,
    display: "flex",
    justifyContent: "flex-end",
  },

  caseWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  caseInputGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    flex: 1,
  },

  caseDivider: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: 600,
  },

  grid2Compact: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    alignItems: "start",
  },

  inlineFieldCompact: {
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  },

  compactAddBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    fontWeight: 600,
    minHeight: 44,
    whiteSpace: "nowrap",
  },

  partyCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    display: "grid",
    gap: 8,
    minWidth: 0
  },

  partyTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: "#1e293b"
  },

  removeBtn: {
    color: "#dc2626",
    background: "none",
    border: "none",
    fontWeight: 600,
    cursor: "pointer"
  },

  basicGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
    alignItems: "start"
  },
};