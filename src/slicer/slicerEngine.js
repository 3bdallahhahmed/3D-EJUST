// src/slicer/slicerEngine.js
// High-Precision Geometric Slicing & Physics-Based Kinematic Engine for Elegoo 3D Printers

export const PRINTER_PROFILES = {
  centauri_carbon: {
    name: "Elegoo Centauri Carbon",
    bed: { x: 256, y: 256, z: 256 },
    nozzle: 0.40,
    extrusionWidth: 0.42,
    maxSpeed: 500, // mm/s
    maxAccel: 20000, // mm/s^2 (CoreXY)
    jerk: 10, // mm/s
    maxVolumetricSpeed: 28.0, // mm^3/s (High-flow ceramic hotend)
    retractDist: 0.8, // mm direct drive
    retractSpeed: 40, // mm/s
    zHop: 0.2, // mm
    firmware: "Klipper (Moonraker)",
    kinematics: "CoreXY",
    defaultHotendTemp: 220,
    defaultBedTemp: 60,
    heatupTimeSeconds: 65,
    bedLevelTimeSeconds: 25,
    defaultIp: "192.168.1.101",
    defaultPort: 7125
  },
  neptune_4_pro: {
    name: "Elegoo Neptune 4 Pro",
    bed: { x: 225, y: 225, z: 265 },
    nozzle: 0.40,
    extrusionWidth: 0.42,
    maxSpeed: 500,
    maxAccel: 12000,
    jerk: 8,
    maxVolumetricSpeed: 22.0,
    retractDist: 0.8,
    retractSpeed: 40,
    zHop: 0.2,
    firmware: "Klipper (Moonraker)",
    kinematics: "Cartesian",
    defaultHotendTemp: 215,
    defaultBedTemp: 60,
    heatupTimeSeconds: 70,
    bedLevelTimeSeconds: 30,
    defaultIp: "192.168.1.102",
    defaultPort: 7125
  },
  neptune_4_max: {
    name: "Elegoo Neptune 4 Max",
    bed: { x: 420, y: 420, z: 480 },
    nozzle: 0.40,
    extrusionWidth: 0.45,
    maxSpeed: 500,
    maxAccel: 10000,
    jerk: 7,
    maxVolumetricSpeed: 24.0,
    retractDist: 0.8,
    retractSpeed: 40,
    zHop: 0.2,
    firmware: "Klipper (Moonraker)",
    kinematics: "Cartesian",
    defaultHotendTemp: 215,
    defaultBedTemp: 65,
    heatupTimeSeconds: 95,
    bedLevelTimeSeconds: 45,
    defaultIp: "192.168.1.103",
    defaultPort: 7125
  }
};

export const MATERIALS = {
  pla: { name: "Elegoo Rapid PLA+", density: 1.24, costPerKg: 22.0, temp: 220, bedTemp: 60 },
  petg: { name: "Elegoo Rapid PETG", density: 1.27, costPerKg: 24.0, temp: 240, bedTemp: 75 },
  abs: { name: "Elegoo ABS", density: 1.04, costPerKg: 25.0, temp: 250, bedTemp: 100 },
  tpu: { name: "Elegoo TPU-95A", density: 1.21, costPerKg: 32.0, temp: 230, bedTemp: 50 },
  asa: { name: "Elegoo ASA", density: 1.07, costPerKg: 28.0, temp: 260, bedTemp: 100 }
};

