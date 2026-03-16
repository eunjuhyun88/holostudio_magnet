<script lang="ts">
  import { onMount } from "svelte";
  import type { Job, Node, Worker } from "../utils/types.ts";
  import { isWorkerActiveState } from "../utils/meshSim.ts";
  import { isLandAt } from "../utils/landMask.ts";
  import { CITIES } from "../data/cities.ts";
  import { ARC_PAIRS } from "../data/arcPairs.ts";

  // ── Mini Pixel Owl for "My GPU" node ──
  const OWL_COLORS: Record<string, string> = {
    'K': '#2D2D2D', 'T': '#D97757', 't': '#E8956E', 'S': '#C4644A',
    'W': '#FFFFFF', 'P': '#1A1A1A', 'F': '#FAF0EB', 'f': '#EDD8CB',
    'C': '#E8D5C4', 'G': '#C8960F', 'g': '#A67A0A', 'H': '#1A1A1A',
  };
  const OWL_MINI: string[] = [
    '____KK__KK____',
    '___KtTKKTtK___',
    '___KtTTTTtK___',
    '__KtTTTTTTtK__',
    '_KTTTTTTTTTtK_',
    'KTTTTTTTTTTTTK',
    'KTFFFFFFFFFFFFFFK',
    'KTFWWWFFWWWFTK',
    'KTFWPPFFPPWFTK',
    'KTFWWWffWWWfTK',
    '_KTfFFGFFFfTK_',
    'KSTTTTGTTTTSK',
    '_KSTCCCCCCTSSK',
    '__KKTTTTTTKK__',
    '___KgKKKgKK___',
  ];

  let owlImageCache: ImageBitmap | null = null;

  function buildOwlBitmap(pixelSize: number): Promise<ImageBitmap> {
    const maxW = Math.max(...OWL_MINI.map(r => r.length));
    const cw = maxW * pixelSize;
    const ch = OWL_MINI.length * pixelSize;
    const off = new OffscreenCanvas(cw, ch);
    const oc = off.getContext('2d')!;
    for (let row = 0; row < OWL_MINI.length; row++) {
      const line = OWL_MINI[row];
      for (let col = 0; col < line.length; col++) {
        const ch2 = line[col];
        if (ch2 === '_') continue;
        const color = OWL_COLORS[ch2];
        if (!color) continue;
        oc.fillStyle = color;
        oc.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
      }
    }
    return off.transferToImageBitmap ? Promise.resolve(off.transferToImageBitmap()) : createImageBitmap(off);
  }

  export let nodes: Node[] = [];
  export let jobs: Job[] = [];
  export let workers: Worker[] = [];
  export let selectedWorker: Worker | null = null;
  void selectedWorker; // received from parent, reserved for future highlighting
  export let viewerLocation: { lat: number; lng: number } | null = null;

  let canvas: HTMLCanvasElement;
  let animFrame: number | null = null;
  let isVisible = true;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let t = 0;

  // Interaction
  let dragging = false;
  let prevX = 0;
  let prevY = 0;
  let vx = 0;
  let vy = 0;

  // Globe state
  let rotY = 0.4;
  let rotX = 0.25;

  const AUTO_SPEED = 0.0012;
  const R_RATIO = 0.38;
  const DOT_DENSITY = 6000;

  // Performance: cache measureText results
  const textWidthCache = new Map<string, number>();
  function cachedMeasureText(ctx: CanvasRenderingContext2D, text: string, font: string): number {
    const key = font + '|' + text;
    let w = textWidthCache.get(key);
    if (w !== undefined) return w;
    ctx.font = font;
    w = ctx.measureText(text).width;
    textWidthCache.set(key, w);
    if (textWidthCache.size > 200) textWidthCache.clear();
    return w;
  }

  // ─── Compute node locations ───

  // ─── Types ───
  type Dot = { x: number; y: number; z: number };
  type PinData = {
    x: number; y: number; z: number;
    name: string; region: string;
    count: number; active: boolean;
    training: boolean; phase: number;
    availableCount: number; trainingCount: number; evaluatingCount: number;
    isMyGpu: boolean;
  };
  type Arc = {
    from: PinData; to: PinData;
    phase: number; speed: number;
    bidirectional: boolean;
  };

  let dots: Dot[] = [];
  let pinList: PinData[] = [];
  let arcs: Arc[] = [];

  // ─── Math ───
  function llTo3D(lat: number, lng: number): [number, number, number] {
    const p = (90 - lat) * Math.PI / 180;
    const th = (lng + 180) * Math.PI / 180;
    return [-Math.sin(p) * Math.cos(th), Math.cos(p), Math.sin(p) * Math.sin(th)];
  }

  function proj(x: number, y: number, z: number, cx: number, cy: number, R: number) {
    const cY = Math.cos(rotY), sY = Math.sin(rotY);
    let rx = x * cY - z * sY, rz = x * sY + z * cY;
    const cX = Math.cos(rotX), sX = Math.sin(rotX);
    const ry = y * cX - rz * sX;
    rz = y * sX + rz * cX;
    const d = 3.5;
    const sc = d / (d + rz);
    return { sx: cx + rx * R * sc, sy: cy - ry * R * sc, sc, z: rz };
  }

  // ─── Init ───
  function buildDots() {
    dots = [];
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < DOT_DENSITY; i++) {
      const th = ga * i;
      const phi = Math.acos(1 - 2 * (i + 0.5) / DOT_DENSITY);
      const lat = 90 - (phi * 180) / Math.PI;
      const lng = ((th * 180) / Math.PI) % 360 - 180;
      if (isLandAt(lat, lng)) {
        const [x, y, z] = llTo3D(lat, lng);
        dots.push({ x, y, z });
      }
    }
  }

  function buildPins() {
    const activeW = workers.filter(w => isWorkerActiveState(w.state));
    const assigned = new Set(jobs.flatMap(j => j.nodeIds));
    const training = new Set(
      jobs.filter(j => j.state === 'training' || j.state === 'evaluating')
        .flatMap(j => j.nodeIds)
    );

    // Find closest city to viewer for "YOUR GPU"
    let closestCityIdx = -1;
    if (viewerLocation) {
      let minDist = Infinity;
      CITIES.forEach((c, i) => {
        const d = Math.sqrt(Math.pow(c.lat - viewerLocation.lat, 2) + Math.pow(c.lng - viewerLocation.lng, 2));
        if (d < minDist) { minDist = d; closestCityIdx = i; }
      });
    }

    pinList = CITIES.map((c, i) => {
      const mine = nodes.filter((_, ni) => ni % CITIES.length === i);
      const act = mine.filter(n =>
        assigned.has(n.id) || activeW.some(w => w.nodeId === n.id)
      ).length;
      const tr = mine.filter(n => training.has(n.id)).length;
      const avl = mine.filter(n => n.state === 'available').length;
      const eval_count = mine.filter(n => n.state === 'cooldown').length;
      const [x, y, z] = llTo3D(c.lat, c.lng);
      return {
        x, y, z, name: c.name, region: c.region,
        count: mine.length, active: act > 0 || mine.length > 0,
        training: tr > 0, phase: Math.random() * Math.PI * 2,
        availableCount: avl,
        trainingCount: tr,
        evaluatingCount: eval_count,
        isMyGpu: i === closestCityIdx,
      };
    });

    // Build data arcs (curated long-distance routes for visual impact)
    arcs = [];
    const ap = pinList.filter(p => p.active);
    if (ap.length >= 2) {
      for (const [fromName, toName] of ARC_PAIRS) {
        const from = ap.find(p => p.name === fromName);
        const to = ap.find(p => p.name === toName);
        if (from && to) {
          arcs.push({
            from, to,
            phase: Math.random() * Math.PI * 2,
            speed: 0.08 + Math.random() * 0.08,
            bidirectional: false,
          });
        }
      }
    }
  }

  // Slerp + lift
  function arcPt(a: PinData, b: PinData, frac: number, lift: number): [number, number, number] {
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    const om = Math.acos(Math.max(-1, Math.min(1, dot)));
    const sO = Math.sin(om);
    if (sO < 0.001) return [a.x, a.y, a.z];
    const sa = Math.sin((1 - frac) * om) / sO;
    const sb = Math.sin(frac * om) / sO;
    const r = 1 + lift * 4 * frac * (1 - frac);
    return [(sa * a.x + sb * b.x) * r, (sa * a.y + sb * b.y) * r, (sa * a.z + sb * b.z) * r];
  }

  // ─── Draw ───
  function draw(ctx: CanvasRenderingContext2D) {
    const R = Math.min(W, H) * R_RATIO;
    const cx = W * 0.5;
    const cy = H * 0.5;

    ctx.clearRect(0, 0, W * dpr, H * dpr);
    ctx.save();
    ctx.scale(dpr, dpr);

    if (!dragging) {
      rotY += AUTO_SPEED;
      rotY += vx; rotX += vy;
      vx *= 0.95; vy *= 0.95;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
    }
    t += 0.016;

    // ── Globe background ──
    const grd = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, 0, cx, cy, R);
    grd.addColorStop(0, 'rgba(240, 237, 232, 0.2)');
    grd.addColorStop(0.7, 'rgba(228, 224, 218, 0.08)');
    grd.addColorStop(1, 'rgba(218, 214, 208, 0.02)');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Globe outline
    ctx.strokeStyle = 'rgba(170, 162, 152, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Land dots (clipped to globe) ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
    ctx.clip();

    // Batch dots by opacity bucket for fewer style changes
    const dotBuckets: [number, number, number][][] = [[], [], [], []];
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const p = proj(d.x, d.y, d.z, cx, cy, R);
      if (p.z > 0.12) continue;
      const depthA = Math.max(0, Math.min(1, 0.2 + 0.8 * (-p.z + 0.12)));
      if (depthA < 0.03) continue;
      const sz = Math.max(0.5, 1.0 * p.sc);
      const bucket = depthA > 0.6 ? 3 : depthA > 0.35 ? 2 : depthA > 0.15 ? 1 : 0;
      dotBuckets[bucket].push([p.sx, p.sy, sz]);
    }
    const bucketAlphas = [0.08, 0.2, 0.38, 0.6];
    for (let b = 0; b < 4; b++) {
      const pts = dotBuckets[b];
      if (!pts.length) continue;
      ctx.fillStyle = `rgba(100, 95, 88, ${bucketAlphas[b]})`;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, y, r] = pts[i];
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();

    // ── Data arcs ──
    for (const arc of arcs) {
      const fp = proj(arc.from.x, arc.from.y, arc.from.z, cx, cy, R);
      const tp = proj(arc.to.x, arc.to.y, arc.to.z, cx, cy, R);
      if (fp.z > 0.3 && tp.z > 0.3) continue;

      const dot = arc.from.x * arc.to.x + arc.from.y * arc.to.y + arc.from.z * arc.to.z;
      const angDist = Math.acos(Math.max(-1, Math.min(1, dot)));
      const lift = Math.min(angDist * 0.12, 0.22);

      // Arc path
      ctx.beginPath();
      let started = false;
      let anyVisible = false;
      for (let f = 0; f <= 1; f += 0.06) {
        const [ax, ay, az] = arcPt(arc.from, arc.to, f, lift);
        const ap = proj(ax, ay, az, cx, cy, R);
        if (ap.z > 0.25) { started = false; continue; }
        if (!started) { ctx.moveTo(ap.sx, ap.sy); started = true; }
        else ctx.lineTo(ap.sx, ap.sy);
        anyVisible = true;
      }
      if (anyVisible) {
        ctx.strokeStyle = 'rgba(200, 180, 165, 0.14)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Single data packet per arc
      if (!anyVisible) continue;
      const f = ((t * arc.speed + arc.phase) % 1);
      const [px, py, pz] = arcPt(arc.from, arc.to, f, lift);
      const pp = proj(px, py, pz, cx, cy, R);
      if (pp.z <= 0.25) {
        // Simple glow circle (no per-frame gradient)
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, 3.5 * pp.sc, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(217, 119, 87, 0.18)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, 1.5 * pp.sc, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 140, 100, 0.85)';
        ctx.fill();
      }
    }

    // ── Pins (sorted front-to-back) ──
    const projPins = pinList
      .map(p => ({ ...p, p: proj(p.x, p.y, p.z, cx, cy, R) }))
      .filter(p => p.p.z < 0.12)
      .sort((a, b) => b.p.z - a.p.z);

    // Determine top 3 front-facing pins for extra effects
    const topPinNames = new Set(
      projPins
        .filter(p => p.active)
        .sort((a, b) => a.p.z - b.p.z)
        .slice(0, 3)
        .map(p => p.name)
    );

    // First pass: draw all pin dots and effects
    for (const pin of projPins) {
      const { sx, sy, sc } = pin.p;
      if (sc < 0.3) continue;
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.5 + pin.phase);
      const isActive = pin.active;
      const isTop = topPinNames.has(pin.name);

      // Ring pulse — MY GPU gets accent ring, others keep blue
      if (isActive && (isTop || pin.isMyGpu)) {
        const ringT = ((t * (pin.isMyGpu ? 0.6 : 0.4) + pin.phase) % 1);
        const ringR = (5 + ringT * (pin.isMyGpu ? 24 : 18)) * sc;
        const ringA = (1 - ringT) * (pin.isMyGpu ? 0.2 : 0.1);
        if (ringA > 0.01) {
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = pin.isMyGpu
            ? `rgba(217, 119, 87, ${ringA})`
            : `rgba(80, 170, 255, ${ringA})`;
          ctx.lineWidth = (pin.isMyGpu ? 1.5 : 1) * sc;
          ctx.stroke();
        }
      }

      // Pin glow — simple circle with alpha (avoid per-pin gradient)
      if (isActive && (isTop || pin.isMyGpu)) {
        const gr = (pin.isMyGpu ? 14 : 10) * sc;
        let glowAlpha: number;
        let glowRGB: string;
        if (pin.isMyGpu) {
          glowRGB = '217, 119, 87'; glowAlpha = 0.12 * pulse;
        } else if (pin.trainingCount > 0) {
          glowRGB = '217, 119, 87'; glowAlpha = 0.08 * pulse;
        } else if (pin.evaluatingCount > 0) {
          glowRGB = '183, 134, 14'; glowAlpha = 0.07 * pulse;
        } else {
          glowRGB = '80, 170, 255'; glowAlpha = 0.08 * pulse;
        }
        ctx.beginPath();
        ctx.arc(sx, sy, gr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glowRGB}, ${glowAlpha})`;
        ctx.fill();
      }

      // Pin dot — STATE-BASED COLORS
      const dr = isActive ? (isTop ? 4.5 : 3) * sc : 1.5 * sc;

      // Draw pixel owl for MY GPU instead of a dot
      if (pin.isMyGpu && owlImageCache) {
        const owlSize = Math.max(20, 28 * sc);
        const aspect = owlImageCache.width / owlImageCache.height;
        const ow = owlSize * aspect;
        const oh = owlSize;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(owlImageCache, sx - ow / 2, sy - oh + 2, ow, oh);
        ctx.restore();
      } else {
      ctx.beginPath();
      ctx.arc(sx, sy, dr, 0, Math.PI * 2);
      }

      if (!(pin.isMyGpu && owlImageCache)) {
        let pinColor: string;
        if (pin.isMyGpu) {
          pinColor = `rgba(217, 119, 87, 0.95)`;
        } else if (pin.trainingCount > 0) {
          pinColor = `rgba(217, 119, 87, ${isTop ? 0.85 : 0.6})`;
        } else if (pin.evaluatingCount > 0) {
          pinColor = `rgba(183, 134, 14, ${isTop ? 0.85 : 0.6})`;
        } else if (pin.availableCount > 0) {
          pinColor = `rgba(39, 134, 74, ${isTop ? 0.85 : 0.55})`;
        } else if (isActive) {
          pinColor = `rgba(60, 160, 255, ${isTop ? 0.9 : 0.55})`;
        } else {
          pinColor = 'rgba(160, 155, 148, 0.2)';
        }
        ctx.fillStyle = pinColor;
        ctx.fill();

        // White center (top pins only)
        if (isActive && isTop) {
          ctx.beginPath();
          ctx.arc(sx, sy, dr * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
        }
      }
    }

    // Second pass: draw labels with collision avoidance (max 5 visible)
    type LabelRect = { x: number; y: number; w: number; h: number };
    const placedLabels: LabelRect[] = [];
    const MAX_LABELS = 5;

    // Sort by front-facing (lowest z = most front)
    const labelCandidates = projPins
      .filter(p => p.active && p.p.sc > 0.65)
      .sort((a, b) => {
        if (a.isMyGpu && !b.isMyGpu) return -1;
        if (!a.isMyGpu && b.isMyGpu) return 1;
        return a.p.z - b.p.z;
      });

    for (const pin of labelCandidates) {
      if (placedLabels.length >= MAX_LABELS) break;
      const { sx, sy, sc } = pin.p;
      const dr = 4.5 * sc;
      const fs = Math.max(9, Math.round(11 * sc));
      const fsSmall = Math.max(8, Math.round(9 * sc));

      const nameFont = `600 ${fs}px 'JetBrains Mono', monospace`;
      const nameStr = pin.isMyGpu ? `★ ${pin.name}` : pin.name;
      const nameW = cachedMeasureText(ctx, nameStr, nameFont);

      const subFont = `400 ${fsSmall}px 'JetBrains Mono', monospace`;
      const activeCount = pin.trainingCount + pin.evaluatingCount + pin.availableCount;
      const countStr = pin.count > 0
        ? `${activeCount} active / ${pin.count} total · ${pin.region}`
        : pin.region;
      const subW = cachedMeasureText(ctx, countStr, subFont);
      const cardW = Math.max(nameW, subW) + 20;
      const cardH = fs + fsSmall + 16;
      const cardX = sx + dr + 10;
      const cardY = sy - cardH * 0.5;

      // Check collision with already placed labels
      const rect: LabelRect = { x: cardX, y: cardY, w: cardW, h: cardH };
      const overlaps = placedLabels.some(r =>
        rect.x < r.x + r.w + 6 && rect.x + rect.w + 6 > r.x &&
        rect.y < r.y + r.h + 6 && rect.y + rect.h + 6 > r.y
      );
      if (overlaps) continue;

      // Check if card goes off-screen
      if (cardX + cardW > W - 10 || cardY < 10 || cardY + cardH > H - 10) continue;

      placedLabels.push(rect);

      // Connector line
      ctx.beginPath();
      ctx.moveTo(sx + dr + 2, sy);
      ctx.lineTo(cardX, sy);
      ctx.strokeStyle = pin.isMyGpu ? 'rgba(217, 119, 87, 0.35)' : 'rgba(80, 170, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Card background — glass for MY GPU, regular for others
      if (pin.isMyGpu) {
        ctx.fillStyle = 'rgba(252, 251, 249, 0.96)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(217, 119, 87, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(252, 251, 249, 0.93)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 6);
        ctx.fill();
        ctx.strokeStyle = pin.training ? 'rgba(217, 119, 87, 0.2)' : 'rgba(200, 194, 186, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // City name
      ctx.font = `600 ${fs}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = 'rgba(40, 38, 35, 0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(nameStr, cardX + 10, cardY + fs + 4);

      // Subtitle
      ctx.font = `400 ${fsSmall}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = pin.training ? 'rgba(217, 119, 87, 0.75)' : 'rgba(100, 155, 210, 0.6)';
      ctx.fillText(countStr, cardX + 10, cardY + fs + fsSmall + 8);
    }

    // ── Atmosphere rim ──
    const atmo = ctx.createRadialGradient(cx, cy, R * 0.93, cx, cy, R * 1.08);
    atmo.addColorStop(0, 'transparent');
    atmo.addColorStop(0.4, 'rgba(180, 200, 220, 0.03)');
    atmo.addColorStop(0.7, 'rgba(100, 170, 255, 0.015)');
    atmo.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.08, 0, Math.PI * 2);
    ctx.fillStyle = atmo;
    ctx.fill();

    ctx.restore();
  }

  // ─── Loop (pauses when off-screen) ───
  function animate() {
    if (isVisible && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx);
    }
    animFrame = requestAnimationFrame(animate);
  }

  function resize() {
    if (!canvas) return;
    const r = canvas.parentElement?.getBoundingClientRect();
    if (!r) return;
    dpr = Math.min(window.devicePixelRatio, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }

  function onDown(e: PointerEvent) {
    dragging = true; prevX = e.clientX; prevY = e.clientY;
    vx = 0; vy = 0;
    canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - prevX, dy = e.clientY - prevY;
    rotY += dx * 0.005;
    rotX += dy * 0.005;
    rotX = Math.max(-1.2, Math.min(1.2, rotX));
    vx = dx * 0.002; vy = dy * 0.002;
    prevX = e.clientX; prevY = e.clientY;
  }
  function onUp() { dragging = false; }

  $: { void nodes; void jobs; void workers; void viewerLocation; buildPins(); }

  onMount(() => {
    resize();
    buildDots();
    buildPins();
    // Pre-build owl bitmap for "my GPU" pin
    buildOwlBitmap(2).then(bmp => { owlImageCache = bmp; });
    animate();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    // Pause animation when scrolled off-screen
    const io = new IntersectionObserver(([e]) => { isVisible = e.isIntersecting; }, { threshold: 0.01 });
    if (canvas.parentElement) io.observe(canvas.parentElement);
    return () => { ro.disconnect(); io.disconnect(); if (animFrame !== null) cancelAnimationFrame(animFrame); };
  });
</script>

<div class="globe-wrap">
  <canvas
    bind:this={canvas}
    on:pointerdown={onDown}
    on:pointermove={onMove}
    on:pointerup={onUp}
    on:pointerleave={onUp}
  ></canvas>
</div>

<style>
  .globe-wrap {
    width: 100%;
    height: 100%;
    position: relative;
    background: var(--page-bg, #FAF9F7);
    cursor: grab;
    touch-action: none;
    overflow: hidden;
  }
  .globe-wrap:active { cursor: grabbing; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
