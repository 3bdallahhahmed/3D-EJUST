import React, { useState, useEffect, useRef, Suspense, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Html, useProgress } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────
// Supabase
// ─────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://gfswtgvsbvmuxywewxij.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ORiX5qWkvIQLrG17DIuvIQ_hgFm971W";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function generateTrackingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "JP-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

// ─────────────────────────────────────────────────────────
// 3D SCENE — Abstract Geometry + 3D Print Icons
// ─────────────────────────────────────────────────────────
function SceneLoader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: "var(--accent)", fontWeight: "bold", fontSize: 20, whiteSpace: "nowrap", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>{progress.toFixed(0)}%</div>
        <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.12em" }}>Loading</div>
      </div>
    </Html>
  );
}

/* ── Gear Shape (3D printing icon) ── */
function GearShape({ position, scale = 1, color = "#FF8000" }) {
  const meshRef = useRef();
  const gearGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const teeth = 12;
    const innerR = 0.6;
    const outerR = 1.0;
    for (let i = 0; i < teeth; i++) {
      const a1 = (i / teeth) * Math.PI * 2;
      const a2 = ((i + 0.3) / teeth) * Math.PI * 2;
      const a3 = ((i + 0.5) / teeth) * Math.PI * 2;
      const a4 = ((i + 0.8) / teeth) * Math.PI * 2;
      const fn = i === 0 ? "moveTo" : "lineTo";
      shape[fn](Math.cos(a1) * innerR, Math.sin(a1) * innerR);
      shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
      shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
      shape.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
    }
    // Center hole
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.25, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
  }, []);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.z += delta * 0.3;
  });

  return (
    <mesh ref={meshRef} geometry={gearGeo} position={position} scale={scale}>
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
    </mesh>
  );
}

/* ── Main 3D Scene ── */
function PrintScene() {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current) return;
    const maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));

    // Scale down and move right as user scrolls
    const isMobile = window.innerWidth <= 768;
    const mobileScale = 0.55;
    const scale = isMobile ? mobileScale : (1 - progress * 0.4);
    const posX = isMobile ? 0 : (2.5 + progress * 1);
    const posY = isMobile ? 1.5 : 0;
    const rotY = progress * Math.PI * 0.5;

    groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.08);
    groupRef.current.position.lerp(new THREE.Vector3(posX, posY, 0), 0.08);
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
    groupRef.current.quaternion.slerp(targetQuat, 0.08);
  });

  return (
    <group ref={groupRef}>
      {/* Central Torus Knot — abstract hero piece */}
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh position={[0, 0, 0]}>
          <torusKnotGeometry args={[0.8, 0.25, 128, 32]} />
          <meshStandardMaterial
            color="#FF8000"
            metalness={0.85}
            roughness={0.1}
            envMapIntensity={2}
          />
        </mesh>
      </Float>

      {/* Gear 1 */}
      <Float speed={2} rotationIntensity={0.6} floatIntensity={0.8}>
        <GearShape position={[-1.8, 1.2, -0.5]} scale={0.5} color="#333333" />
      </Float>

      {/* Gear 2 — smaller */}
      <Float speed={1.8} rotationIntensity={0.5} floatIntensity={0.7}>
        <GearShape position={[1.5, -1, 0.3]} scale={0.35} color="#FFB347" />
      </Float>

      {/* Floating Cube — representing 3D print layers */}
      <Float speed={2.2} rotationIntensity={0.8} floatIntensity={0.9}>
        <mesh position={[-1.2, -1.3, 0.5]} rotation={[0.5, 0.7, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#1A1A1A" metalness={0.6} roughness={0.3} />
        </mesh>
      </Float>

      {/* Floating Octahedron — geometric */}
      <Float speed={1.6} rotationIntensity={0.7} floatIntensity={0.5}>
        <mesh position={[1.8, 1.3, -0.3]} rotation={[0.3, 0.4, 0]}>
          <octahedronGeometry args={[0.4]} />
          <meshStandardMaterial color="#FF8000" metalness={0.9} roughness={0.05} envMapIntensity={3} />
        </mesh>
      </Float>

      {/* Small Icosahedron */}
      <Float speed={2.5} rotationIntensity={1} floatIntensity={1}>
        <mesh position={[0.3, 1.8, 0.2]}>
          <icosahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial color="#E0E0E0" metalness={0.5} roughness={0.4} />
        </mesh>
      </Float>

      {/* Small Torus — ring detail */}
      <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.4}>
        <mesh position={[-0.5, -0.2, 1]} rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[0.3, 0.08, 16, 32]} />
          <meshStandardMaterial color="#666666" metalness={0.7} roughness={0.2} />
        </mesh>
      </Float>

      {/* Cylinder — nozzle-like */}
      <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
        <mesh position={[0.8, -1.6, -0.4]} rotation={[0.2, 0, 0.5]}>
          <cylinderGeometry args={[0.06, 0.15, 0.6, 16]} />
          <meshStandardMaterial color="#FF8000" metalness={0.8} roughness={0.15} />
        </mesh>
      </Float>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════
// SVG ICONS
// ═══════════════════════════════════════════════════════════
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
);
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const EmailIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const CubeIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);

