import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  const [barCertificate, setBarCertificate] = useState(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    contact_name: "",
    designation: "",
    client_type: "Company",
    legal_name: "",
    registered_address: "",
    corporate_address: "",
    billing_address: "",
    isCorporateSame: true,
    isBillingSame: true,
    pan: "",
    accounts_name: "",
    accounts_email: "",
    accounts_mobile: "",
    reference: "",
    city: "",
    state: "",
    bar_registration_no: "",
    upi_details: "",
  });

  const [spocs, setSpocs] = useState([
    { name: "", email: "", mobile: "" },
  ]);

  const [panFile, setPanFile] = useState(null);
  const [passwordRules, setPasswordRules] = useState({
    length: false,
    capital: false,
    number: false,
    special: false,
    });

  function validatePassword(password) {
    const regex =
      /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{7,12}$/;
    return regex.test(password);
  }

  function addSpoc() {
    setSpocs([...spocs, { name: "", email: "", mobile: "" }]);
  }

  function updateSpoc(index, field, value) {
    const updated = [...spocs];
    updated[index][field] = value;
    setSpocs(updated);
  }

  function evaluatePassword(password) {
    const rules = {
        length: password.length >= 7 && password.length <= 12,
        capital: /[A-Z]/.test(password),
        number: /\d/.test(password),
        special: /[@$!%*?&]/.test(password),
    };

    setPasswordRules(rules);
    }

  async function handleSignup(e) {
    e.preventDefault();

    const payload = new FormData(); // ✅ FIX

    if (!form.email || !form.password) {
      alert("Email & password required");
      return;
    }

    if (!validatePassword(form.password)) {
      alert("Invalid password format");
      return;
    }

    try {
      setLoading(true);

      const API_BASE =
        import.meta.env.VITE_API_URL || "http://localhost:8000";

      const roleMap = {
        "Client": "client",
        "GNP Counsel": "lawyer",
        "Location Counsel": "lawyer",
        "Accounts": "accounts"
      };

      payload.append("role", roleMap[selectedRole] || "client");
      payload.append("email", form.email);
      payload.append("password", form.password);

      payload.append(
        "full_name",
        form.contact_name || form.legal_name || "User"
      );

      payload.append("designation", form.designation);
      payload.append("client_type", form.client_type);
      payload.append("legal_name", form.legal_name);
      payload.append("registered_address", form.registered_address);

      payload.append(
        "corporate_address",
        form.isCorporateSame
          ? form.registered_address
          : form.corporate_address
      );

      payload.append(
        "billing_address",
        form.isBillingSame
          ? form.registered_address
          : form.billing_address
      );

      payload.append("pan", form.pan);

      payload.append("accounts_name", form.accounts_name);
      payload.append("accounts_email", form.accounts_email);
      payload.append("accounts_mobile", form.accounts_mobile);
      payload.append("reference", form.reference);

      payload.append("spocs", JSON.stringify(spocs));

      // ✅ COUNSEL FIELDS
      payload.append("city", form.city);
      payload.append("state", form.state);
      payload.append("bar_registration_no", form.bar_registration_no);
      payload.append("upi_details", form.upi_details);

      // ✅ FILES
      if (panFile) payload.append("pan_file", panFile);
      if (barCertificate) payload.append("bar_certificate", barCertificate);

      console.log("Submitting FormData...");
      for (let pair of payload.entries()) {
        console.log(pair[0], pair[1]);
      }

      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        body: payload,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Signup failed");

      alert("Signup successful! Await admin approval.");
      navigate("/login");

    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={{ ...styles.card, position: "relative" }}>
        {/* ❌ CLOSE BUTTON */}
        <button
            onClick={() => navigate("/login")}
            style={styles.closeBtn}
        >
            ← Back
        </button>
        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2>Select Registration Type</h2>

            <div style={styles.roleGrid}>
              {["Client", "GNP Counsel", "Location Counsel", "Accounts"].map(
                (role) => (
                  <div
                    key={role}
                    style={styles.roleCard}
                    onClick={() => {
                      setSelectedRole(role);
                      setStep(2);
                    }}
                  >
                    {role}
                  </div>
                )
              )}
            </div>
          </>
        )}

        {step === 2 && selectedRole === "Client" && (
        <form
            onSubmit={handleSignup}
            style={{
                ...styles.form,
                gridTemplateColumns:
                window.innerWidth < 768 ? "1fr" : "1fr 1fr",
            }}
            >

            {/* ================= LEFT COLUMN ================= */}
            <div style={{ ...styles.section, gridColumn: "1" }}>
                <h3 style={styles.sectionTitle}>Client Information</h3>

                <input
                placeholder="Full Legal Name of the Company"
                value={form.legal_name}
                onChange={(e) =>
                    setForm({ ...form, legal_name: e.target.value })
                }
                style={styles.input}
                />

                <select
                value={form.client_type}
                onChange={(e) =>
                    setForm({ ...form, client_type: e.target.value })
                }
                style={styles.input}
                >
                <option>Private Limited Company</option>
                <option>Public Limited Company</option>
                <option>LLP</option>
                <option>Partnership</option>
                <option>Proprietorship</option>
                </select>

                <textarea
                placeholder="Registered Address"
                value={form.registered_address}
                onChange={(e) => {
                  const value = e.target.value;

                  setForm({
                    ...form,
                    registered_address: value,

                    // ✅ AUTO SYNC
                    corporate_address: form.isCorporateSame
                      ? value
                      : form.corporate_address,

                    billing_address: form.isBillingSame
                      ? value
                      : form.billing_address,
                  });
                }}
                style={styles.input}
                />

                {/* ✅ CORPORATE ADDRESS SAME CHECKBOX */}
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.isCorporateSame}
                    onChange={(e) => {
                      const checked = e.target.checked;

                      setForm({
                        ...form,
                        isCorporateSame: checked,
                        corporate_address: checked
                          ? form.registered_address   // ✅ AUTO-FILL
                          : "",                       // optional clear
                      });
                    }}
                  />{" "}
                  Same as Registered Address
                </label>

                {!form.isCorporateSame && (
                  <textarea
                    placeholder="Corporate Address"
                    value={form.corporate_address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        corporate_address: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                )}

                <input
                placeholder="Contact Person Name"
                value={form.contact_name}
                onChange={(e) =>
                    setForm({ ...form, contact_name: e.target.value })
                }
                style={styles.input}
                />

                <input
                placeholder="Designation"
                value={form.designation}
                onChange={(e) =>
                    setForm({ ...form, designation: e.target.value })
                }
                style={styles.input}
                />

                <div>
                <label style={{ fontSize: 12, color: "#6b7280" }}>
                    Login Email Address
                </label>

                <input
                    type="email"
                    required
                    placeholder="Desired Login email"
                    value={form.email || ""}
                    onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                    }
                    style={styles.input}
                />
                </div>
                
                <div style={{ position: "relative" }}>
                <input
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onFocus={() => setShowPasswordHint(true)}
                    onBlur={() => setShowPasswordHint(false)}
                    onChange={(e) => {
                    const value = e.target.value;
                    setForm({ ...form, password: value });
                    evaluatePassword(value);
                    }}
                    style={styles.input}
                />
                <div style={styles.strengthBarWrapper}>
                <div
                    style={{
                    ...styles.strengthBar,
                    width: `${
                        Object.values(passwordRules).filter(Boolean).length * 25
                    }%`,
                    background:
                        Object.values(passwordRules).filter(Boolean).length <= 2
                        ? "#ef4444"
                        : Object.values(passwordRules).filter(Boolean).length === 3
                        ? "#f59e0b"
                        : "#10b981",
                    }}
                />
                </div>

                {showPasswordHint && (
                    <div style={styles.tooltip}>
                    Password must contain:
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li style={{ color: passwordRules.length ? "green" : "red" }}>
                        {passwordRules.length ? "✓" : "✗"} 7–12 characters
                    </li>
                    <li style={{ color: passwordRules.capital ? "green" : "red" }}>
                        {passwordRules.capital ? "✓" : "✗"} 1 capital letter
                    </li>
                    <li style={{ color: passwordRules.number ? "green" : "red" }}>
                        {passwordRules.number ? "✓" : "✗"} 1 number
                    </li>
                    <li style={{ color: passwordRules.special ? "green" : "red" }}>
                        {passwordRules.special ? "✓" : "✗"} 1 special character
                    </li>
                    </ul>
                    </div>
                )}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                <div style={{ color: form.password.length >= 7 ? "green" : "red" }}>
                    ✔ 7–12 characters
                </div>
                <div style={{ color: /[A-Z]/.test(form.password) ? "green" : "red" }}>
                    ✔ 1 uppercase letter
                </div>
                <div style={{ color: /\d/.test(form.password) ? "green" : "red" }}>
                    ✔ 1 number
                </div>
                <div style={{ color: /[@$!%*?&]/.test(form.password) ? "green" : "red" }}>
                    ✔ 1 special character
                </div>
                </div>

                {/* ✅ BILLING ADDRESS SAME CHECKBOX */}
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={form.isBillingSame}
                    onChange={(e) => {
                      const checked = e.target.checked;

                      setForm({
                        ...form,
                        isBillingSame: checked,
                        billing_address: checked
                          ? form.registered_address   // ✅ AUTO-FILL
                          : "",
                      });
                    }}
                  />{" "}
                  Same as Registered Address
                </label>

                {!form.isBillingSame && (
                  <textarea
                    placeholder="Billing Address"
                    value={form.billing_address}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        billing_address: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                )}

                <input
                placeholder="PAN Number"
                value={form.pan}
                onChange={(e) =>
                    setForm({ ...form, pan: e.target.value })
                }
                style={styles.input}
                />

                <div>
                <label style={styles.label}>Upload PAN Card</label>
                <div style={styles.fileRow}>

                <label style={styles.fileBtn}>
                    Choose File
                    <input
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) =>
                        setPanFile(e.target.files?.[0] || null)
                    }
                    />
                </label>

                {panFile && (
                    <span style={styles.fileName}>{panFile.name}</span>
                )}
                </div>
                </div>
            </div>

            {/* ================= RIGHT COLUMN ================= */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* SPOC */}
                <div style={styles.section}>
                <h4 style={styles.sectionTitle}>SPOC Details</h4>

                {spocs.map((s, i) => (
                    <div key={i} style={styles.spocBox}>
                    <input
                        placeholder="Name"
                        value={s.name || ""}
                        onChange={(e) =>
                            updateSpoc(i, "name", e.target.value)
                        }
                        />

                        <input
                        placeholder="Email"
                        value={s.email || ""}
                        onChange={(e) =>
                            updateSpoc(i, "email", e.target.value)
                        }
                        />

                        <input
                        placeholder="Mobile"
                        value={s.mobile || ""}
                        onChange={(e) =>
                            updateSpoc(i, "mobile", e.target.value)
                        }
                        />
                    </div>
                ))}

                <button
                    type="button"
                    style={styles.secondaryBtn}
                    onClick={addSpoc}
                >
                    + Add SPOC
                </button>
                </div>

                {/* ACCOUNTS */}
                <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Billing Details</h4>

                <input
                    placeholder="Billing - Contact Person"
                    style={styles.input}
                    value={form.accounts_name || ""}
                    onChange={(e) =>
                        setForm({
                        ...form,
                        accounts_name: e.target.value,
                        })
                    }
                    />

                    <label style={styles.label}>Contact Email</label>
                    <input
                    placeholder="Contact Person Email"
                    style={styles.input}
                    value={form.accounts_email || ""}
                    onChange={(e) =>
                        setForm({
                        ...form,
                        accounts_email: e.target.value,
                        })
                    }
                    />

                    <label style={styles.label}>Contact Mobile</label>
                    <input
                    placeholder="Contact Person Mobile"
                    style={styles.input}
                    value={form.accounts_mobile || ""}
                    onChange={(e) =>
                        setForm({
                        ...form,
                        accounts_mobile: e.target.value,
                        })
                    }
                    />

                    <label style={styles.label}>Who do you know at GNP Legal</label>
                    <input
                    placeholder="Reference Contact @ GNP Legal (optional)"
                    style={styles.input}
                    value={form.reference || ""}
                    onChange={(e) =>
                        setForm({ ...form, reference: e.target.value })
                    }
                    />
                </div>

            </div>

            {/* SUBMIT */}
            <button
                type="submit"
                disabled={loading}
                style={styles.submitBtn}
            >
                {loading ? "Submitting..." : "Create Account"}
            </button>

            </form>
        )}

        {step === 2 && ["GNP Counsel", "Location Counsel"].includes(selectedRole) && (
        <form
            onSubmit={handleSignup}
            style={{
            ...styles.form,
            gridTemplateColumns:
                window.innerWidth < 768 ? "1fr" : "1fr 1fr",
            }}
        >

            {/* LEFT COLUMN */}
            <div style={{ ...styles.section }}>
            <h3 style={styles.sectionTitle}>Counsel Information</h3>

            <input
                placeholder="Full Name"
                value={form.contact_name}
                onChange={(e) =>
                setForm({ ...form, contact_name: e.target.value })
                }
                style={styles.input}
            />

            <input
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                setForm({ ...form, email: e.target.value })
                }
                style={styles.input}
            />

            <div style={{ position: "relative" }}>
                <input
                type="password"
                placeholder="Password"
                value={form.password}
                onFocus={() => setShowPasswordHint(true)}
                onBlur={() => setShowPasswordHint(false)}
                onChange={(e) => {
                    const value = e.target.value;
                    setForm({ ...form, password: value });
                    evaluatePassword(value);
                }}
                style={styles.input}
                />

                {/* strength bar */}
                <div style={styles.strengthBarWrapper}>
                <div
                    style={{
                    ...styles.strengthBar,
                    width: `${
                        Object.values(passwordRules).filter(Boolean).length * 25
                    }%`,
                    background:
                        Object.values(passwordRules).filter(Boolean).length <= 2
                        ? "#ef4444"
                        : Object.values(passwordRules).filter(Boolean).length === 3
                        ? "#f59e0b"
                        : "#10b981",
                    }}
                />
                </div>

                {showPasswordHint && (
                <div style={styles.tooltip}>
                    Password must contain:
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li style={{ color: passwordRules.length ? "green" : "red" }}>
                        7–12 characters
                    </li>
                    <li style={{ color: passwordRules.capital ? "green" : "red" }}>
                        1 capital letter
                    </li>
                    <li style={{ color: passwordRules.number ? "green" : "red" }}>
                        1 number
                    </li>
                    <li style={{ color: passwordRules.special ? "green" : "red" }}>
                        1 special character
                    </li>
                    </ul>
                </div>
                )}
            </div>

            <input
                placeholder="Phone"
                value={form.accounts_mobile}
                onChange={(e) =>
                setForm({ ...form, accounts_mobile: e.target.value })
                }
                style={styles.input}
            />

            <input
                placeholder="Alternate Phone"
                value={form.reference}
                onChange={(e) =>
                setForm({ ...form, reference: e.target.value })
                }
                style={styles.input}
            />
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={styles.section}>
                <h4 style={styles.sectionTitle}>Professional Details</h4>

                <input
                placeholder="City"
                style={styles.input}
                />

                <input
                placeholder="State"
                style={styles.input}
                />

                <textarea
                placeholder="Postal Address"
                style={styles.input}
                />

                <input
                placeholder="Bar Registration Number"
                style={styles.input}
                />

                <input
                placeholder="PAN Number"
                style={styles.input}
                />

                <input
                placeholder="UPI Details"
                style={styles.input}
                />

                <div style={styles.fileRow}>
                <span style={styles.label}>Upload PAN Card</span>

                <label style={styles.fileBtn}>
                    Choose File
                    <input
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) =>
                        setPanFile(e.target.files?.[0] || null)
                    }
                    />
                </label>

                {panFile && (
                    <span style={styles.fileName}>{panFile.name}</span>
                )}
                </div>

                <div style={styles.fileRow}>
                <span style={styles.label}>
                    Upload Bar Registration Certificate
                </span>

                <label style={styles.fileBtn}>
                    Choose File
                    <input
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) =>
                        setBarCertificate(e.target.files?.[0] || null)
                    }
                    />
                </label>

                {barCertificate && (
                    <span style={styles.fileName}>
                    {barCertificate.name}
                    </span>
                )}
                </div>
            </div>
            </div>

            <button
            type="submit"
            disabled={loading}
            style={styles.submitBtn}
            >
            {loading ? "Submitting..." : "Register Counsel"}
            </button>

        </form>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #1e3a8a, #0f172a)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    },

  card: {
    background: "white",
    padding: 32,
    borderRadius: 20,
    width: "100%",
    maxWidth: 900,
    boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
    },

  form: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    },

  fullWidth: {
    gridColumn: "1 / span 2",
  },

  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    fontSize: 14,
    outline: "none",
    transition: "all 0.2s ease",
  },

  roleGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  roleCard: {
    padding: 20,
    border: "1px solid #ddd",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "center",
    fontWeight: 600,
  },

  spocBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
    marginBottom: 6,
  },

  tooltip: {
    position: "absolute",
    top: "110%",
    left: 0,
    background: "#111827",
    color: "white",
    padding: "10px",
    borderRadius: "8px",
    fontSize: "12px",
    width: "260px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
    zIndex: 10,
  },

  section: {
    background: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    },

    sectionTitle: {
    fontWeight: 600,
    fontSize: 16,
    color: "#111827",
    },

    submitBtn: {
    gridColumn: "1 / -1",
    padding: "14px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    },

    secondaryBtn: {
    padding: "10px",
    borderRadius: 8,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
    fontWeight: 500,
    },

    strengthBarWrapper: {
    height: 6,
    background: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 6,
    },

    strengthBar: {
    height: "100%",
    transition: "all 0.3s ease",
    },

    closeBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    background: "transparent",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    color: "#6b7280",
    fontWeight: 600,
    },

    label: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
    },

    fileRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    },

    fileBtn: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    padding: "6px 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    },

    fileName: {
    fontSize: 12,
    color: "#374151",
    maxWidth: 150,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    },
};