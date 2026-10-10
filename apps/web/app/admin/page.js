"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publicApiUrl, publicAssetUrl } from "../../lib/api";
import AdminAnalytics from "../../components/AdminAnalytics";

const emptyProperty = {
  title: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  price: "",
  beds: "",
  baths: "",
  sqft: "",
  status: "Active",
  description: "",
  featured: false,
  images: [],
  id: "",
};
const request = (path, options = {}) =>
  fetch(publicApiUrl(path), { credentials: "include", ...options });
function Panel({ title, children }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function Admin() {
  const router = useRouter();
  const uploadRef = useRef();
  const workbookRef = useRef();
  const driveFolderRef = useRef();
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState({
    properties: [],
    leads: [],
    logs: [],
    users: [],
    user: null,
  });
  const [property, setProperty] = useState(emptyProperty);
  const [notice, setNotice] = useState("");
  const [importingWorkbook, setImportingWorkbook] = useState(false);
  const [importingDriveImages, setImportingDriveImages] = useState(false);

  async function load() {
    try {
      const me = await request("auth/me");
      if (!me.ok) return router.push("/admin/login");
      const user = await me.json();
      const [properties, leads, logs, users] = await Promise.all(
        [
          "admin/properties",
          "admin/leads",
          "admin/logs",
          user.role === "admin" ? "admin/users" : null,
        ].map((path) =>
          path
            ? request(path).then((response) => response.json())
            : Promise.resolve([]),
        ),
      );
      setData({ properties, leads, logs, users, user });
    } catch {
      router.push("/admin/login");
    }
  }
  useEffect(() => {
    load();
  }, []);

  const updateProperty = (event) =>
    setProperty((value) => ({
      ...value,
      [event.target.name]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));
  const editProperty = (record) => {
    setProperty({
      id: record._id,
      title: record.title || "",
      street: record.address?.street || "",
      city: record.address?.city || "",
      state: record.address?.state || "",
      zip: record.address?.zip || "",
      price: record.price || "",
      beds: record.beds || "",
      baths: record.baths || "",
      sqft: record.sqft || "",
      status: record.status || "Active",
      description: record.description || "",
      featured: Boolean(record.featured),
      images: record.images || [],
    });
    setTab("properties");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  async function saveProperty(event) {
    event.preventDefault();
    setNotice("Saving property…");
    try {
      let images = property.images;
      if (uploadRef.current?.files?.length) {
        const upload = new FormData();
        Array.from(uploadRef.current.files).forEach((file) =>
          upload.append("images", file),
        );
        const response = await request("admin/uploads", {
          method: "POST",
          body: upload,
        });
        if (!response.ok) throw new Error("Image upload failed.");
        const result = await response.json();
        images = [...images, ...result.paths];
      }
      const body = {
        title: property.title,
        address: {
          street: property.street,
          city: property.city,
          state: property.state,
          zip: property.zip,
        },
        price: property.price ? Number(property.price) : undefined,
        beds: property.beds ? Number(property.beds) : undefined,
        baths: property.baths ? Number(property.baths) : undefined,
        sqft: property.sqft ? Number(property.sqft) : undefined,
        status: property.status,
        description: property.description,
        featured: property.featured,
        images,
        manualOverrides: { price: true, description: true, images: true },
      };
      const response = await request(
        property.id ? `admin/properties/${property.id}` : "admin/properties",
        {
          method: property.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error("Property could not be saved.");
      setProperty(emptyProperty);
      if (uploadRef.current) uploadRef.current.value = "";
      setNotice("Property saved.");
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  }
  async function removeProperty(id) {
    if (!window.confirm("Delete this property? This cannot be undone.")) return;
    const response = await request(`admin/properties/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setNotice("Property deleted.");
      await load();
    } else setNotice("Property could not be deleted.");
  }
  async function removeImage(image) {
    if (!property.id)
      return setProperty((value) => ({
        ...value,
        images: value.images.filter((path) => path !== image),
      }));
    const images = property.images.filter((path) => path !== image);
    const response = await request(`admin/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images, manualOverrides: { images: true } }),
    });
    if (!response.ok) return setNotice("Image could not be removed.");
    await request(`admin/uploads/${image.split("/").pop()}`, {
      method: "DELETE",
    });
    setProperty((value) => ({ ...value, images }));
    await load();
  }
  async function createUser(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const response = await request("admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fields.get("email"),
        password: fields.get("password"),
        role: fields.get("role"),
      }),
    });
    if (response.ok) {
      event.currentTarget.reset();
      setNotice("Staff account created.");
      await load();
    } else setNotice("Staff account could not be created.");
  }
  async function toggleUser(user) {
    const response = await request(`admin/users/${user._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: user.role, active: !user.active }),
    });
    if (response.ok) await load();
    else setNotice("Staff account could not be updated.");
  }
  async function importWorkbook(event) {
    event.preventDefault();
    const file = workbookRef.current?.files?.[0];
    if (!file) return setNotice("Choose the Homes By Gurmeet portfolio .xlsx workbook first.");
    setImportingWorkbook(true);
    setNotice("Validating and replacing the complete listing dataset…");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await request("admin/listings/import", {
        method: "POST",
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Workbook import failed.");
      if (workbookRef.current) workbookRef.current.value = "";
      setNotice(`Portfolio workbook imported: ${result.totalListings} listings (${result.created} created, ${result.updated} updated, ${result.removed} removed${result.ignored ? `, ${result.ignored} ignored` : ""}).`);
      await load();
    } catch (error) {
      setNotice(error.message || "Workbook import failed.");
    } finally {
      setImportingWorkbook(false);
    }
  }
  async function importDriveImages(event) {
    event.preventDefault();
    const folderUrl = driveFolderRef.current?.value?.trim();
    if (!folderUrl) return setNotice("Enter a public Google Drive folder URL first.");
    setImportingDriveImages(true);
    setNotice("Listing and downloading Google Drive images…");
    try {
      const response = await request("admin/listings/drive-images-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderUrl }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Google Drive image import failed.");
      if (driveFolderRef.current) driveFolderRef.current.value = "";
      setNotice(`Google Drive images imported: ${result.downloaded} downloaded, ${result.matched} properties matched, ${result.updated} updated${result.ignored ? `, ${result.ignored} ignored` : ""}.`);
      await load();
    } catch (error) {
      setNotice(error.message || "Google Drive image import failed.");
    } finally {
      setImportingDriveImages(false);
    }
  }

  const propertyName = property.title || property.street || 'this property';
  if (!data.user) return null;
  return (
    <div className="admin">
      <aside className="sidebar">
        <div className="brand">
          HOMES<span>BY</span>GURMEET
        </div>
        {[
          "dashboard",
          "analytics",
          "properties",
          "leads",
          "sync",
          ...(data.user.role === "admin" ? ["staff"] : []),
        ].map((name) => (
          <a
            key={name}
            onClick={() => setTab(name)}
            style={{
              cursor: "pointer",
              color: tab === name ? "#fff" : undefined,
            }}
          >
            {name[0].toUpperCase() + name.slice(1)}
          </a>
        ))}
        <a href="/">View site</a>
      </aside>
      <main className="admin-main">
        <p className="eyebrow">{data.user.role} account</p>
        <h1>{tab[0].toUpperCase() + tab.slice(1)}</h1>
        {notice && <p className="notice">{notice}</p>}
        {tab === "dashboard" && (
          <Panel title="Platform overview">
            <div className="grid three">
              <div className="stat">
                <b>{data.properties.length}</b>
                <small>Properties</small>
              </div>
              <div className="stat">
                <b>{data.leads.length}</b>
                <small>Leads</small>
              </div>
              <div className="stat">
                <b>{data.logs[0]?.status || "—"}</b>
                <small>Last data activity</small>
              </div>
            </div>
          </Panel>
        )}
        {tab === "analytics" && <AdminAnalytics />}
        {tab === "properties" && (
          <>
            <Panel title={property.id ? "Edit property" : "Add property"}>
              <form className="fields" onSubmit={saveProperty}>
                <input
                  required
                  name="title"
                  placeholder="Property title"
                  value={property.title}
                  onChange={updateProperty}
                />
                <div className="grid two">
                  <input
                    required
                    name="street"
                    placeholder="Street address"
                    value={property.street}
                    onChange={updateProperty}
                  />
                  <input
                    required
                    name="city"
                    placeholder="City"
                    value={property.city}
                    onChange={updateProperty}
                  />
                </div>
                <div className="grid two">
                  <input
                    name="state"
                    placeholder="State"
                    value={property.state}
                    onChange={updateProperty}
                  />
                  <input
                    name="zip"
                    placeholder="ZIP code"
                    value={property.zip}
                    onChange={updateProperty}
                  />
                </div>
                <div className="grid three">
                  <input
                    name="price"
                    type="number"
                    placeholder="Price"
                    value={property.price}
                    onChange={updateProperty}
                  />
                  <input
                    name="beds"
                    type="number"
                    placeholder="Beds"
                    value={property.beds}
                    onChange={updateProperty}
                  />
                  <input
                    name="baths"
                    type="number"
                    step=".5"
                    placeholder="Baths"
                    value={property.baths}
                    onChange={updateProperty}
                  />
                </div>
                <input
                  name="sqft"
                  type="number"
                  placeholder="Square feet"
                  value={property.sqft}
                  onChange={updateProperty}
                />
                <select
                  name="status"
                  value={property.status}
                  onChange={updateProperty}
                >
                  <option>Active</option>
                  <option>Pending</option>
                  <option>Sold</option>
                </select>
                <textarea
                  name="description"
                  placeholder="Description"
                  value={property.description}
                  onChange={updateProperty}
                />
                <label>
                  Listing images
                  <input
                    ref={uploadRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                  />
                </label>
              {property.images.length > 0 ? (
                <div className="admin-images">
                    {property.images.map((image) => (
                      <div key={image}>
                        <img src={publicAssetUrl(image)} alt="Listing" />
                        <button
                          type="button"
                          onClick={() => removeImage(image)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="image-request" role="status">
                  <svg aria-hidden="true" viewBox="0 0 64 64">
                    <rect x="8" y="12" width="48" height="40" rx="3" />
                    <circle cx="24" cy="26" r="5" />
                    <path d="m12 47 14-13 9 8 6-5 11 10" />
                  </svg>
                  <div>
                    <strong>Photos needed for {propertyName}</strong>
                    <p>Ask the owner to share images of this property, then upload them here.</p>
                  </div>
                </div>
              )}
                <label>
                  <input
                    name="featured"
                    type="checkbox"
                    checked={property.featured}
                    onChange={updateProperty}
                  />{" "}
                  Featured residence
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  <button className="btn">Save property</button>
                  {property.id && (
                    <button
                      type="button"
                      className="btn alt"
                      onClick={() => setProperty(emptyProperty)}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </Panel>
            <Panel title="All properties">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.properties.map((record) => (
                    <tr key={record._id}>
                      <td>{record.title || record.address?.street}</td>
                      <td>{record.status}</td>
                      <td>
                        {record.price
                          ? `$${record.price.toLocaleString()}`
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => editProperty(record)}
                        >
                          Edit
                        </button>{" "}
                        <button
                          className="text-button"
                          onClick={() => removeProperty(record._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}
        {tab === "leads" && (
          <Panel title="Captured leads">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Request</th>
                  <th>Contact and details</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead) => (
                  <tr key={lead._id}>
                    <td>{lead.name}</td>
                    <td>{lead.type}</td>
                    <td>
                      {lead.email}
                      <br />
                      {lead.phone}
                      {lead.property && (
                        <>
                          <br />
                          {lead.property.title}
                        </>
                      )}
                      {lead.message && (
                        <>
                          <br />
                          <em>{lead.message}</em>
                        </>
                      )}
                    </td>
                    <td>{new Date(lead.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
        {tab === "sync" && (
          <>
            <Panel title="Listing data">
              <p>Upload the Homes By Gurmeet portfolio workbook to replace the website listings.</p>
              <p className="muted">This workbook contains the complete Bought with Gurmeet and Sold by Gurmeet portfolio. Matching properties retain existing price, dimensions, coordinates, descriptions, and transaction dates when those fields are unavailable in the workbook. New properties are created as sold records with empty unavailable fields.</p>
              {data.user.role === "admin" ? (
                <>
                  <form className="fields workbook-imports" onSubmit={importWorkbook}>
                    <label>
                      Photo and portfolio workbook (.xlsx)
                      <small className="muted">Expected format: Homes By Gurmeet — Bought &amp; Sold Photos (251 listings).xlsx</small>
                      <input ref={workbookRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={importingWorkbook} />
                    </label>
                    <button className="btn" disabled={importingWorkbook || importingDriveImages}>{importingWorkbook ? "Importing portfolio workbook…" : "Replace listing dataset"}</button>
                  </form>
                  <p className="warning">Warning: this import is destructive. It replaces the complete public listing dataset, removes properties absent from the workbook, and sets imported properties to Sold. Invalid workbooks are rejected before any data changes.</p>
                  <div className="drive-import-panel">
                    <h3>Download folder images</h3>
                    <p className="muted">Enter a publicly accessible Google Drive folder. Image filenames should contain the property slug or normalized address. Only matched properties are updated; existing manually uploaded images are preserved.</p>
                    <form className="fields" onSubmit={importDriveImages}>
                      <input ref={driveFolderRef} type="url" placeholder="https://drive.google.com/drive/folders/..." disabled={importingDriveImages || importingWorkbook} aria-label="Google Drive folder URL" />
                      <button className="btn" disabled={importingDriveImages || importingWorkbook}>{importingDriveImages ? "Downloading folder images…" : "Download folder images"}</button>
                    </form>
                  </div>
                </>
              ) : (
                <p className="muted">Only administrators can replace listing data. You can review import activity below.</p>
              )}
            </Panel>
            <Panel title="Data activity history">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log._id}>
                      <td>{log.source}</td>
                      <td>{log.status}</td>
                      <td>{log.created}</td>
                      <td>{log.updated}</td>
                      <td>{log.error || "Completed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}
        {tab === "staff" && data.user.role === "admin" && (
          <>
            <Panel title="Add staff account">
              <form className="fields" onSubmit={createUser}>
                <input
                  required
                  name="email"
                  type="email"
                  placeholder="Staff email"
                />
                <input
                  required
                  name="password"
                  type="password"
                  minLength="8"
                  placeholder="Temporary password"
                />
                <select name="role">
                  <option value="editor">Editor</option>
                  <option value="admin">Administrator</option>
                </select>
                <button className="btn">Create account</button>
              </form>
            </Panel>
            <Panel title="Staff accounts">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user._id}>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.active ? "Active" : "Disabled"}</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => toggleUser(user)}
                        >
                          {user.active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