// Calculate signed volume of 3D mesh in cm3 and bounding dimensions
export function calculateMeshMetrics(geometry) {
  if (!geometry || !geometry.attributes.position) {
    return { volumeCm3: 0, width: 0, depth: 0, height: 0, triangles: 0, surfaceAreaCm2: 0 };
  }

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const width = Math.max(0.1, bbox.max.x - bbox.min.x);
  const depth = Math.max(0.1, bbox.max.y - bbox.min.y);
  const height = Math.max(0.1, bbox.max.z - bbox.min.z);

  const pos = geometry.attributes.position;
  let totalVolume = 0;
  let surfaceArea = 0;

  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
    const cx = pos.getX(i + 2), cy = pos.getY(i + 2), cz = pos.getZ(i + 2);

    // Signed tetrahedron volume
    totalVolume += (
      ax * (by * cz - cy * bz) -
      ay * (bx * cz - cx * bz) +
      az * (bx * cy - cx * by)
    ) / 6;

    // Triangle surface area
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    surfaceArea += 0.5 * Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  }

  const volumeCm3 = Math.max(0.001, Math.abs(totalVolume) / 1000);
  const surfaceAreaCm2 = surfaceArea / 100;

  return {
    width: Math.round(width * 10) / 10,
    depth: Math.round(depth * 10) / 10,
    height: Math.round(height * 10) / 10,
    volumeCm3: Math.round(volumeCm3 * 100) / 100,
    surfaceAreaCm2: Math.round(surfaceAreaCm2 * 10) / 10,
    triangles: Math.floor(pos.count / 3)
  };
}

// Intersect a triangle with a horizontal plane Y = planeY (where Y is height in Three.js world coordinates)
function intersectTriangleWithPlane(p1, p2, p3, planeY) {
  const y1 = p1.y, y2 = p2.y, y3 = p3.y;

  if ((y1 < planeY && y2 < planeY && y3 < planeY) ||
      (y1 > planeY && y2 > planeY && y3 > planeY)) {
    return null;
  }

  const pts = [];

  function checkEdge(a, b, ya, yb) {
    if ((ya < planeY && yb > planeY) || (ya > planeY && yb < planeY)) {
      const t = (planeY - ya) / (yb - ya);
      pts.push({
        x: a.x + t * (b.x - a.x),
        y: a.z + t * (b.z - a.z), // Map Z in 3D to Y on 2D slice plane
        z: planeY
      });
    } else if (ya === planeY) {
      pts.push({ x: a.x, y: a.z, z: planeY });
    }
  }

  checkEdge(p1, p2, y1, y2);
  checkEdge(p2, p3, y2, y3);
  checkEdge(p3, p1, y3, y1);

  if (pts.length >= 2) {
    return [pts[0], pts[1]];
  }
  return null;
}

// Extract exact planar cross-section segments from 3D geometry
export function extractLayerPlanarSegments(geometry, planeY) {
  const pos = geometry.attributes.position;
  const segments = [];

  const p1 = { x: 0, y: 0, z: 0 };
  const p2 = { x: 0, y: 0, z: 0 };
  const p3 = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < pos.count; i += 3) {
    p1.x = pos.getX(i); p1.y = pos.getY(i); p1.z = pos.getZ(i);
    p2.x = pos.getX(i + 1); p2.y = pos.getY(i + 1); p2.z = pos.getZ(i + 1);
    p3.x = pos.getX(i + 2); p3.y = pos.getY(i + 2); p3.z = pos.getZ(i + 2);

    const seg = intersectTriangleWithPlane(p1, p2, p3, planeY);
    if (seg) {
      segments.push(seg);
    }
  }

  return segments;
}

