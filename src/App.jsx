import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js"; 

// Initialize Supabase
const SUPABASE_URL = "https://gfswtgvsbvmuxywewxij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmc3d0Z3ZzYnZtdXh5d2V3eGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE2MjMsImV4cCI6MjA5NTU0NzYyM30.nxUmHtA4vpQ1zlj-Ok0OJr5Ry0pHKHCMES0Amf7Jrug";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_PIN = "1234"; 
const PRICE_PER_GRAM = 3;
const PRINT_SPEED_G_PER_HOUR = 10;

const MATERIALS = ["PLA", "PETG", "ABS", "TPU", "ASA", "Resin"];
const COLORS = ["White", "Black", "Gray", "Red", "Blue", "Green", "Yellow", "Orange", "Purple", "Pink", "Transparent", "Custom"];
const STATUS_ORDER = ["queued", "printing", "done", "delivered"];
const STATUS_LABELS = { queued: "Queued", printing: "Printing", done: "Done", delivered: "Delivered" };
const STATUS_COLORS = {
  queued: { bg: "#EEF2FF", text: "#4338CA", dot: "#6366F1" },
  printing: { bg: "#FFF7ED", text: "#C2410C", dot: "#F97316" },
  done: { bg: "#F0FDF4", text: "#15803D", dot: "#22C55E" },
  delivered: { bg: "#F8FAFC", text: "#475569", dot: "#94A3B8" },
};

