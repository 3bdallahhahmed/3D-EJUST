const fs = require('fs');

const file = 'C:/Users/USER/Downloads/3d app/3d-print-manager/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

// 3a. Replace VALID_HASHES constant
content = content.replace(
  'const VALID_HASHES = ["", "#home", "#order", "#track", "#full-gallery", "#boss", "#why", "#about", "#contact", "#gallery"];',
  `const BASE_PATH = import.meta.env.BASE_URL || '/3D-EJUST/';
function getPath() {
  const p = window.location.pathname.replace(BASE_PATH, '/').replace(/\\/+/g, '/');
  return p === '/' ? '/home' : p;
}
function navigate(to) {
  window.history.pushState(null, '', BASE_PATH.replace(/\\/$/, '') + to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
const VALID_PATHS = ["/home", "/order", "/track", "/full-gallery", "/boss", "/why", "/about", "/contact", "/gallery"];`
);

// 3b. Replace hash state initialization
content = content.replace(
  'const [hash, setHash] = useState(window.location.hash);',
  'const [path, setPath] = useState(getPath());'
);

// 3c. Replace the hashchange listener
const hashchangeListener = `    function checkHash() {
      const newHash = window.location.hash;
      // Reset order wizard when navigating away from #order
      if (newHash !== "#order") {
        setOrderStep(1);
      }
      // Close all modals/editors when navigating away
      setEditingGalleryItem(null);
      setActiveGalleryItem(null);
      setConfirmModal(null);
      setEditingOrder(null);
      setMobileMenuOpen(false);
      setHash(newHash);
    }
    window.addEventListener("hashchange", checkHash);
    return () => { subscription.unsubscribe(); window.removeEventListener("hashchange", checkHash); };`;

const popstateListener = `    function checkPath() {
      const newPath = getPath();
      // Reset order wizard when navigating away from /order
      if (newPath !== "/order") {
        setOrderStep(1);
      }
      // Close all modals/editors when navigating away
      setEditingGalleryItem(null);
      setActiveGalleryItem(null);
      setConfirmModal(null);
      setEditingOrder(null);
      setMobileMenuOpen(false);
      setPath(newPath);
    }
    window.addEventListener("popstate", checkPath);
    return () => { subscription.unsubscribe(); window.removeEventListener("popstate", checkPath); };`;

content = content.replace(hashchangeListener, popstateListener);

// 3d. Replace ALL hash comparisons throughout the file
content = content.replace(/hash === "#(home|order|track|full-gallery|boss|why|about|contact|gallery)"/g, 'path === "/$1"');
content = content.replace(/hash !== "#(home|order|track|full-gallery|boss|why|about|contact|gallery)"/g, 'path !== "/$1"');
content = content.replace(/!\["#full-gallery", "#boss", "#order", "#track", "#home", ""\]\.includes\(hash\)/g, '!["/full-gallery", "/boss", "/order", "/track", "/home"].includes(path)');
content = content.replace(/hash\.replace\("#", ""\)/g, 'path.replace("/", "")');
content = content.replace(/VALID_HASHES\.includes\(hash\)/g, 'VALID_PATHS.includes(path)');
content = content.replace(/\[hash, isAdmin\]/g, '[path, isAdmin]');
content = content.replace(/}, \[hash\]\)/g, '}, [path])');
content = content.replace(/if \(hash && !/g, 'if (path && !');

// Replace link hrefs
// Standard links with no onClick
content = content.replace(/<a href="#(home|order|track|boss|contact|why|full-gallery|about|gallery)"([^>]*)>/g, (match, p1, p2) => {
  if (p2.includes('onClick')) return match; // skip if it already has an onClick
  return `<a href="/${p1}" onClick={(e) => { e.preventDefault(); navigate('/${p1}'); }}${p2}>`;
});

// nav-links with onClick={() => setMobileMenuOpen(false)}
content = content.replace(/<a href="#(home|order|track|boss|contact|why|full-gallery|about|gallery)"([^>]*)onClick=\{\(\) => setMobileMenuOpen\(false\)\}([^>]*)>/g, (match, p1, p2, p3) => {
  return `<a href="/${p1}"${p2}onClick={(e) => { e.preventDefault(); navigate('/${p1}'); setMobileMenuOpen(false); }}${p3}>`;
});

// Other links that have onClick that sets order step 1
content = content.replace(/<a href="#(home|order|track|boss|contact|why|full-gallery|about|gallery)"([^>]*)onClick=\{\(\) => setOrderStep\(1\)\}([^>]*)>/g, (match, p1, p2, p3) => {
  return `<a href="/${p1}"${p2}onClick={(e) => { e.preventDefault(); navigate('/${p1}'); setOrderStep(1); }}${p3}>`;
});

// Signout
content = content.replace(/window\.location\.hash = "";/g, "navigate('/home');");
// NotFoundPage
content = content.replace(/window\.location\.hash = "#home";/g, "navigate('/home');");

// The main application components check "hash ===" or similar, but we replaced the conditionals above.
// Let's do a general hash variable replacement for others:
// e.g. setHash to setPath is handled except if there are any usages of setHash
// We already replaced the setHash(newHash) with setPath(newPath).
// What if there are remaining setHash(...) calls? There aren't any, we only had it in checkHash.

fs.writeFileSync(file, content, 'utf8');
console.log("Refactoring complete");