// ═══════════════════════════════════════════════════════════
// FLOATING 3D ICONS COMPONENT
// ═══════════════════════════════════════════════════════════
function FloatingIcons({ icons }) {
  return (
    <div className="floating-icons-container">
      {icons.map((icon, idx) => (
        <img
          key={idx}
          src={`${import.meta.env.BASE_URL}assets/icons/${icon.src}`}
          className="floating-icon"
          style={{
            width: icon.size,
            top: icon.top,
            bottom: icon.bottom,
            left: icon.left,
            right: icon.right,
            animation: `${icon.reverse ? 'floatIconReverse' : 'floatIcon'} ${icon.duration || '6s'} ease-in-out infinite alternate`,
            animationDelay: icon.delay || '0s',
            opacity: icon.opacity || 0.85
          }}
          alt=""
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STATUS STEPPER
// ═══════════════════════════════════════════════════════════
function StatusStepper({ status }) {
  const steps = ["queued", "printing", "done"];
  const currentIdx = steps.indexOf(status);
  return (
    <div className="stepper">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          {i > 0 && <div className={`stepper-line ${i <= currentIdx ? "filled" : ""}`} />}
          <div className={`stepper-step ${i < currentIdx ? "completed" : ""} ${i === currentIdx ? "active" : ""}`}>
            <div className="stepper-dot">{i < currentIdx ? <CheckIcon /> : i + 1}</div>
            <span className="stepper-label">{step === "queued" ? "Queued" : step === "printing" ? "Printing" : "Done"}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COPYABLE CODE
// ═══════════════════════════════════════════════════════════
function CopyableCode({ code }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    // Try modern API first, then fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      fallbackCopy(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }
  return (
    <div onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.05em" }}>{code}</span>
      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); handleCopy(); }}>{copied ? "✓ Copied!" : "Tap to Copy"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═══════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  id: 1,
  brand_name: "JUST print",
  hero_title: "Your Idea.\nMade Real.",
  hero_subtitle: "Upload your 3D design, pick your material, and we'll print it for you — fast, affordable, and right here on campus.",
  why_title: "Why Print With Us?",
  why_text: "We're students who love making things. Our setup is tuned for speed and precision, so you get your parts fast without breaking the bank. PLA, PETG, TPU — we've got what you need.",
  price_per_gram: 3,
  materials: "PLA, PETG, ABS, Carbon Fiber, TPU",
  colors: "McLaren Orange, Carbon Black, White, Silver, Red"
};

function FullGalleryView() {
  const allItems = [
    { title: "Custom Gears", desc: "PLA — Mechanical parts" },
    { title: "Phone Stand", desc: "PETG — Functional design" },
    { title: "Miniature Model", desc: "PLA — High detail" },
    { title: "Drone Mount", desc: "Carbon Fiber — Lightweight" },
    { title: "Enclosure", desc: "ABS — Heat resistant" },
    { title: "Art Piece", desc: "TPU — Flexible material" },
    { title: "Keycaps", desc: "Resin — Custom profile" },
    { title: "Planter", desc: "PLA — Home decor" },
    { title: "Robot Arm", desc: "PETG — Robotics" },
    { title: "Cosplay Prop", desc: "PLA — Large scale" },
    { title: "RC Car Chassis", desc: "Nylon — High impact" },
    { title: "Laptop Stand", desc: "PETG — Ergonomic" },
    { title: "Cable Organizers", desc: "TPU — Flexible" },
    { title: "Vase", desc: "Silk PLA — Aesthetic" },
    { title: "Board Game Insert", desc: "PLA — Organization" },
  ];

  return (
    <section className="gallery-section animate-in" style={{ paddingTop: 160, minHeight: "100vh", position: "relative", zIndex: 10 }}>
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <h1>Full Gallery</h1>
        <p style={{ maxWidth: 500, margin: "0 auto" }}>Explore everything we've printed. From functional mechanical parts to beautiful art pieces.</p>
        <div style={{ marginTop: 24 }}>
          <a href="#home" className="btn btn-glass">← Back to Home</a>
        </div>
      </div>
      <div className="gallery-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {allItems.map((item, i) => (
          <div key={i} className="gallery-card">
            <div className="gallery-card-img"><CubeIcon /></div>
            <div className="gallery-card-body">
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [orders, setOrders] = useState([]);
  const [queuedOrdersCount, setQueuedOrdersCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hash, setHash] = useState(window.location.hash);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const savedUserInfo = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("jp_user_info") || "{}"); } catch { return {}; }
  }, []);
  const [newOrder, setNewOrder] = useState({ name: savedUserInfo.name || "", phone: savedUserInfo.phone || "", email: savedUserInfo.email || "", orderName: "", material: "", color: "", notes: "", fileName: "" });
  const [fileError, setFileError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [trackSearch, setTrackSearch] = useState("");
  const [trackResults, setTrackResults] = useState(null);
  const [adminTab, setAdminTab] = useState("orders");
  const [savingCMS, setSavingCMS] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const [successModal, setSuccessModal] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orderStep, setOrderStep] = useState(1);

  useEffect(() => {
    if (config.materials && !newOrder.material) {
      setNewOrder(p => ({ ...p, material: config.materials.split(',')[0].trim(), color: config.colors.split(',')[0].trim() }));
    }
  }, [config]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsAdmin(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setIsAdmin(!!session));
    function checkHash() {
      const newHash = window.location.hash;
      // Reset order wizard when navigating away from #order
      if (newHash !== "#order") {
        setOrderStep(1);
      }
      setHash(newHash);
    }
    window.addEventListener("hashchange", checkHash);
    return () => { subscription.unsubscribe(); window.removeEventListener("hashchange", checkHash); };
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchConfig();
    const sub = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config' }, fetchConfig)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [isAdmin]);

  // Auto-load user's past orders if they exist
  useEffect(() => {
    async function loadSavedOrders() {
      try {
        const savedCodes = JSON.parse(localStorage.getItem("jp_tracking_codes") || "[]");
        if (savedCodes.length > 0 && trackSearch === "" && !trackResults) {
          const { data } = await supabase.rpc("get_saved_orders", { codes: savedCodes });
          if (data && data.length > 0) {
            setTrackResults(data);
          }
        }
      } catch (e) { console.error(e); }
    }
    loadSavedOrders();
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("active"); });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Handle cross-page hash scrolling
  useEffect(() => {
    if (hash && hash !== "#full-gallery" && hash !== "#boss") {
      const el = document.getElementById(hash.replace("#", ""));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } else if (hash === "#full-gallery" || hash === "#home" || hash === "") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [hash]);

  async function fetchOrders() {
    if (isAdmin) {
      const { data } = await supabase.from("orders").select("*").order("createdat", { ascending: false });
      if (data) setOrders(data);
    }
    const { data: countData } = await supabase.rpc("get_queued_count");
    if (countData !== null) setQueuedOrdersCount(countData);
  }

  async function fetchConfig() {
    const { data, error } = await supabase.from("site_config").select("*").eq("id", 1).single();
    if (data && !error) setConfig(data);
  }



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
    fetchOrders();
  }

  async function handleDeleteOrder(id) {
    if (!window.confirm("Delete this order permanently?")) return;
    await supabase.from("orders").delete().eq("id", id);
    fetchOrders();
  }

  async function handleUpdateWeight(id, weightStr) {
    const weight = parseFloat(weightStr) || 0;
    const price = weight * (parseFloat(config.price_per_gram) || 0);
    await supabase.from("orders").update({ weightgrams: weight, pricepergram: config.price_per_gram, totalprice: price }).eq("id", id);
    fetchOrders();
  }

  function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
  function isValidEgyptPhone(phone) { return /^01[0125]\d{8}$/.test(phone.replace(/[\s\-()]/g, "")); }

  function getSortedOrders() {
    const sorted = [...orders];
    switch (sortBy) {
      case "weight": return sorted.sort((a, b) => (b.weightgrams || 0) - (a.weightgrams || 0));
      case "filesize": return sorted.sort((a, b) => (b.filesize || 0) - (a.filesize || 0));
      default: return sorted.sort((a, b) => new Date(b.createdat || 0) - new Date(a.createdat || 0));
    }
  }

  async function handleUpdateCMS(e) {
    e.preventDefault();
    setSavingCMS(true);
    const { error } = await supabase.from("site_config").upsert({ ...config, id: 1 });
    if (error) alert("Failed to save config.");
    else alert("Configuration saved!");
    setSavingCMS(false);
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const invalid = files.filter(f => !f.name.toLowerCase().endsWith(".stl") && !f.name.toLowerCase().endsWith(".zip"));
    if (invalid.length > 0) { setFileError("Only .stl or .zip files accepted."); return; }
    setFileError("");
    setSelectedFiles(files);
    setNewOrder(p => ({ ...p, fileName: files.map(f => f.name).join(", ") }));
  }

  async function handleOrderSubmit() {
    const errors = {};
    if (!newOrder.name) errors.name = "Name is required.";
    if (!newOrder.email) errors.email = "Email is required.";
    else if (!isValidEmail(newOrder.email)) errors.email = "Please enter a valid email.";
    if (!newOrder.phone) errors.phone = "Phone is required.";
    else if (!isValidEgyptPhone(newOrder.phone)) errors.phone = "Enter a valid Egyptian number (e.g. 01012345678).";
    if (selectedFiles.length === 0) errors.file = "Please upload at least one STL or ZIP file.";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsUploading(true);
    try {
      let totalSize = 0;
      const urls = [];
      for (const file of selectedFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("stl-files").upload(fileName, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("stl-files").getPublicUrl(fileName);
        urls.push(urlData.publicUrl);
        totalSize += file.size;
      }

      const trackingCode = generateTrackingCode();
      const payload = {
        name: newOrder.name,
        phone: newOrder.phone.replace(/[\s\-()]/g, ""),
        email: newOrder.email,
        ordername: newOrder.orderName,
        material: newOrder.material,
        color: newOrder.color,
        notes: newOrder.notes,
        fileurl: urls.join(","),
        filesize: totalSize,
        status: "queued",
        priority: queuedOrdersCount,
        weightgrams: 0,
        pricepergram: config.price_per_gram,
        tracking_code: trackingCode
      };

      const { error: insertErr } = await supabase.from("orders").insert([payload]);
      if (insertErr) throw new Error(insertErr.message);

      // Save user info for next time
      localStorage.setItem("jp_user_info", JSON.stringify({ name: newOrder.name, phone: newOrder.phone, email: newOrder.email }));
      
      // Save tracking code for auto-tracking
      try {
        const savedCodes = JSON.parse(localStorage.getItem("jp_tracking_codes") || "[]");
        savedCodes.push(trackingCode);
        localStorage.setItem("jp_tracking_codes", JSON.stringify([...new Set(savedCodes)]));
      } catch (err) { console.error("Could not save tracking code", err); }

      setOrderStep(4);
      setSuccessModal(trackingCode); // Keep this to pass the code to step 4 without modifying state structure too much
      setNewOrder({ name: newOrder.name, phone: newOrder.phone, email: newOrder.email, orderName: "", material: config.materials.split(',')[0].trim(), color: config.colors.split(',')[0].trim(), notes: "", fileName: "" });
      setFormErrors({});
      setSelectedFiles([]);
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert("Failed to submit order:\n" + (err.message || err));
    }
    setIsUploading(false);
  }

  async function handleTrackSearch() {
    const q = trackSearch.trim().toLowerCase();
    if (!q) return;
    const { data } = await supabase.rpc("search_orders", { q });
    setTrackResults(data && data.length > 0 ? data : "NOT_FOUND");
  }

  // ═══════════════════════════════════════════════════════════
  // LOGIN VIEW
  // ═══════════════════════════════════════════════════════════
  if (hash === "#boss" && !isAdmin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-page)' }}>
        <div className="bg-orbs"><div className="bg-orb bg-orb-1"/><div className="bg-orb bg-orb-2"/></div>
        <div className="card" style={{ maxWidth: 420, width: "100%", position: "relative", zIndex: 10 }}>
          <h2 style={{ fontSize: 26, marginBottom: 8 }}>Admin Access</h2>
          <p style={{ fontSize: 14, marginBottom: 24 }}>Log in with your Supabase credentials.</p>
          <div style={{ marginBottom: 16 }}><input placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
          <div style={{ marginBottom: 24 }}><input type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} /></div>
          {loginError && <div style={{ color: "#FF3B30", marginBottom: 16, fontSize: 13, fontWeight: 700 }}>{loginError}</div>}
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleAdminLogin}>Authenticate</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════
  if (hash === "#boss" && isAdmin) {
    return (
      <div className="admin-container">
        <div className="bg-orbs"><div className="bg-orb bg-orb-1"/><div className="bg-orb bg-orb-2"/><div className="bg-orb bg-orb-3"/></div>
        <div style={{ position: "relative", zIndex: 10 }}>
          <div className="admin-header">
            <h1 style={{ fontSize: 36, margin: 0 }}>Command Center</h1>
            <button className="btn btn-glass" onClick={handleAdminLogout}>Sign Out</button>
          </div>

          <div className="admin-tabs">
            <button className={`btn ${adminTab === "orders" ? "btn-primary" : "btn-glass"}`} onClick={() => setAdminTab("orders")}>Manage Orders</button>
            <button className={`btn ${adminTab === "cms" ? "btn-primary" : "btn-glass"}`} onClick={() => setAdminTab("cms")}>Edit Website</button>
          </div>

          {adminTab === "orders" && (
            <>
              <div className="admin-stats-grid">
                <div className="card"><h3>Total Orders</h3><p style={{ fontSize: 36, margin: "8px 0 0", fontWeight: 900 }}>{orders.length}</p></div>
                <div className="card"><h3>Printing Now</h3><p style={{ fontSize: 36, margin: "8px 0 0", fontWeight: 900, color: "var(--status-printing)" }}>{orders.filter(o => o.status === "printing").length}</p></div>
                <div className="card"><h3>Completed</h3><p style={{ fontSize: 36, margin: "8px 0 0", fontWeight: 900, color: "var(--status-done)" }}>{orders.filter(o => o.status === "done").length}</p></div>
              </div>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                  <h3 style={{ margin: 0 }}>Order Queue</h3>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sort:</span>
                    {["date", "weight", "filesize"].map(s => (
                      <button key={s} className={`btn ${sortBy === s ? "btn-primary" : "btn-glass"}`}
                        style={{ padding: "6px 14px", fontSize: 12 }}
                        onClick={() => setSortBy(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                    ))}
                  </div>
                </div>
                {getSortedOrders().map(o => {
                  const calculatedPrice = (o.weightgrams || 0) * (parseFloat(config.price_per_gram) || 0);
                  return (
                    <div key={o.id} className="admin-order-card">
                      <div className="admin-order-layout">
                        <div className="admin-order-info">
                          <div style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {o.ordername || "Untitled"}
                            <span style={{ fontSize: 10, background: o.status === "done" ? "var(--status-done)" : o.status === "printing" ? "var(--status-printing)" : "var(--status-queued)", color: "#fff", padding: "3px 10px", borderRadius: "var(--radius-full)", fontWeight: 700 }}>{o.status.toUpperCase()}</span>
                            {o.tracking_code && <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700, fontFamily: "monospace" }}>{o.tracking_code}</span>}
                          </div>
                          <div style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 13 }}>{o.name} &bull; {o.phone}{o.email ? ` &bull; ${o.email}` : ""}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{o.material} ({o.color})</div>
                          {o.notes && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, fontStyle: "italic" }}>Notes: {o.notes}</div>}
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                            {o.created_at && <span>{new Date(o.created_at).toLocaleString()} &bull; </span>}
                            {o.filesize > 0 && <span>{(o.filesize / 1024).toFixed(0)} KB</span>}
                          </div>
                        </div>
                        <div className="admin-order-actions">
                          <select value={o.status} onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)} style={{ width: 130, padding: 10, fontSize: 13 }}>
                            <option value="queued">Queued</option>
                            <option value="printing">Printing</option>
                            <option value="done">Done</option>
                          </select>
                          {o.fileurl && o.fileurl.split(',').map((url, idx, arr) => (
                            <a key={idx} href={url} download target="_blank" rel="noreferrer" className="btn btn-accent" style={{ padding: "8px 16px", fontSize: 12 }}>
                              Download {arr.length > 1 ? idx + 1 : ""}
                            </a>
                          ))}
                          <button onClick={() => handleDeleteOrder(o.id)} style={{ padding: "8px 16px", background: "#FF3B30", color: "#fff", border: "none", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Delete</button>
                        </div>
                      </div>
                      <div className="admin-order-footer">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label style={{ margin: 0, whiteSpace: "nowrap" }}>Weight (g)</label>
                          <input type="number" defaultValue={o.weightgrams || ""} placeholder="0" onBlur={(e) => handleUpdateWeight(o.id, e.target.value)} style={{ width: 90, padding: "8px 12px", fontSize: 13 }} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Rate: <strong style={{ color: "var(--text-primary)" }}>{config.price_per_gram} EGP/g</strong></div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "var(--accent)", marginLeft: "auto" }}>{calculatedPrice.toFixed(2)} EGP</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {adminTab === "cms" && (
            <div className="card" style={{ maxWidth: 800 }}>
              <h3 style={{ marginBottom: 8 }}>Content Management</h3>
              <p style={{ marginBottom: 28, fontSize: 14 }}>Update your website text and pricing instantly.</p>
              <form onSubmit={handleUpdateCMS}>
                <div style={{ marginBottom: 20 }}><label>Brand Name</label><input value={config.brand_name || ""} onChange={e => setConfig(p => ({ ...p, brand_name: e.target.value }))} /></div>
                <div style={{ marginBottom: 20 }}><label>Price per Gram (EGP)</label><input type="number" value={config.price_per_gram} onChange={e => setConfig(p => ({ ...p, price_per_gram: e.target.value }))} /></div>
                <div style={{ marginBottom: 20 }}><label>Materials (comma separated)</label><input value={config.materials} onChange={e => setConfig(p => ({ ...p, materials: e.target.value }))} /></div>
                <div style={{ marginBottom: 28 }}><label>Colors (comma separated)</label><input value={config.colors} onChange={e => setConfig(p => ({ ...p, colors: e.target.value }))} /></div>
                <hr style={{ border: 0, borderTop: "1px solid var(--border-glass)", margin: "28px 0" }} />
                <div style={{ marginBottom: 20 }}><label>Hero Title</label><input value={config.hero_title} onChange={e => setConfig(p => ({ ...p, hero_title: e.target.value }))} /></div>
                <div style={{ marginBottom: 20 }}><label>Hero Subtitle</label><textarea rows="3" value={config.hero_subtitle} onChange={e => setConfig(p => ({ ...p, hero_subtitle: e.target.value }))} /></div>
                <div style={{ marginBottom: 20 }}><label>Why Us - Title</label><input value={config.why_title} onChange={e => setConfig(p => ({ ...p, why_title: e.target.value }))} /></div>
                <div style={{ marginBottom: 32 }}><label>Why Us - Text</label><textarea rows="4" value={config.why_text} onChange={e => setConfig(p => ({ ...p, why_text: e.target.value }))} /></div>
                <button type="submit" className="btn btn-primary" disabled={savingCMS}>{savingCMS ? "Saving..." : "Save Configuration"}</button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC WEBSITE
  // ═══════════════════════════════════════════════════════════
  const brandName = config.brand_name || "JUST print";

  return (
    <>
      {/* Animated Background Orbs */}
      <div className="bg-orbs">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <div className="bg-orb bg-orb-4" />
      </div>

      {/* 3D Canvas */}
      <div className="canvas-wrapper">
        <div style={{ position: "sticky", top: 80, height: "calc(100vh - 80px)", width: "100%" }}>
          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 7], fov: 40 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
            performance={{ min: 0.5 }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.8} color="#ffffff" />
            <directionalLight position={[-5, -5, -5]} intensity={0.3} color="#FFB347" />
            <Suspense fallback={<SceneLoader />}>
              <PrintScene />
              <Environment preset="city" />
            </Suspense>
          </Canvas>
        </div>
      </div>

      {/* Navigation */}
      <nav className="header">
        <a href="#home" className="logo" style={{ textDecoration: "none" }} onClick={() => setMobileMenuOpen(false)}><div className="logo-dot" /> {brandName}</a>
        <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          <span className={`hamburger ${mobileMenuOpen ? "open" : ""}`}>
            <span /><span /><span />
          </span>
        </button>
        <div className={`nav-links ${mobileMenuOpen ? "nav-open" : ""}`}>
          <a href="#why" onClick={() => setMobileMenuOpen(false)}>Why Us</a>
          <a href="#full-gallery" onClick={() => setMobileMenuOpen(false)}>Gallery</a>
          <a href="#order" onClick={() => setMobileMenuOpen(false)}>Order</a>
          <a href="#track" onClick={() => setMobileMenuOpen(false)}>Track</a>
          <a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>
        </div>
      </nav>

      <main>
        {hash === "#full-gallery" && <FullGalleryView />}
        
        {hash === "#order" && (
          <section className="section-container animate-in" style={{ paddingTop: 140, minHeight: "100vh", position: "relative", zIndex: 10 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", marginBottom: 8 }}>{orderStep === 4 ? "Order Received!" : "Place Order"}</h1>
              {orderStep < 4 && <p style={{ margin: 0 }}>Step {orderStep} of 3</p>}
              {orderStep === 1 && <a href="#home" style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 600 }}>← Cancel</a>}
            </div>
            
            {orderStep < 4 && (
              <div className="stepper" style={{ marginBottom: 40, maxWidth: 500, margin: "0 auto 40px" }}>
                <div className={`stepper-step ${orderStep > 1 ? "completed" : ""} ${orderStep === 1 ? "active" : ""}`}>
                  <div className="stepper-dot">{orderStep > 1 ? <CheckIcon /> : "1"}</div>
                  <span className="stepper-label">Contact</span>
                </div>
                <div className={`stepper-line ${orderStep > 1 ? "filled" : ""}`} />
                <div className={`stepper-step ${orderStep > 2 ? "completed" : ""} ${orderStep === 2 ? "active" : ""}`}>
                  <div className="stepper-dot">{orderStep > 2 ? <CheckIcon /> : "2"}</div>
                  <span className="stepper-label">Details</span>
                </div>
                <div className={`stepper-line ${orderStep > 2 ? "filled" : ""}`} />
                <div className={`stepper-step ${orderStep > 3 ? "completed" : ""} ${orderStep === 3 ? "active" : ""}`}>
                  <div className="stepper-dot">{orderStep > 3 ? <CheckIcon /> : "3"}</div>
                  <span className="stepper-label">Review</span>
                </div>
              </div>
            )}

            <div className="card" style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
              {orderStep === 1 && (
                <div className="animate-in">
                  <div className="form-row">
                    <div>
                      <label>Name *</label>
                      <input value={newOrder.name} onChange={e => setNewOrder(p => ({ ...p, name: e.target.value }))} placeholder="Your name" style={formErrors.name ? { borderColor: '#FF3B30' } : {}} />
                      {formErrors.name && <div style={{ color: "#FF3B30", fontSize: 12, marginTop: 6, fontWeight: 600 }}>{formErrors.name}</div>}
                    </div>
                    <div>
                      <label>Email *</label>
                      <input type="email" value={newOrder.email} onChange={e => setNewOrder(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" style={formErrors.email ? { borderColor: '#FF3B30' } : {}} />
                      {formErrors.email && <div style={{ color: "#FF3B30", fontSize: 12, marginTop: 6, fontWeight: 600 }}>{formErrors.email}</div>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div>
                      <label>Phone (Egypt) *</label>
                      <input value={newOrder.phone} onChange={e => setNewOrder(p => ({ ...p, phone: e.target.value }))} placeholder="01012345678" style={formErrors.phone ? { borderColor: '#FF3B30' } : {}} />
                      {formErrors.phone && <div style={{ color: "#FF3B30", fontSize: 12, marginTop: 6, fontWeight: 600 }}>{formErrors.phone}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                    <button className="btn btn-accent" onClick={() => {
                      const errors = {};
                      if (!newOrder.name) errors.name = "Name is required.";
                      if (!newOrder.email) errors.email = "Email is required.";
                      else if (!isValidEmail(newOrder.email)) errors.email = "Please enter a valid email.";
                      if (!newOrder.phone) errors.phone = "Phone is required.";
                      else if (!isValidEgyptPhone(newOrder.phone)) errors.phone = "Enter a valid Egyptian number (e.g. 01012345678).";
                      setFormErrors(errors);
                      if (Object.keys(errors).length === 0) setOrderStep(2);
                    }}>Next Step →</button>
                  </div>
                </div>
              )}

              {orderStep === 2 && (
                <div className="animate-in">
                  <div className="form-row">
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label>Project Name</label>
                      <input value={newOrder.orderName} onChange={e => setNewOrder(p => ({ ...p, orderName: e.target.value }))} placeholder="My Part" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div>
                      <label>Material</label>
                      <select value={newOrder.material} onChange={e => setNewOrder(p => ({ ...p, material: e.target.value }))}>
                        {config.materials.split(',').map(m => <option key={m}>{m.trim()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Color</label>
                      <select value={newOrder.color} onChange={e => setNewOrder(p => ({ ...p, color: e.target.value }))}>
                        {config.colors.split(',').map(c => <option key={c}>{c.trim()}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label>Notes / Special Instructions</label>
                    <textarea value={newOrder.notes} onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))} placeholder="Infill %, orientation, special requests..." rows="3" />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label>STL or ZIP File(s) *</label>
                    <input type="file" multiple accept=".stl,.zip" onChange={handleFileChange} style={{ padding: "14px", border: formErrors.file ? "2px dashed #FF3B30" : "2px dashed var(--border-glass)", borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.3)" }} />
                    {fileError && <div style={{ color: "#FF3B30", fontSize: 12, marginTop: 8 }}>{fileError}</div>}
                    {formErrors.file && <div style={{ color: "#FF3B30", fontSize: 12, marginTop: 8, fontWeight: 600 }}>{formErrors.file}</div>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                    <button className="btn btn-glass" onClick={() => setOrderStep(1)}>← Back</button>
                    <button className="btn btn-accent" onClick={() => {
                      const errors = {};
                      if (selectedFiles.length === 0) errors.file = "Please upload at least one STL or ZIP file.";
                      setFormErrors(errors);
                      if (Object.keys(errors).length === 0) setOrderStep(3);
                    }}>Review Order →</button>
                  </div>
                </div>
              )}

              {orderStep === 3 && (
                <div className="animate-in">
                  <h3 style={{ marginBottom: 16 }}>Order Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, padding: 20, background: 'rgba(255,255,255,0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    <div><strong>Name:</strong> {newOrder.name}</div>
                    <div><strong>Phone:</strong> {newOrder.phone}</div>
                    <div><strong>Email:</strong> {newOrder.email}</div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-glass)' }}><strong>Project:</strong> {newOrder.orderName || "Untitled"}</div>
                    <div><strong>Material:</strong> {newOrder.material} ({newOrder.color})</div>
                    <div><strong>Files:</strong> {newOrder.fileName}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                    <button className="btn btn-glass" onClick={() => setOrderStep(2)}>← Back</button>
                    <button className="btn btn-primary" style={{ opacity: isUploading ? 0.7 : 1 }} disabled={isUploading} onClick={handleOrderSubmit}>
                      {isUploading ? "Uploading..." : "Submit Order"}
                    </button>
                  </div>
                </div>
              )}
              
              {orderStep === 4 && (
                <div className="animate-in" style={{ textAlign: 'center', padding: "20px 0" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 64, height: 64, color: "var(--status-done)"}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <h2 style={{ marginBottom: 12 }}>Upload Successful!</h2>
                  <p>Your files have been securely uploaded to our print queue.</p>
                  <p>Save this tracking code to check your order status:</p>
                  
                  <div className="tracking-code-display" onClick={() => { copyToClipboard(successModal); }} style={{ margin: "24px auto", maxWidth: 340, cursor: "pointer" }}>
                    <span className="code">{successModal}</span>
                    <span className="copy-hint">Tap to copy</span>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32 }}>
                    <a href="#track" className="btn btn-accent" style={{ width: "100%" }} onClick={() => setOrderStep(1)}>Go Track Your Order</a>
                    <a href="#home" className="btn btn-glass" style={{ width: "100%" }} onClick={() => setOrderStep(1)}>← Back to Home</a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {hash === "#track" && (
          <section className="section-container animate-in" style={{ paddingTop: 140, minHeight: "100vh", position: "relative", zIndex: 10 }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", marginBottom: 12 }}>Track Your Order</h1>
              <p>Enter your tracking code or phone number to see its status.</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
                <div className="queue-badge">
                  <div className="live-dot" />
                  <span><strong>{queuedOrdersCount}</strong> in queue</span>
                </div>
                <a href="#home" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none", fontWeight: 600 }}>← Back to Home</a>
              </div>
            </div>
            
            <div className="card" style={{ maxWidth: 600, margin: "0 auto 40px", width: "100%" }}>
              <div className="track-search-row" style={{ marginBottom: 0 }}>
                <input value={trackSearch} onChange={e => setTrackSearch(e.target.value)} placeholder="Tracking Code (JP-...)" onKeyDown={e => e.key === "Enter" && handleTrackSearch()} />
                <button className="btn btn-primary" onClick={handleTrackSearch}>Search</button>
              </div>
            </div>

            <div style={{ maxWidth: 600, margin: "0 auto" }}>
              {trackResults === "NOT_FOUND" && (
                <div className="card animate-in" style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 48, height: 48, color: "var(--text-tertiary)", marginBottom: 16}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </div>
                  <p style={{ margin: 0 }}>No orders found. Double-check your tracking code or phone number.</p>
                </div>
              )}

              {Array.isArray(trackResults) && trackResults.map(r => (
                <div key={r.id} className="card animate-in" style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>{r.ordername || "Untitled Order"}</h3>
                    {r.tracking_code && <CopyableCode code={r.tracking_code} />}
                  </div>
                  <StatusStepper status={r.status} />
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16, fontSize: 14, color: "var(--text-secondary)" }}>
                    <span>Material: <strong style={{ color: "var(--text-primary)" }}>{r.material}</strong></span>
                    <span>Color: <strong style={{ color: "var(--text-primary)" }}>{r.color}</strong></span>
                    {r.totalprice > 0 && <span>Price: <strong style={{ color: "var(--accent)" }}>{r.totalprice.toFixed(2)} EGP</strong></span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ maxWidth: 600, margin: "40px auto 0", textAlign: "center", padding: 32 }}>
              <h3 style={{ marginBottom: 16 }}>Need Help?</h3>
              <p style={{ fontSize: 14, marginBottom: 24 }}>Contact us directly for support or special requests.</p>
              <div className="contact-buttons" style={{ justifyContent: "center" }}>
                <a href="https://wa.me/" target="_blank" rel="noreferrer" className="btn btn-accent"><WhatsAppIcon /> WhatsApp</a>
                <a href="mailto:hello@justprint.com" className="btn btn-glass"><EmailIcon /> Email Us</a>
              </div>
            </div>
          </section>
        )}

        {(hash !== "#full-gallery" && hash !== "#order" && hash !== "#track") && (
          <>
        {/* ── HERO ── */}
        <section id="home" className="section-container animate-in">
          <FloatingIcons icons={[
            { src: '1.png', size: 140, top: '15%', left: '-10%', delay: '0s', duration: '6s' },
            { src: '2.png', size: 100, bottom: '20%', right: '-5%', delay: '1s', duration: '7s', reverse: true },
            { src: '20.png', size: 80, top: '10%', right: '15%', delay: '2s', duration: '5s' }
          ]} />
          <h1>{config.hero_title}</h1>
          <p>{config.hero_subtitle}</p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <a href="#order" className="btn btn-accent">Place an Order</a>
            <a href="#track" className="btn btn-glass">Track Order</a>
          </div>
        </section>

        {/* ── WHY US ── */}
        <section id="why" className="section-container reveal">
          <FloatingIcons icons={[
            { src: '5.png', size: 120, top: '5%', right: '-8%', delay: '0.5s', duration: '6.5s' },
            { src: '6.png', size: 90, bottom: '10%', left: '-5%', delay: '1.5s', duration: '5.5s', reverse: true }
          ]} />
          <h2>{config.why_title}</h2>
          <p>{config.why_text}</p>
          <div className="feature-cards">
            {[
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 36, height: 36, color: "var(--accent)"}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, title: "Fast Turnaround", desc: "Most orders done in 24–48hrs" },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 36, height: 36, color: "var(--status-done)"}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, title: "Student Pricing", desc: `Just ${config.price_per_gram} EGP/gram` },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 36, height: 36, color: "var(--status-printing)"}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, title: "Precision", desc: "0.2mm layer accuracy" }
            ].map((f, i) => (
              <div key={i} className="card" style={{ textAlign: "center", padding: 28 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: 13, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── GALLERY ── */}
        <section id="gallery" className="gallery-section reveal">
          <FloatingIcons icons={[
            { src: '22.png', size: 110, top: '20%', left: '-12%', delay: '1s', duration: '6s' },
            { src: '7.png', size: 85, bottom: '15%', right: '-10%', delay: '0s', duration: '7s', reverse: true }
          ]} />
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2>Our Work</h2>
            <p style={{ maxWidth: 500, margin: "0 auto" }}>Some of the parts we've printed. Your project could be next.</p>
          </div>
          <div className="gallery-grid">
            {[
              { title: "Custom Gears", desc: "PLA — Mechanical parts" },
              { title: "Phone Stand", desc: "PETG — Functional design" },
              { title: "Miniature Model", desc: "PLA — High detail" },
              { title: "Drone Mount", desc: "Carbon Fiber — Lightweight" },
              { title: "Enclosure", desc: "ABS — Heat resistant" },
              { title: "Art Piece", desc: "TPU — Flexible material" }
            ].map((item, i) => (
              <div key={i} className="gallery-card">
                <div className="gallery-card-img"><CubeIcon /></div>
                <div className="gallery-card-body">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <a href="#full-gallery" className="btn btn-glass">Load More</a>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section id="about" className="section-container reveal">
          <h2>About Us</h2>
          <p>We're a team of student engineers passionate about bringing ideas to life. Our 3D printing setup is calibrated daily for optimal results — from functional prototypes to creative projects.</p>
        </section>

        {/* ── CONTACT ── */}
        <section id="contact" className="section-container reveal">
          <h2>Get In Touch</h2>
          <p>Need a custom order or have questions? We're here to help.</p>
          <div className="contact-buttons">
            <a href="https://wa.me/" target="_blank" rel="noreferrer" className="btn btn-accent" style={{ gap: 10 }}>
              <WhatsAppIcon /> WhatsApp
            </a>
            <a href="mailto:hello@justprint.com" className="btn btn-glass" style={{ gap: 10 }}>
              <EmailIcon /> Email Us
            </a>
          </div>
        </section>
          </>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <div className="footer-brand"><div className="dot" /> {brandName}</div>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: 0 }}>Student-powered 3D printing. Fast, affordable, on campus.</p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <a href="#order">Place Order</a>
            <a href="#track">Track Order</a>
            <a href="#full-gallery">Gallery</a>
            <a href="#about">About</a>
          </div>
          <div className="footer-col">
            <h4>Connect</h4>
            <div className="social-links">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="social-link"><InstagramIcon /></a>
              <a href="https://wa.me/" target="_blank" rel="noreferrer" className="social-link"><WhatsAppIcon /></a>
              <a href="mailto:hello@justprint.com" className="social-link"><EmailIcon /></a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</div>
      </footer>
    </>
  );
}