import React, { useState, useEffect, useRef, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, Html, useProgress } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────
// Supabase Configuration
// ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://gfswtgvsbvmuxywewxij.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmc3d0Z3ZzYnZtdXh5d2V3eGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NzE2MjMsImV4cCI6MjA5NTU0NzYyM30.nxUmHtA4vpQ1zlj-Ok0OJr5Ry0pHKHCMES0Amf7Jrug";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function CarLoader() {
  const { progress } = useProgress();
  return <Html center><div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: 24, whiteSpace: 'nowrap' }}>Loading 3D Assets: {progress.toFixed(0)}%</div></Html>;
}

// ═══════════════════════════════════════════════════════════
// 3D F1 CAR COMPONENT
// ═══════════════════════════════════════════════════════════
function F1Model() {
  const { scene } = useGLTF(import.meta.env.BASE_URL + "f1.glb");
  const groupRef = useRef();

  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          // Boost reflections to show off metallic F1 paint
          child.material.envMapIntensity = 2.0;
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Calculate scroll progress
    const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const scrollY = window.scrollY;
    const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

    // ANIMATION LOGIC:
    // START (progress 0): Big, on the side (so text fits), slight angle
    // SCROLLING (progress > 0): Shrinks, rotates to top-down, moves to right edge
    
    // Interpolate Scale (1 -> 0.4)
    const scale = 1 - (progress * 0.6);
    
    // Position X: Start slightly right (1.5) -> Move further right edge (3.5)
    const startPosX = 2;
    const endPosX = 3;
    const posX = startPosX + progress * (endPosX - startPosX);
    
    // Interpolate Rotation
    // Flipped to Math.PI / 2 to show the top of the car instead of the bottom
    const startRotX = 0.2;
    const endRotX = Math.PI /10;
    const rotX = startRotX + progress * (endRotX - startRotX);
    
    const startRotY = -0.5;
    const endRotY = 0; // Pointing forward from top down
    const rotY = startRotY + progress * (endRotY - startRotY);

    // Apply smoothly
    groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    groupRef.current.position.lerp(new THREE.Vector3(posX, 0, 0), 0.1);
    
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0));
    groupRef.current.quaternion.slerp(targetQuat, 0.1);
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}
useGLTF.preload("/3D-EJUST/f1.glb");