// Point in polygon test for scanline infill clipping
function isPointInsideSegments(px, py, segments) {
  let inside = false;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const x1 = s[0].x, y1 = s[0].y;
    const x2 = s[1].x, y2 = s[1].y;

    const intersect = ((y1 > py) !== (y2 > py)) &&
      (px < (x2 - x1) * (py - y1) / (y2 - y1 + 1e-9) + x1);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Fast estimation for real-time UI updates (without full toolpath geometry generation)
export function estimatePrintMetrics(geometry, settings = {}) {
  const metrics = calculateMeshMetrics(geometry);
  const printer = PRINTER_PROFILES[settings.printerId] || PRINTER_PROFILES.centauri_carbon;
  
  // Resolve material density
  let density = 1.24; // default PLA
  const matKey = (settings.materialKey || settings.material || "pla").toLowerCase();
  if (matKey.includes("petg")) density = MATERIALS.petg.density;
  else if (matKey.includes("abs")) density = MATERIALS.abs.density;
  else if (matKey.includes("tpu")) density = MATERIALS.tpu.density;
  else if (matKey.includes("asa")) density = MATERIALS.asa.density;
  else if (MATERIALS[matKey]) density = MATERIALS[matKey].density;

  const infillPercent = settings.infillPercent !== undefined ? settings.infillPercent : 20;
  const layerHeight = settings.layerHeight || 0.20;
  const pricePerGram = parseFloat(settings.pricePerGram) || 3.0; // EGP per gram

  // Effective volume calculation:
  // Outer shell (walls + top/bottom skins) has ~100% density for ~1.2mm thickness
  // Inner core uses the infill density
  const wallThickness = 1.2; // mm
  const minDim = Math.min(metrics.width, metrics.depth, metrics.height);
  const shellRatio = Math.min(1.0, (wallThickness * 2) / Math.max(minDim, 5));
  const infillRatio = infillPercent / 100;
  const effectiveVolumeCm3 = metrics.volumeCm3 * (shellRatio + (1 - shellRatio) * infillRatio);

  const weightGrams = Math.max(0.5, effectiveVolumeCm3 * density);
  const totalPrice = weightGrams * pricePerGram;

  // Kinematic print time estimation
  const filamentRadiusMm = 1.75 / 2;
  const filamentCrossSectionArea = Math.PI * filamentRadiusMm * filamentRadiusMm;
  const filamentLengthMm = (effectiveVolumeCm3 * 1000) / filamentCrossSectionArea;
  const filamentLengthMeters = filamentLengthMm / 1000;

  // Extruded path length & speed
  const numLayers = Math.max(1, Math.ceil(metrics.height / layerHeight));
  const speed = settings.speed || 250;
  const effectiveSpeedMmS = Math.min(speed, printer.maxSpeed) * 0.65;
  const totalPathDistanceMm = filamentLengthMm * 14;
  const totalSeconds = (totalPathDistanceMm / effectiveSpeedMmS) + (numLayers * 1.2) + printer.heatupTimeSeconds;

  const printHours = Math.floor(totalSeconds / 3600);
  const printMinutes = Math.max(1, Math.ceil((totalSeconds % 3600) / 60));

  // Fits Centauri Carbon bed check
  const fitsBed = (
    metrics.width <= printer.bed.x &&
    metrics.depth <= printer.bed.y &&
    metrics.height <= printer.bed.z
  );

  return {
    metrics,
    weightGrams: Math.round(weightGrams * 10) / 10,
    filamentLengthMeters: Math.round(filamentLengthMeters * 10) / 10,
    totalPrice: Math.round(totalPrice * 100) / 100,
    totalSeconds: Math.ceil(totalSeconds),
    printTimeFormatted: `${printHours}h ${printMinutes}m`,
    numLayers,
    fitsBed,
    printerBed: printer.bed
  };
}

// Complete slice engine with exact planar segments for 3D visualization
export function sliceMesh(geometry, settings = {}) {
  const metrics = calculateMeshMetrics(geometry);
  const printer = PRINTER_PROFILES[settings.printerId] || PRINTER_PROFILES.centauri_carbon;
  
  let material = MATERIALS.pla;
  const matKey = (settings.materialKey || settings.material || "pla").toLowerCase();
  if (matKey.includes("petg")) material = MATERIALS.petg;
  else if (matKey.includes("abs")) material = MATERIALS.abs;
  else if (matKey.includes("tpu")) material = MATERIALS.tpu;
  else if (matKey.includes("asa")) material = MATERIALS.asa;
  else if (MATERIALS[matKey]) material = MATERIALS[matKey];

  const layerHeight = settings.layerHeight || 0.20;
  const firstLayerHeight = settings.firstLayerHeight || 0.24;
  const infillPercent = settings.infillPercent !== undefined ? settings.infillPercent : 20;
  const wallCount = settings.wallCount || 2;
  const speed = settings.speed || 300;
  const pricePerGram = parseFloat(settings.pricePerGram) || 3.0;

  const totalHeight = metrics.height;
  const numLayers = Math.max(1, Math.ceil((totalHeight - firstLayerHeight) / layerHeight) + 1);

  const nozzleW = printer.extrusionWidth;
  const beadArea = (nozzleW - layerHeight) * layerHeight + (Math.PI * 0.25 * layerHeight * layerHeight);
  const filamentCrossSectionArea = Math.PI * (1.75 / 2) * (1.75 / 2);

  const outerWallSpeed = Math.min(speed * 0.45, 150);
  const innerWallSpeed = Math.min(speed * 0.75, 250);
  const infillSpeed = Math.min(speed, printer.maxSpeed);
  const solidSkinSpeed = Math.min(speed * 0.5, 160);

  const maxFlowSpeed = printer.maxVolumetricSpeed / (nozzleW * layerHeight);
  const clampedInfillSpeed = Math.min(infillSpeed, maxFlowSpeed);

  let totalExtrudedDistanceMm = 0;
  let totalKinematicTimeSeconds = printer.heatupTimeSeconds + printer.bedLevelTimeSeconds;

  function calculateTrapezoidTime(dist, targetSpeed) {
    if (dist <= 0) return 0;
    const a = printer.maxAccel;
    const v0 = printer.jerk;
    const vMax = Math.min(targetSpeed, maxFlowSpeed);

    const dAccel = (vMax * vMax - v0 * v0) / (2 * a);
    if (2 * dAccel > dist) {
      const vPeak = Math.sqrt(v0 * v0 + a * dist);
      return (2 * (vPeak - v0)) / a;
    } else {
      const tAccel = (vMax - v0) / a;
      const cruiseDist = dist - 2 * dAccel;
      const tCruise = cruiseDist / vMax;
      return 2 * tAccel + tCruise;
    }
  }

  const toolpathLayers = [];

  for (let l = 0; l < numLayers; l++) {
    const currentY = l === 0 ? firstLayerHeight : firstLayerHeight + (l * layerHeight);
    const isSolid = l < 3 || l >= numLayers - 3;

    const planarSegments = extractLayerPlanarSegments(geometry, currentY);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    planarSegments.forEach(seg => {
      minX = Math.min(minX, seg[0].x, seg[1].x);
      maxX = Math.max(maxX, seg[0].x, seg[1].x);
      minY = Math.min(minY, seg[0].y, seg[1].y);
      maxY = Math.max(maxY, seg[0].y, seg[1].y);
    });

    const hasGeometry = planarSegments.length > 0 && isFinite(minX);
    const outerWallSegments = [];
    const innerWallSegments = [];

    if (hasGeometry) {
      planarSegments.forEach(seg => {
        outerWallSegments.push(seg);
        const dist = Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
        totalExtrudedDistanceMm += dist;
        totalKinematicTimeSeconds += calculateTrapezoidTime(dist, outerWallSpeed);
      });

      for (let w = 1; w < wallCount; w++) {
        const offset = w * nozzleW;
        planarSegments.forEach(seg => {
          const dx = seg[1].x - seg[0].x;
          const dy = seg[1].y - seg[0].y;
          const len = Math.hypot(dx, dy);
          if (len > 0.1) {
            const nx = -dy / len * offset;
            const ny = dx / len * offset;
            const inSeg = [
              { x: seg[0].x + nx, y: seg[0].y + ny, z: currentY },
              { x: seg[1].x + nx, y: seg[1].y + ny, z: currentY }
            ];
            innerWallSegments.push(inSeg);
            totalExtrudedDistanceMm += len;
            totalKinematicTimeSeconds += calculateTrapezoidTime(len, innerWallSpeed);
          }
        });
      }
    }

    const infillSegments = [];
    if (hasGeometry && (infillPercent > 0 || isSolid)) {
      const spacing = isSolid ? nozzleW * 1.05 : Math.max(nozzleW * 2, 25 / Math.max(infillPercent, 1));

      for (let y = minY + nozzleW; y <= maxY - nozzleW; y += spacing) {
        const lineStart = { x: minX + nozzleW, y: y };
        const lineEnd = { x: maxX - nozzleW, y: y };
        const span = lineEnd.x - lineStart.x;
        const testPoints = Math.max(4, Math.ceil(span / 1.5));
        let activeSegStart = null;

        for (let s = 0; s <= testPoints; s++) {
          const px = lineStart.x + (s / testPoints) * span;
          const inside = isPointInsideSegments(px, y, planarSegments);

          if (inside && !activeSegStart) {
            activeSegStart = { x: px, y: y, z: currentY };
          } else if (!inside && activeSegStart) {
            const activeSegEnd = { x: px, y: y, z: currentY };
            const dist = Math.hypot(activeSegEnd.x - activeSegStart.x, activeSegEnd.y - activeSegStart.y);
            if (dist > 0.5) {
              infillSegments.push([activeSegStart, activeSegEnd]);
              totalExtrudedDistanceMm += dist;
              totalKinematicTimeSeconds += calculateTrapezoidTime(dist, isSolid ? solidSkinSpeed : clampedInfillSpeed);
            }
            activeSegStart = null;
          }
        }
        if (activeSegStart) {
          const activeSegEnd = { x: lineEnd.x, y: y, z: currentY };
          const dist = Math.hypot(activeSegEnd.x - activeSegStart.x, activeSegEnd.y - activeSegStart.y);
          if (dist > 0.5) {
            infillSegments.push([activeSegStart, activeSegEnd]);
            totalExtrudedDistanceMm += dist;
            totalKinematicTimeSeconds += calculateTrapezoidTime(dist, isSolid ? solidSkinSpeed : clampedInfillSpeed);
          }
        }
      }
    }

    totalKinematicTimeSeconds += (printer.retractDist / printer.retractSpeed) * 2 + 0.12;

    toolpathLayers.push({
      layerIndex: l + 1,
      heightZ: Math.round(currentY * 100) / 100,
      outerWall: outerWallSegments,
      innerWall: innerWallSegments,
      infill: infillSegments,
      isSolid
    });
  }

  const totalExtrudedVolumeMm3 = totalExtrudedDistanceMm * beadArea;
  const totalExtrudedVolumeCm3 = totalExtrudedVolumeMm3 / 1000;
  const filamentWeightGrams = Math.max(0.1, totalExtrudedVolumeCm3 * material.density);
  const filamentLengthMm = totalExtrudedVolumeMm3 / filamentCrossSectionArea;
  const filamentLengthMeters = filamentLengthMm / 1000;

  const totalSeconds = Math.ceil(totalKinematicTimeSeconds);
  const printHours = Math.floor(totalSeconds / 3600);
  const printMinutes = Math.max(1, Math.ceil((totalSeconds % 3600) / 60));
  const totalPrice = filamentWeightGrams * pricePerGram;

  return {
    metrics,
    printer,
    material,
    numLayers,
    layerHeight,
    firstLayerHeight,
    filamentWeightGrams: Math.round(filamentWeightGrams * 10) / 10,
    filamentLengthMeters: Math.round(filamentLengthMeters * 10) / 10,
    volumetricExtrusionCm3: Math.round(totalExtrudedVolumeCm3 * 10) / 10,
    printingTimeSeconds: totalSeconds,
    printTimeFormatted: `${printHours}h ${printMinutes}m`,
    totalPrice: Math.round(totalPrice * 100) / 100,
    toolpathLayers
  };
}

// Generate valid Elegoo Centauri Carbon Klipper G-Code
export function generateElegooGcode(sliceResult, fileName = "model") {
  const { printer, material, numLayers, layerHeight, firstLayerHeight, toolpathLayers, metrics } = sliceResult;
  const dateStr = new Date().toISOString();

  let gcode = `; ==========================================================================\n`;
  gcode += `; ELEGOO CENTAURI CARBON SLICER OS - PRODUCTION G-CODE\n`;
  gcode += `; Generated: ${dateStr}\n`;
  gcode += `; Target Printer: ${printer.name} (${printer.firmware})\n`;
  gcode += `; Nozzle: ${printer.nozzle} mm | Width: ${printer.extrusionWidth} mm\n`;
  gcode += `; Material: ${material.name} (${material.density} g/cm3)\n`;
  gcode += `; Total Layers: ${numLayers} | Layer Height: ${layerHeight} mm\n`;
  gcode += `; Estimated Print Time: ${sliceResult.printTimeFormatted}\n`;
  gcode += `; Filament Mass: ${sliceResult.filamentWeightGrams} g (${sliceResult.filamentLengthMeters} m)\n`;
  gcode += `; Dimensions: ${metrics.width} x ${metrics.depth} x ${metrics.height} mm\n`;
  gcode += `; ==========================================================================\n\n`;

  gcode += `; --- START G-CODE ---\n`;
  gcode += `M140 S${material.bedTemp} ; Bed temp\n`;
  gcode += `M104 S${material.temp} ; Hotend temp\n`;
  gcode += `G90 ; Absolute coords\n`;
  gcode += `M83 ; Extruder relative\n`;
  gcode += `G28 ; Home\n`;
  gcode += `M190 S${material.bedTemp} ; Wait bed temp\n`;
  gcode += `M109 S${material.temp} ; Wait hotend temp\n`;
  gcode += `BED_MESH_PROFILE LOAD=default\n`;
  gcode += `G1 Z2.0 F3000\n`;
  gcode += `G1 X0.1 Y20 Z0.3 F5000.0\n`;
  gcode += `G1 X0.1 Y200.0 Z0.3 F1500.0 E15\n`;
  gcode += `G1 X0.4 Y200.0 Z0.3 F5000.0\n`;
  gcode += `G1 X0.4 Y20 Z0.3 F1500.0 E30\n`;
  gcode += `G92 E0\n`;
  gcode += `G1 Z2.0 F3000\n\n`;

  const beadArea = (printer.extrusionWidth - layerHeight) * layerHeight + (Math.PI * 0.25 * layerHeight * layerHeight);
  const filamentArea = Math.PI * (1.75 / 2) * (1.75 / 2);

  for (const layer of toolpathLayers) {
    gcode += `; LAYER:${layer.layerIndex} | Z=${layer.heightZ.toFixed(2)}\n`;
    gcode += `G1 Z${layer.heightZ.toFixed(2)} F3000\n`;

    if (layer.outerWall && layer.outerWall.length > 0) {
      gcode += `; TYPE:Outer wall\n`;
      layer.outerWall.forEach(seg => {
        const dist = Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
        const eVal = ((dist * beadArea) / filamentArea).toFixed(4);
        gcode += `G0 X${seg[0].x.toFixed(3)} Y${seg[0].y.toFixed(3)} F9000 ; Travel\n`;
        gcode += `G1 X${seg[1].x.toFixed(3)} Y${seg[1].y.toFixed(3)} E${eVal} F5400\n`;
      });
    }

    if (layer.innerWall && layer.innerWall.length > 0) {
      gcode += `; TYPE:Inner wall\n`;
      layer.innerWall.forEach(seg => {
        const dist = Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
        const eVal = ((dist * beadArea) / filamentArea).toFixed(4);
        gcode += `G0 X${seg[0].x.toFixed(3)} Y${seg[0].y.toFixed(3)} F9000 ; Travel\n`;
        gcode += `G1 X${seg[1].x.toFixed(3)} Y${seg[1].y.toFixed(3)} E${eVal} F7200\n`;
      });
    }

    if (layer.infill && layer.infill.length > 0) {
      gcode += layer.isSolid ? `; TYPE:Top/Bottom skin\n` : `; TYPE:Infill\n`;
      layer.infill.forEach(seg => {
        const dist = Math.hypot(seg[1].x - seg[0].x, seg[1].y - seg[0].y);
        const eVal = ((dist * beadArea) / filamentArea).toFixed(4);
        gcode += `G0 X${seg[0].x.toFixed(3)} Y${seg[0].y.toFixed(3)} F12000 ; Travel\n`;
        gcode += `G1 X${seg[1].x.toFixed(3)} Y${seg[1].y.toFixed(3)} E${eVal} F9000\n`;
      });
    }
  }

  gcode += `\n; --- END G-CODE ---\n`;
  gcode += `M104 S0 ; Turn off hotend\n`;
  gcode += `M140 S0 ; Turn off bed\n`;
  gcode += `M106 S0 ; Turn off fan\n`;
  gcode += `G91 ; Relative coords\n`;
  gcode += `G1 Z10 F3000 ; Lift nozzle\n`;
  gcode += `G90 ; Absolute coords\n`;
  gcode += `G1 X10 Y240 F6000 ; Present print\n`;
  gcode += `M84 ; Disable steppers\n`;

  return gcode;
}
