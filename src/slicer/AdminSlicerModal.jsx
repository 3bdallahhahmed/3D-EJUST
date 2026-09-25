// src/slicer/AdminSlicerModal.jsx
// Full Slicer & 3D Model Inspection Modal for Admin Command Center

import React, { useState, useRef } from 'react';
import STLViewer from './STLViewer.jsx';
import { generateElegooGcode } from './slicerEngine.js';

export default function AdminSlicerModal({
  isOpen,
  onClose,
  order,
  pricePerGram = 3.0,
  onUpdateWeightPrice,
  onOpenMoonraker
}) {
  const viewerRef = useRef(null);

  const [infillPercent, setInfillPercent] = useState(20);
  const [layerHeight, setLayerHeight] = useState(0.20);
  const [speed, setSpeed] = useState(300);
  const [metrics, setMetrics] = useState(null);
  const [hasSliced, setHasSliced] = useState(false);

  if (!isOpen || !order) return null;

  // Find STL URL
  const fileUrls = (order.fileurl || '').split(',').filter(Boolean);
  const stlUrl = fileUrls.find(u => u.toLowerCase().endsWith('.stl')) || fileUrls[0];

  function handleMetricsUpdate(data) {
    setMetrics(data);
    if (data && data.toolpathLayers) {
      setHasSliced(true);
    }
  }

  function handleDownloadGcode() {
    if (!metrics) return;
    const gcode = generateElegooGcode(metrics, order.ordername || 'model');
    const blob = new Blob([gcode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Centauri_${(order.ordername || 'job').replace(/\s+/g, '_')}.gcode`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleApplyToOrder() {
    if (!metrics || !onUpdateWeightPrice) return;
    onUpdateWeightPrice(order.id, metrics.filamentWeightGrams || metrics.weightGrams);
  }

  function handleTriggerMoonraker() {
    if (!metrics) return;
    const gcode = generateElegooGcode(metrics, order.ordername || 'model');
    if (onOpenMoonraker) {
      onOpenMoonraker(order, gcode);
    }
  }

  const weight = metrics ? (metrics.filamentWeightGrams || metrics.weightGrams || 0) : (order.weightgrams || 0);
  const time = metrics ? (metrics.printTimeFormatted || 'Calculating...') : '--';
  const price = metrics ? (metrics.totalPrice || (weight * pricePerGram)) : ((order.weightgrams || 0) * pricePerGram);

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, padding: 16 }} onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 960, width: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0, textAlign: 'left', borderRadius: 'var(--radius-md)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(20, 25, 35, 0.85)' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Elegoo Centauri Slicer Studio</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Order: <strong>{order.ordername || 'Untitled'}</strong> &bull; {order.name} &bull; {order.tracking_code}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-glass"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: 12 }}
          >
            Close
          </button>
        </div>

        {/* Body Split */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexWrap: 'wrap' }}>
          {/* Left: 3D Viewport */}
          <div style={{ flex: '1 1 500px', minHeight: 380, position: 'relative', background: '#0a0c10' }}>
            <STLViewer
              ref={viewerRef}
              fileUrl={stlUrl}
              infillPercent={infillPercent}
              layerHeight={layerHeight}
              materialKey={order.material || 'pla'}
              pricePerGram={pricePerGram}
              onMetricsChange={handleMetricsUpdate}
              showSlicerControls={true}
              height="100%"
            />
          </div>

          {/* Right: Slicer Controls & Metrics */}
          <div style={{ flex: '1 1 340px', padding: 20, overflowY: 'auto', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Parameters */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Slicer Profile Settings
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <div>
                  <label>Layer Height</label>
                  <select value={layerHeight} onChange={(e) => setLayerHeight(parseFloat(e.target.value))}>
                    <option value={0.12}>0.12 mm (Fine)</option>
                    <option value={0.20}>0.20 mm (Standard)</option>
                    <option value={0.28}>0.28 mm (Draft)</option>
                  </select>
                </div>
                <div>
                  <label>Infill Density</label>
                  <select value={infillPercent} onChange={(e) => setInfillPercent(parseInt(e.target.value, 10))}>
                    <option value={15}>15% (Draft)</option>
                    <option value={20}>20% (Standard)</option>
                    <option value={50}>50% (High Strength)</option>
                    <option value={100}>100% (Solid)</option>
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label>Printing Speed</label>
                  <select value={speed} onChange={(e) => setSpeed(parseInt(e.target.value, 10))}>
                    <option value={300}>High Speed (300 mm/s) - CoreXY</option>
                    <option value={180}>Balanced (180 mm/s)</option>
                    <option value={80}>Silent Precision (80 mm/s)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Slicing Metrics Card */}
            <div style={{ padding: 16, background: 'rgba(0, 0, 0, 0.25)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Calculated Print Metrics
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Print Duration</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{time}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Filament Mass</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{weight} g</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Material Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{pricePerGram} EGP/g</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Calculated Price</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>{Number(price).toFixed(2)} EGP</div>
                </div>
              </div>

              {metrics && metrics.metrics && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-glass)', fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Dimensions: {metrics.metrics.width} x {metrics.metrics.depth} x {metrics.metrics.height} mm</span>
                  <span>{metrics.numLayers || 0} Layers</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => viewerRef.current && viewerRef.current.slice()}
                style={{ width: '100%', fontSize: 13, padding: '10px 16px' }}
              >
                {hasSliced ? 'Re-Slice Toolpaths' : 'Generate Sliced Toolpaths'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleTriggerMoonraker}
                  style={{ fontSize: 12, padding: '8px 12px' }}
                >
                  Send to Printer
                </button>
                <button
                  type="button"
                  className="btn btn-glass"
                  onClick={handleDownloadGcode}
                  style={{ fontSize: 12, padding: '8px 12px' }}
                >
                  Download G-Code
                </button>
              </div>

              <button
                type="button"
                className="btn btn-glass"
                onClick={handleApplyToOrder}
                style={{ fontSize: 12, padding: '8px 12px', marginTop: 4 }}
              >
                Apply Weight ({weight}g) to Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