// ═══════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  id: 1,
  hero_title: "F1-Level Precision.",
  hero_subtitle: "Aerospace-grade 3D printing. Submit your designs, track your queue, and get high-quality parts manufactured at record speeds.",
  why_title: "Built for Speed. Engineered for Strength.",
  why_text: "Why should you order now? Just like a Formula 1 car, our printing pipeline is highly optimized. We use state-of-the-art carbon fiber infused materials and high-speed coreXY kinematics to deliver your parts 3x faster than traditional services without sacrificing a single micrometer of accuracy.",
  price_per_gram: 3,
  materials: "PLA, PETG, ABS, Carbon Fiber, TPU",
  colors: "McLaren Orange, Carbon Black, White, Silver, Red"
};

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [orders, setOrders] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hash, setHash] = useState(window.location.hash);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [newOrder, setNewOrder] = useState({ name: "", phone: "", orderName: "", material: "", color: "", notes: "", fileName: "" });
  const [fileError, setFileError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [trackSearch, setTrackSearch] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [adminTab, setAdminTab] = useState("orders"); // "orders" or "cms"
  const [savingCMS, setSavingCMS] = useState(false);

  // ── Initialize Config Defaults ──
  useEffect(() => {
    if (config.materials && !newOrder.material) {
      setNewOrder(p => ({ ...p, material: config.materials.split(',')[0].trim(), color: config.colors.split(',')[0].trim() }));
    }
  }, [config]);

  // ── Auth Check & Hash Tracking ──
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdmin(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAdmin(!!session);
    });

    // Listen for hash changes
    function checkHash() {
      setHash(window.location.hash);
    }
    window.addEventListener("hashchange", checkHash);
    
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("hashchange", checkHash);
    };
  }, []);

  // ── Fetch Data ──
  useEffect(() => {
    fetchOrders();
    fetchConfig();
    const sub = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config' }, fetchConfig)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  async function fetchOrders() {
    const { data } = await supabase.from("orders").select("*").order("priority", { ascending: true });
    if (data) setOrders(data);
  }

  async function fetchConfig() {
    const { data, error } = await supabase.from("site_config").select("*").eq("id", 1).single();
    if (data && !error) {
      setConfig(data);
    }
  }

  const queuedOrdersCount = orders.filter(o => o.status === "queued").length;

  // ── Handlers ──
  async function handleAdminLogin() {
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (error) setLoginError(error.message);
  }

  async function handleAdminLogout() {
    await supabase.auth.signOut();
    window.location.hash = "";
  }

  async function handleUpdateOrderStatus(id, newStatus) {
    await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    fetchOrders(); // Force update UI manually, in case real-time isn't enabled
  }

  async function handleUpdateCMS(e) {
    e.preventDefault();
    setSavingCMS(true);
    const { error } = await supabase.from("site_config").upsert({ ...config, id: 1 });
    if (error) alert("Failed to save CMS config. Did you create the table?");
    else alert("Website configuration saved successfully!");
    setSavingCMS(false);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".stl")) { setFileError("Only .stl files accepted."); return; }
    setFileError("");
    setSelectedFile(file);
    setNewOrder(p => ({ ...p, fileName: file.name }));
  }

  async function handleOrderSubmit() {
    if (!newOrder.name || !newOrder.phone || !selectedFile) {
      alert("Please fill all required fields and upload an STL.");
      return;
    }
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const { error: uploadErr } = await supabase.storage.from("stl-files").upload(fileName, selectedFile);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("stl-files").getPublicUrl(fileName);

      const payload = { 
        name: newOrder.name, 
        phone: newOrder.phone, 
        ordername: newOrder.orderName, 
        material: newOrder.material, 
        color: newOrder.color, 
        notes: newOrder.notes, 
        fileurl: urlData.publicUrl, 
        status: "queued", 
        priority: queuedOrdersCount, 
        weightgrams: 0, 
        pricepergram: config.price_per_gram 
      };
      await supabase.from("orders").insert([payload]);
      
      alert("Order submitted successfully!");
      setNewOrder({ name: "", phone: "", orderName: "", material: config.materials.split(',')[0].trim(), color: config.colors.split(',')[0].trim(), notes: "", fileName: "" });
      setSelectedFile(null);
      fetchOrders(); // Force update UI manually
    } catch (err) {
      alert("Failed to submit order.");
    }
    setIsUploading(false);
  }

  function handleTrackSearch() {
    const q = trackSearch.trim().toLowerCase();
    const match = orders.find(o => o.phone?.includes(q) || o.name?.toLowerCase().includes(q));
    setTrackResult(match || "NOT_FOUND");
  }

  // ═══════════════════════════════════════════════════════════
  // LOGIN VIEW (Protected Admin Area)
  // ═══════════════════════════════════════════════════════════
  if (hash === "#boss" && !isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F5F5F7' }}>
        <div className="card" style={{ maxWidth: 400, width: "100%" }}>
          <h2 style={{fontSize: 24, marginBottom: 8}}>Secure Admin Access</h2>
          <p style={{fontSize: 14, marginBottom: 24, color: "var(--text-secondary)"}}>Log in with your Supabase email and password to prevent source-code inspection of credentials.</p>
          <div style={{marginBottom: 16}}><input placeholder="Email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} /></div>
          <div style={{marginBottom: 24}}><input type="password" placeholder="Password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()} /></div>
          {loginError && <div style={{color: "red", marginBottom: 16, fontSize: 13, fontWeight: "bold"}}>{loginError}</div>}
          <button className="btn btn-primary" style={{width: "100%"}} onClick={handleAdminLogin}>Authenticate</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════
  if (hash === "#boss" && isAdmin) {
    return (
      <div style={{ padding: 48, maxWidth: 1200, margin: "0 auto", background: "#f9f9f9", minHeight: "100vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 40, margin: 0 }}>Command Center</h1>
          <button className="btn" style={{ background: "#E5E5EA", color: "#000" }} onClick={handleAdminLogout}>Sign Out</button>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          <button className={`btn ${adminTab === "orders" ? "btn-primary" : ""}`} style={adminTab !== "orders" ? {background: "#fff", border: "2px solid #E5E5EA", color: "#000"} : {}} onClick={() => setAdminTab("orders")}>Manage Orders</button>
          <button className={`btn ${adminTab === "cms" ? "btn-primary" : ""}`} style={adminTab !== "cms" ? {background: "#fff", border: "2px solid #E5E5EA", color: "#000"} : {}} onClick={() => setAdminTab("cms")}>Edit Website Content</button>
        </div>

        {adminTab === "orders" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginBottom: 40 }}>
              <div className="card"><h3>Total Orders</h3><p style={{fontSize: 32, margin: 0, fontWeight: 900}}>{orders.length}</p></div>
              <div className="card"><h3>Printing Now</h3><p style={{fontSize: 32, margin: 0, fontWeight: 900, color: "var(--accent)"}}>{orders.filter(o=>o.status==="printing").length}</p></div>
              <div className="card"><h3>Completed</h3><p style={{fontSize: 32, margin: 0, fontWeight: 900, color: "#00c853"}}>{orders.filter(o=>o.status==="done").length}</p></div>
            </div>
            <div className="card">
              <h3 style={{marginBottom: 24}}>Order Queue</h3>
              {orders.map(o => (
                <div key={o.id} style={{ padding: 24, border: "2px solid var(--border-light)", borderRadius: 12, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{fontSize: 20, fontWeight: 800}}>{o.ordername} <span style={{fontSize: 12, background: "#000", color: "#fff", padding: "4px 8px", borderRadius: 4, verticalAlign: "middle"}}>{o.status.toUpperCase()}</span></div>
                    <div style={{color: "var(--text-secondary)", marginTop: 8}}>{o.name} &bull; {o.phone}</div>
                    <div style={{fontSize: 14, fontWeight: 600, marginTop: 4}}>{o.material} ({o.color})</div>
                  </div>
                  <div style={{display: "flex", gap: 12, alignItems: "center"}}>
                    <select value={o.status} onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)} style={{width: 150, padding: 12}}>
                      <option value="queued">Queued</option>
                      <option value="printing">Printing</option>
                      <option value="done">Done</option>
                    </select>
                    {o.fileurl && <a href={o.fileurl} download target="_blank" rel="noreferrer" className="btn btn-accent" style={{padding: "12px 24px"}}>Download STL</a>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {adminTab === "cms" && (
          <div className="card" style={{ maxWidth: 800 }}>
            <h3 style={{marginBottom: 8}}>Content Management System</h3>
            <p style={{marginBottom: 32, color: "var(--text-secondary)"}}>Update the text and pricing on your public website instantly.</p>
            
            <form onSubmit={handleUpdateCMS}>
              <div style={{marginBottom: 24}}>
                <label>Price per Gram (EGP)</label>
                <input type="number" value={config.price_per_gram} onChange={e=>setConfig(p=>({...p, price_per_gram: e.target.value}))} />
              </div>
              <div style={{marginBottom: 24}}>
                <label>Available Materials (comma separated)</label>
                <input value={config.materials} onChange={e=>setConfig(p=>({...p, materials: e.target.value}))} />
              </div>
              <div style={{marginBottom: 32}}>
                <label>Available Colors (comma separated)</label>
                <input value={config.colors} onChange={e=>setConfig(p=>({...p, colors: e.target.value}))} />
              </div>
              <hr style={{border: 0, borderTop: "2px solid var(--border-light)", margin: "32px 0"}} />
              <div style={{marginBottom: 24}}>
                <label>Hero Title</label>
                <input value={config.hero_title} onChange={e=>setConfig(p=>({...p, hero_title: e.target.value}))} />
              </div>
              <div style={{marginBottom: 24}}>
                <label>Hero Subtitle</label>
                <textarea rows="3" value={config.hero_subtitle} onChange={e=>setConfig(p=>({...p, hero_subtitle: e.target.value}))} />
              </div>
              <div style={{marginBottom: 24}}>
                <label>Why Order Now - Title</label>
                <input value={config.why_title} onChange={e=>setConfig(p=>({...p, why_title: e.target.value}))} />
              </div>
              <div style={{marginBottom: 40}}>
                <label>Why Order Now - Text</label>
                <textarea rows="4" value={config.why_text} onChange={e=>setConfig(p=>({...p, why_text: e.target.value}))} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingCMS}>{savingCMS ? "Saving..." : "Save Website Configuration"}</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC SINGLE PAGE APP
  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <div className="canvas-container">
        <Canvas 
          shadows 
          dpr={[1, 2]} 
          camera={{ position: [0, 0, 6], fov: 40 }}
          gl={{ 
            antialias: true, 
            toneMapping: THREE.ACESFilmicToneMapping, 
            toneMappingExposure: 1.1 
          }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[10, 10, 5]} 
            intensity={2} 
            color="#ffffff" 
            castShadow 
            shadow-mapSize-width={2048} 
            shadow-mapSize-height={2048} 
            shadow-bias={-0.0001} 
          />
          <Suspense fallback={<CarLoader />}>
            <F1Model />
            <ContactShadows position={[0, -1, 0]} opacity={0.6} scale={15} blur={1.5} far={4} color="#000000" />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      <nav className="header">
        <div className="logo"><div className="logo-dot" /> PrintQueue</div>
        <div className="nav-links">
          <a href="#why">Why Us</a>
          <a href="#order">Order</a>
          <a href="#track">Track</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <main>
        <section id="home" className="section-container animate-in">
          <h1>{config.hero_title}</h1>
          <p>{config.hero_subtitle}</p>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <a href="#order" className="btn btn-accent">Start Manufacturing</a>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              <span style={{ color: "var(--text-primary)" }}>{queuedOrdersCount}</span> In Queue
            </div>
          </div>
        </section>

        <section id="why" className="section-container">
          <h2>{config.why_title}</h2>
          <p>{config.why_text}</p>
          <a href="#order" className="btn btn-primary" style={{ width: "fit-content" }}>Secure Your Spot in Queue</a>
        </section>

        <section id="order" className="section-container">
          <h2>Submit Payload.</h2>
          <div className="card">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div><label>Name</label><input value={newOrder.name} onChange={e=>setNewOrder(p=>({...p, name: e.target.value}))} placeholder="John Doe" /></div>
              <div><label>Phone</label><input value={newOrder.phone} onChange={e=>setNewOrder(p=>({...p, phone: e.target.value}))} placeholder="01X..." /></div>
            </div>
            <div style={{ marginBottom: 24 }}><label>Project Name</label><input value={newOrder.orderName} onChange={e=>setNewOrder(p=>({...p, orderName: e.target.value}))} placeholder="Intake Manifold" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              <div>
                <label>Material</label>
                <select value={newOrder.material} onChange={e=>setNewOrder(p=>({...p, material: e.target.value}))}>
                  {config.materials.split(',').map(m=><option key={m}>{m.trim()}</option>)}
                </select>
              </div>
              <div>
                <label>Color</label>
                <select value={newOrder.color} onChange={e=>setNewOrder(p=>({...p, color: e.target.value}))}>
                  {config.colors.split(',').map(c=><option key={c}>{c.trim()}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label>STL File</label>
              <input type="file" accept=".stl" onChange={handleFileChange} style={{ padding: "12px", border: "1px dashed var(--border-light)" }} />
              {fileError && <div style={{ color: "red", fontSize: 12, marginTop: 8 }}>{fileError}</div>}
            </div>
            <button className="btn btn-accent" style={{ width: "100%", opacity: isUploading ? 0.7 : 1 }} disabled={isUploading} onClick={handleOrderSubmit}>
              {isUploading ? "Uploading Data..." : "Engage Manufacture"}
            </button>
          </div>
        </section>

        <section id="track" className="section-container">
          <h2>Telemetry & Tracking.</h2>
          <p>Enter your phone number to check your manufacturing status in real-time.</p>
          <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
            <input value={trackSearch} onChange={e=>setTrackSearch(e.target.value)} placeholder="Phone number..." />
            <button className="btn btn-primary" onClick={handleTrackSearch}>Search</button>
          </div>
          
          {trackResult === "NOT_FOUND" && <p>No telemetry data found for this number.</p>}
          {trackResult && trackResult !== "NOT_FOUND" && (
            <div className="card">
              <h3>{trackResult.ordername}</h3>
              <p style={{ margin: "16px 0", color: "var(--accent)", fontWeight: 800, fontSize: 24, textTransform: "uppercase" }}>
                Status: {trackResult.status}
              </p>
              <p>Material: {trackResult.material} | Color: {trackResult.color}</p>
            </div>
          )}
        </section>

        <section id="about" className="section-container">
          <h2>The Garage.</h2>
          <p>Founded by engineers and designers, PrintQueue is dedicated to bridging the gap between digital concepts and physical reality. We operate a farm of highly tuned additive manufacturing machines, calibrated daily for optimal performance.</p>
        </section>

        <section id="contact" className="section-container">
          <h2>Pit Stop.</h2>
          <p>Need custom engineering or bulk manufacturing? Get in touch with our pit crew.</p>
          <p style={{ fontWeight: 900, fontSize: "clamp(24px, 4vw, 40px)", color: "var(--text-primary)", margin: 0, letterSpacing: "-0.04em" }}>hello@printqueue.com</p>
        </section>
      </main>
    </>
  );
}