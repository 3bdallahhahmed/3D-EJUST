// src/slicer/MoonrakerDispatchModal.jsx
// Moonraker Klipper Farm Transmission Modal for Centurai Print OS

import React, { useState } from 'react';
import { PRINTER_PROFILES } from './slicerEngine.js';

export default function MoonrakerDispatchModal({
  isOpen,
  onClose,
  order,
  gcodeString,
  fileName = 'model',
  onDispatchSuccess
}) {
  const [selectedPrinter, setSelectedPrinter] = useState('CC Abdalla');
  const [printerIp, setPrinterIp] = useState('192.168.1.101');
  const [printerPort, setPrinterPort] = useState(7125);
  const [autoStartPrint, setAutoStartPrint] = useState(true);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [statusLog, setStatusLog] = useState(['Ready to transmit job to Elegoo Centauri Carbon.']);
  const [transmitSuccess, setTransmitSuccess] = useState(false);

  if (!isOpen) return null;

  function appendLog(msg) {
    setStatusLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  function handlePrinterChange(pName) {
    setSelectedPrinter(pName);
    if (pName === 'CC Mazen') {
      setPrinterIp('192.168.1.102');
    } else {
      setPrinterIp('192.168.1.101');
    }
  }

  async function handleTransmit() {
    setIsTransmitting(true);
    setTransmitSuccess(false);
    setStatusLog([]);
    appendLog(`Connecting to Moonraker at http://${printerIp}:${printerPort}...`);

    try {
      // Create G-code Blob
      const gcodeBlob = new Blob([gcodeString || '; G-code not provided\n'], { type: 'text/plain' });
      const safeName = (fileName || 'centauri_job').replace(/[^a-zA-Z0-9_-]/g, '_') + '.gcode';

      appendLog(`Preparing G-Code file: ${safeName} (${(gcodeBlob.size / 1024).toFixed(1)} KB)`);

      const formData = new FormData();
      formData.append('file', gcodeBlob, safeName);
      if (autoStartPrint) {
        formData.append('print', 'true');
      }

      // Transmit to Moonraker API
      appendLog('Transmitting payload to /server/files/upload...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const endpoint = `http://${printerIp}:${printerPort}/server/files/upload`;
      
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (netErr) {
        clearTimeout(timeoutId);
        throw new Error(
          `Local network unreachable (${netErr.message || 'CORS or Timeout'}). ` +
          `Verify printer Wi-Fi or ensure Moonraker allows web origins.`
        );
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Printer responded with status ${res.status}: ${text}`);
      }

      const data = await res.json();
      appendLog(`Upload successful: ${data.item ? data.item.path : 'File received'}`);
      if (autoStartPrint) {
        appendLog('Print start command issued to Klipper.');
      }
      appendLog(`Hardware status: Printing on ${selectedPrinter}`);
      setTransmitSuccess(true);

      if (onDispatchSuccess) {
        onDispatchSuccess(selectedPrinter);
      }
    } catch (err) {
      appendLog(`Transmission notice: ${err.message}`);
      appendLog('You can download the .gcode file or manually mark the order as printing.');
    } finally {
      setIsTransmitting(false);
    }
  }

  // Fallback to manual mark
  function handleManualMarkPrinting() {
    if (onDispatchSuccess) {
      onDispatchSuccess(selectedPrinter);
    }
    onClose();
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 520, width: '100%', padding: 32, textAlign: 'left' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>Moonraker Printer Dispatch</h2>
          <button
            type="button"
            className="btn btn-sm btn-glass"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {order && (
          <div style={{ padding: '10px 14px', background: 'rgba(255, 128, 0, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255, 128, 0, 0.2)', marginBottom: 20, fontSize: 13 }}>
            <div>Job: <strong>{order.ordername || 'Untitled'}</strong> ({order.name})</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>Material: {order.material} ({order.color})</div>
          </div>
        )}

        <div className="form-row" style={{ marginBottom: 16 }}>
          <div>
            <label>Target Hardware</label>
            <select value={selectedPrinter} onChange={(e) => handlePrinterChange(e.target.value)}>
              <option value="CC Abdalla">CC Abdalla (CoreXY)</option>
              <option value="CC Mazen">CC Mazen (CoreXY)</option>
            </select>
          </div>
          <div>
            <label>Printer IP Address</label>
            <input
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="192.168.1.101"
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={autoStartPrint}
              onChange={(e) => setAutoStartPrint(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            Start printing immediately after upload
          </label>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>Transmission Console</label>
          <div style={{ background: '#080a0f', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: 12, height: 130, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#a0aec0', lineHeight: 1.6 }}>
            {statusLog.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-glass"
            onClick={handleManualMarkPrinting}
            style={{ fontSize: 13, padding: '10px 18px' }}
          >
            Mark Printing on {selectedPrinter}
          </button>

          <button
            type="button"
            className="btn btn-accent"
            disabled={isTransmitting}
            onClick={handleTransmit}
            style={{ fontSize: 13, padding: '10px 20px', fontWeight: 800 }}
          >
            {isTransmitting ? 'Transmitting...' : 'Send to Printer'}
          </button>
        </div>
      </div>
    </div>
  );
}