function formatDate(ts) { return new Date(ts).toLocaleDateString("en-EG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
function calcPrice(grams, ppg) { return Math.ceil(grams * ppg); }
function calcPrintHours(grams, speed) { return grams / speed; }
function formatDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
}

export default function App() {
  const [view, setView] = useState("home");
  const [orders, setOrders] = useState([]); 
  const [pricePerGram, setPricePerGram] = useState(PRICE_PER_GRAM);
  const [printSpeed, setPrintSpeed] = useState(PRINT_SPEED_G_PER_HOUR);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [toast, setToast] = useState(null);
  const [trackOrderId, setTrackOrderId] = useState(null);
  const [dragOrder, setDragOrder] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [newOrder, setNewOrder] = useState({ name: "", phone: "", orderName: "", material: "PLA", color: "White", notes: "", fileName: "", weightGrams: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchOrders();
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("priority", { ascending: true });
    
    if (!error && data) setOrders(data);
  }

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const queuedByPriority = orders.filter(o => o.status === "queued").sort((a, b) => a.priority - b.priority);
  const printingNow = orders.find(o => o.status === "printing");

  function getQueueWaitHours(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.status !== "queued") return null;
    let wait = 0;
    if (printingNow) wait += calcPrintHours(printingNow.weightgrams || 0, printSpeed);
    const idx = queuedByPriority.findIndex(o => o.id === orderId);
    for (let i = 0; i < idx; i++) wait += calcPrintHours(queuedByPriority[i].weightgrams || 0, printSpeed);
    return wait;
  }

  function handleAdminLogin() {
    if (pinInput === ADMIN_PIN) { setIsAdmin(true); setView("admin"); setPinInput(""); setPinError(""); }
    else { setPinError("Wrong PIN. Try again."); setPinInput(""); }
  }

  async function handleStatusChange(id, newStatus) {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error) {
      showToast(`Order status updated to ${STATUS_LABELS[newStatus]}`);
    }
  }

  async function handleSetWeight(id, grams) {
    await supabase
      .from("orders")
      .update({ weightgrams: parseFloat(grams) || 0 })
      .eq("id", id);
  }

  function handleDragStart(e, id) { setDragOrder(id); }
  function handleDragEnd() { setDragOrder(null); setDragOver(null); }
  function handleDragOver(e, id) { e.preventDefault(); setDragOver(id); }
  
  async function handleDrop(e, targetId) {
    e.preventDefault();
    if (!dragOrder || dragOrder === targetId) return;
    const q = [...queuedByPriority];
    const fromIdx = q.findIndex(o => o.id === dragOrder);
    const toIdx = q.findIndex(o => o.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [item] = q.splice(fromIdx, 1);
    q.splice(toIdx, 0, item);
    
    const updates = q.map((o, i) => supabase.from("orders").update({ priority: i }).eq("id", o.id));
    await Promise.all(updates);
    setDragOrder(null); setDragOver(null);
  }

  async function handleDeleteOrder(id) {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (!error) {
      setConfirmDelete(null);
      showToast("Order deleted", "error");
    }
  }

  const filteredOrders = orders.filter(o => {
    const matchSearch = !searchQuery || o.name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.ordername?.toLowerCase().includes(searchQuery.toLowerCase()) || o.phone?.includes(searchQuery);
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: orders.length,
    queued: orders.filter(o => o.status === "queued").length,
    printing: orders.filter(o => o.status === "printing").length,
    done: orders.filter(o => o.status === "done").length,
    revenue: orders.filter(o => o.status !== "queued").reduce((sum, o) => sum + calcPrice(o.weightgrams || 0, o.pricepergram || pricePerGram), 0),
  };

  const styles = {
    app: { fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#F8FAFF", color: "#1E293B" },
    header: { background: "#1E1B4B", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100 },
    logo: { color: "#fff", fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
    nav: { display: "flex", gap: 4 },
    navBtn: (active) => ({ background: active ? "rgba(255,255,255,0.15)" : "transparent", border: "none", color: active ? "#fff" : "rgba(255,255,255,0.65)", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 400 }),
    main: { maxWidth: 960, margin: "0 auto", padding: "32px 20px" },
    card: { background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24, marginBottom: 20 },
    h2: { fontSize: 22, fontWeight: 700, color: "#1E1B4B", marginBottom: 20, marginTop: 0 },
    h3: { fontSize: 16, fontWeight: 600, color: "#1E293B", marginBottom: 12, marginTop: 0 },
    label: { fontSize: 13, fontWeight: 500, color: "#64748B", display: "block", marginBottom: 6 },
    input: { width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#FAFAFA", color: "#1E293B", transition: "border-color 0.2s" },
    select: { width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#FAFAFA", color: "#1E293B", appearance: "none" },
    btn: (variant = "primary") => ({
      display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.15s",
      ...(variant === "primary" && { background: "#6366F1", color: "#fff" }),
      ...(variant === "secondary" && { background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" }),
      ...(variant === "danger" && { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }),
      ...(variant === "success" && { background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0" }),
    }),
    badge: (status) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[status].bg, color: STATUS_COLORS[status].text }),
    statCard: { background: "#fff", borderRadius: 14, border: "1px solid #E2E8F0", padding: "16px 20px", flex: 1, minWidth: 120 },
    errorMsg: { fontSize: 12, color: "#DC2626", marginTop: 4 },
  };

  const HomeView = () => (
    <div>
      <div style={{ textAlign: "center", padding: "48px 20px 32px", background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)", borderRadius: 20, marginBottom: 28, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, background: "rgba(99,102,241,0.3)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: -30, left: -30, width: 150, height: 150, background: "rgba(99,102,241,0.2)", borderRadius: "50%" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🖨️</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-1px" }}>PrintQueue</h1>
          <p style={{ opacity: 0.8, fontSize: 16, margin: "0 0 28px" }}>3D Printing Order Management</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{ ...styles.btn(), padding: "12px 28px", fontSize: 15, borderRadius: 12, boxShadow: "0 4px 14px rgba(99,102,241,0.4)" }} onClick={() => setView("order")}>📦 Place an Order</button>
            <button style={{ ...styles.btn("secondary"), padding: "12px 28px", fontSize: 15, borderRadius: 12 }} onClick={() => setView("track")}>🔍 Track My Order</button>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { icon: "📋", label: "Total Orders", value: stats.total, color: "#6366F1" },
          { icon: "⏳", label: "In Queue", value: stats.queued, color: "#F97316" },
          { icon: "🖨️", label: "Printing Now", value: stats.printing, color: "#3B82F6" },
          { icon: "✅", label: "Completed", value: stats.done, color: "#22C55E" },
        ].map(s => (
          <div key={s.label} style={styles.statCard}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {printingNow && (
        <div style={{ ...styles.card, borderLeft: "4px solid #F97316" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: "#F97316", fontWeight: 600, marginBottom: 4 }}>🔥 CURRENTLY PRINTING</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{printingNow.ordername}</div>
              <div style={{ fontSize: 14, color: "#64748B" }}>{printingNow.material} · {printingNow.color} · {printingNow.weightgrams || 0}g · {formatDuration(calcPrintHours(printingNow.weightgrams || 0, printSpeed))}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#6366F1" }}>{calcPrice(printingNow.weightgrams || 0, printingNow.pricepergram || pricePerGram)} EGP</div>
              <div style={{ fontSize: 13, color: "#64748B" }}>{printingNow.name}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const OrderView = () => {
    const [localOrder, setLocalOrder] = useState(newOrder);
    const [localErrors, setLocalErrors] = useState({});
    const [step, setStep] = useState(1);
    const [fileError, setFileError] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);

    function validate1() {
      const e = {};
      if (!localOrder.name.trim()) e.name = "Name is required";
      if (!localOrder.phone.trim()) e.phone = "Phone number is required";
      setLocalErrors(e);
      return Object.keys(e).length === 0;
    }
    function validate2() {
      const e = {};
      if (!localOrder.orderName.trim()) e.orderName = "Order name is required";
      if (!selectedFile) e.fileName = "Please upload an STL file";
      setLocalErrors(e);
      return Object.keys(e).length === 0;
    }
    
    function handleFileChange(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".stl")) { setFileError("Only .stl files are accepted"); return; }
      setFileError("");
      setSelectedFile(file);
      setLocalOrder(prev => ({ ...prev, fileName: file.name }));
    }

    function handleNext() {
      if (step === 1 && validate1()) setStep(2);
      else if (step === 2 && validate2()) setStep(3);
    }

    async function handleFinalSubmit() {
      try {
        setIsUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("stl-files")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("stl-files").getPublicUrl(fileName);
        const fileUrl = urlData.publicUrl;

        // 👇 THIS IS THE MISSING PAYLOAD BLOCK 👇
        const payload = {
          name: localOrder.name,
          phone: localOrder.phone,
          ordername: localOrder.orderName,   
          material: localOrder.material,
          color: localOrder.color,
          notes: localOrder.notes,
          fileName: localOrder.fileName,     
          fileurl: fileUrl,                  
          weightgrams: 0,                    
          status: "queued",
          priority: queuedByPriority.length,
          pricepergram: pricePerGram         
        };

        const { data, error } = await supabase
          .from("orders")
          .insert([payload]) // <-- It was crashing here because payload was missing
          .select();

        if (error) throw error;

        // Instant UI update
        setOrders(prev => [...prev, data[0]]);

        showToast("Order submitted successfully!");
        setTrackOrderId(data[0].id);
        setView("track");
      } catch (err) {
        showToast("Upload failed, please try again", "error");
        console.error(err);
      } finally {
        setIsUploading(false);
      }
    }

    return (
      <div>
        <button style={{ ...styles.btn("secondary"), marginBottom: 20 }} onClick={() => setView("home")}>← Back</button>
        <div style={styles.card}>
          <h2 style={styles.h2}>📦 Place a New Order</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
            {[1,2,3].map(n => (
              <div key={n} style={{ flex: 1, height: 4, borderRadius: 4, background: n <= step ? "#6366F1" : "#E2E8F0", transition: "background 0.3s" }} />
            ))}
          </div>
          {step === 1 && (
            <div>
              <div style={styles.h3}>👤 Your Info</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={styles.label}>Full Name *</label>
                  <input style={{ ...styles.input, borderColor: localErrors.name ? "#DC2626" : "#E2E8F0" }} value={localOrder.name} onChange={e => setLocalOrder(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                  {localErrors.name && <div style={styles.errorMsg}>⚠ {localErrors.name}</div>}
                </div>
                <div>
                  <label style={styles.label}>Phone Number *</label>
                  <input style={{ ...styles.input, borderColor: localErrors.phone ? "#DC2626" : "#E2E8F0" }} value={localOrder.phone} onChange={e => setLocalOrder(p => ({ ...p, phone: e.target.value }))} placeholder="01X-XXXX-XXXX" />
                  {localErrors.phone && <div style={styles.errorMsg}>⚠ {localErrors.phone}</div>}
                </div>
              </div>
              <button style={styles.btn()} onClick={handleNext}>Next: Print Details →</button>
            </div>
          )}
          {step === 2 && (
            <div>
              <div style={styles.h3}>🖨️ Print Details</div>
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Order Name *</label>
                <input style={{ ...styles.input, borderColor: localErrors.orderName ? "#DC2626" : "#E2E8F0" }} value={localOrder.orderName} onChange={e => setLocalOrder(p => ({ ...p, orderName: e.target.value }))} placeholder="e.g. Phone Stand, Chess Knight…" />
                {localErrors.orderName && <div style={styles.errorMsg}>⚠ {localErrors.orderName}</div>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={styles.label}>Material</label>
                  <select style={styles.select} value={localOrder.material} onChange={e => setLocalOrder(p => ({ ...p, material: e.target.value }))}>
                    {MATERIALS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Color</label>
                  <select style={styles.select} value={localOrder.color} onChange={e => setLocalOrder(p => ({ ...p, color: e.target.value }))}>
                    {COLORS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={styles.label}>Upload STL File *</label>
                <label style={{ display: "block", border: `2px dashed ${localErrors.fileName ? "#DC2626" : "#C7D2FE"}`, borderRadius: 12, padding: "24px", textAlign: "center", cursor: "pointer", background: "#FAFBFF", transition: "border-color 0.2s" }}>
                  <input type="file" accept=".stl" style={{ display: "none" }} onChange={handleFileChange} />
                  {localOrder.fileName ? (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>📄</div>
                      <div style={{ fontWeight: 600, color: "#6366F1" }}>{localOrder.fileName}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Click to change file</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>📁</div>
                      <div style={{ fontWeight: 600, color: "#64748B" }}>Click to upload .STL file</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Only STL format accepted</div>
                    </div>
                  )}
                </label>
                {(localErrors.fileName || fileError) && <div style={styles.errorMsg}>⚠ {localErrors.fileName || fileError}</div>}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea style={{ ...styles.input, minHeight: 80, resize: "vertical" }} value={localOrder.notes} onChange={e => setLocalOrder(p => ({ ...p, notes: e.target.value }))} placeholder="Infill %, scale, specific requirements…" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={styles.btn("secondary")} onClick={() => setStep(1)}>← Back</button>
                <button style={styles.btn()} onClick={handleNext}>Next: Review →</button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <div style={styles.h3}>✅ Review Your Order</div>
              <div style={{ background: "#FAFBFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    ["Name", localOrder.name], ["Phone", localOrder.phone],
                    ["Order Name", localOrder.orderName], ["File", localOrder.fileName],
                    ["Material", localOrder.material], ["Color", localOrder.color],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 2 }}>{k}</div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                disabled={isUploading}
                style={{ ...styles.btn(), padding: "12px 28px", opacity: isUploading ? 0.5 : 1 }} 
                onClick={handleFinalSubmit}
              >
                {isUploading ? "Uploading file..." : "🚀 Submit Order"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const TrackView = () => {
    const [search, setSearch] = useState("");
    const [found, setFound] = useState(trackOrderId ? orders.find(o => o.id === trackOrderId) : null);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
      if (trackOrderId) {
        const o = orders.find(x => x.id === trackOrderId);
        setFound(o || null);
        if (!o) setNotFound(true);
      }
    }, [trackOrderId, orders]);

    function handleSearch() {
      const q = search.trim().toLowerCase();
      const match = orders.find(o => o.phone?.replace(/-/g, "").includes(q.replace(/-/g, "")) || o.name?.toLowerCase().includes(q) || o.ordername?.toLowerCase().includes(q));
      if (match) { setFound(match); setNotFound(false); }
      else { setFound(null); setNotFound(true); }
    }

    const waitHours = found && found.status === "queued" ? getQueueWaitHours(found.id) : null;
    const queuePos = found && found.status === "queued" ? queuedByPriority.findIndex(o => o.id === found.id) + 1 : null;

    return (
      <div>
        <button style={{ ...styles.btn("secondary"), marginBottom: 20 }} onClick={() => { setView("home"); setTrackOrderId(null); }}>← Back</button>
        <div style={styles.card}>
          <h2 style={styles.h2}>🔍 Track Your Order</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <input style={{ ...styles.input }} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="Search by name, phone, or order name…" />
            <button style={{ ...styles.btn(), whiteSpace: "nowrap" }} onClick={handleSearch}>Search</button>
          </div>
          {notFound && <div style={{ padding: 20, textAlign: "center", color: "#94A3B8", fontSize: 15 }}>😕 No order found. Check your name or phone number.</div>}
          {found && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{found.ordername}</div>
                  <div style={{ fontSize: 14, color: "#64748B" }}>Ordered by {found.name}</div>
                </div>
                <span style={styles.badge(found.status)}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[found.status].dot, display: "inline-block" }} />
                  {STATUS_LABELS[found.status]}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Material", value: found.material },
                  { label: "Color", value: found.color },
                  { label: "File", value: found.fileName },
                  { label: "Weight", value: found.weightgrams ? `${found.weightgrams}g` : "TBD" },
                  { label: "Price", value: found.weightgrams ? `${calcPrice(found.weightgrams, found.pricepergram || pricePerGram)} EGP` : "Pending" },
                ].map(x => (
                  <div key={x.label} style={{ background: "#F8FAFF", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 3 }}>{x.label}</div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{x.value}</div>
                  </div>
                ))}
              </div>
              {found.status === "queued" && waitHours !== null && (
                <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 600, color: "#C2410C", marginBottom: 4 }}>⏳ Queue Position: #{queuePos}</div>
                  <div style={{ fontSize: 14, color: "#92400E" }}>Estimated wait before your print starts: <strong>{formatDuration(waitHours)}</strong></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const AdminView = () => {
    const [editingWeight, setEditingWeight] = useState({});

    const sorted = filteredOrders.slice().sort((a, b) => {
      if (a.status === b.status) return a.priority - b.priority;
      return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    });

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ ...styles.h2, marginBottom: 0 }}>🛠 Admin Dashboard</h2>
          <button style={styles.btn("danger")} onClick={() => { setIsAdmin(false); setView("home"); }}>Sign Out</button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input style={{ ...styles.input, maxWidth: 280 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 Search orders…" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sorted.map(order => (
            <div key={order.id} style={{ ...styles.card, borderLeft: `4px solid ${STATUS_COLORS[order.status].dot}` }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{order.ordername}</div>
                  <div style={{ fontSize: 13, color: "#64748B" }}>👤 {order.name} · 📞 {order.phone}</div>
                  {order.fileurl && (
                    <a href={order.fileurl} download target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, background: "#EEF2FF", color: "#6366F1", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                      ⬇️ Download STL File
                    </a>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#6366F1" }}>{calcPrice(order.weightgrams || 0, order.pricepergram || pricePerGram)} EGP</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input 
                  style={{ ...styles.input, width: 90 }} 
                  type="number" 
                  placeholder="Grams" 
                  value={editingWeight[order.id] !== undefined ? editingWeight[order.id] : (order.weightgrams || "")} 
                  onChange={e => setEditingWeight(p => ({ ...p, [order.id]: e.target.value }))} 
                />
                <button style={styles.btn("secondary")} onClick={() => handleSetWeight(order.id, editingWeight[order.id])}>Set</button>
                {STATUS_ORDER.indexOf(order.status) < STATUS_ORDER.length - 1 && (
                  <button style={styles.btn()} onClick={() => handleStatusChange(order.id, STATUS_ORDER[STATUS_ORDER.indexOf(order.status) + 1])}>Advance Status →</button>
                )}
                <button style={styles.btn("danger")} onClick={() => setConfirmDelete(order.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const LoginView = () => (
    <div style={{ maxWidth: 360, margin: "60px auto" }}>
      <div style={styles.card}>
        <h2 style={styles.h2}>Admin Login</h2>
        <input style={{ ...styles.input, textAlign: "center", marginBottom: 12 }} type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="••••" />
        {pinError && <div style={styles.errorMsg}>{pinError}</div>}
        <button style={{ ...styles.btn(), width: "100%" }} onClick={handleAdminLogin}>Login</button>
      </div>
    </div>
  );

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.logo} onClick={() => setView("home")}>PrintQueue</div>
        <div style={styles.nav}>
          <button style={styles.navBtn(view === "home")} onClick={() => setView("home")}>Home</button>
          <button style={styles.navBtn(view === "order")} onClick={() => setView("order")}>New Order</button>
          <button style={styles.navBtn(view === "track")} onClick={() => setView("track")}>Track</button>
          <button style={styles.navBtn(view === "admin")} onClick={() => setView(isAdmin ? "admin" : "login")}>Admin</button>
        </div>
      </div>
      <div style={styles.main}>
        {view === "home" && <HomeView />}
        {view === "order" && <OrderView />}
        {view === "track" && <TrackView />}
        {view === "admin" && isAdmin && <AdminView />}
        {view === "login" && !isAdmin && <LoginView />}
      </div>
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={styles.card}>
            <p>Are you sure you want to delete this order?</p>
            <button style={styles.btn("danger")} onClick={() => handleDeleteOrder(confirmDelete)}>Yes, Delete</button>
            <button style={styles.btn("secondary")} onClick={() => setConfirmDelete(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}