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
  const [nozzleSize, setNozzleSize] = useState(0.40);
  const [speed, setSpeed] = useState(300);
  const [metrics, setMetrics] = useState(null);
  const [hasSliced, setHasSliced] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

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

  const weight = metrics ? (metrics.filamentWeightGrams || metrics.weightGrams || 0) : (order.weightgrams || 0);
  const time = metrics ? (metrics.printTimeFormatted || 'Calculating...') : '--';
  const autoPrice = metrics ? (metrics.totalPrice || (weight * pricePerGram)) : ((order.weightgrams || 0) * pricePerGram);
  const displayPrice = customPrice !== '' ? parseFloat(customPrice) || 0 : autoPrice;

  function handleApplyToOrder() {
    if (!onUpdateWeightPrice) return;
    onUpdateWeightPrice(order.id, weight, displayPrice);
  }

  function handleTriggerMoonraker() {
    if (!metrics) return;
    const gcode = generateElegooGcode(metrics, order.ordername || 'model');
    if (onOpenMoonraker) {
      onOpenMoonraker(order, gcode);
    }
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, padding: 12 }} onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 1140, width: '96%', height: '88vh', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0, textAlign: 'left', borderRadius: 'var(--radius-md)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(20, 25, 35, 0.9)', flexShrink: 0 }}>
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
          {/* Left: Prominent 3D Viewport */}
          <div style={{ flex: '1 1 620px', minHeight: 460, height: '100%', position: 'relative', background: '#0a0c10' }}>
            <STLViewer
              ref={viewerRef}
              fileUrl={stlUrl}
              infillPercent={infillPercent}
              layerHeight={layerHeight}
              nozzleSize={nozzleSize}
              materialKey={order.material || 'pla'}
              pricePerGram={pricePerGram}
              onMetricsChange={handleMetricsUpdate}
              showSlicerControls={true}
              height="100%"
            />
          </div>

          {/* Right: Slicer Controls & Metrics */}
          <div style={{ flex: '1 1 360px', padding: 22, overflowY: 'auto', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Parameters */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Slicer Profile Settings
              </div>

              <div className="form-row" style={{ marginBottom: 12 }}>
                <div>
                  <label>Layer Height & Profile</label>
                  <select value={layerHeight} onChange={(e) => {
                    const lh = parseFloat(e.target.value);
                    setLayerHeight(lh);
                    if (lh <= 0.10) setNozzleSize(0.20);
                    else setNozzleSize(0.40);
                  }}>
                    <option value={0.10}>0.10 mm (0.2 Nozzle - Elegoo CC)</option>
                    <option value={0.12}>0.12 mm (0.4 Nozzle - Fine)</option>
                    <option value={0.20}>0.20 mm (0.4 Nozzle - Standard)</option>
                    <option value={0.28}>0.28 mm (0.4 Nozzle - Draft)</option>
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
                    <option value={100}>Precision Surface (100 mm/s)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Slicing Metrics Card */}
            <div style={{ padding: 16, background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 12 }}>
                Calculated Print Metrics (1:1 Slicer)
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
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Filament Length</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{metrics?.filamentLengthMeters ? `${metrics.filamentLengthMeters} m` : '--'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Layers</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{metrics?.numLayers ? `${metrics.numLayers} layers` : '--'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Material Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{pricePerGram} EGP/g</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Calculated Price</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{Number(autoPrice).toFixed(2)} EGP</div>
                </div>
              </div>

              {/* Editable Price Field */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ margin: 0, fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>Custom / Override Price (EGP)</label>
                  {customPrice !== '' && (
                    <button
                      type="button"
                      onClick={() => setCustomPrice('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Reset to Auto
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.5"
                  value={customPrice !== '' ? customPrice : Number(autoPrice).toFixed(2)}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  style={{ width: '100%', marginTop: 6, padding: '8px 12px', fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}
                  placeholder="Enter custom price"
                />
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
                style={{ fontSize: 12, padding: '9px 12px', marginTop: 4, fontWeight: 700 }}
              >
                Apply Weight ({weight}g) & Price ({displayPrice.toFixed(2)} EGP) to Order
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
