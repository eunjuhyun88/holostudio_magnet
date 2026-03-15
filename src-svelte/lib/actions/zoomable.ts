/**
 * Svelte action: use:zoomable
 * Adds scroll-to-zoom + drag-to-pan within a fixed tile container.
 * Works with any content (SVG, HTML, etc).
 *
 * Usage: <div use:zoomable>...</div>
 * The first child element gets transformed.
 */
export function zoomable(node: HTMLElement, opts?: { min?: number; max?: number; step?: number }) {
  const MIN = opts?.min ?? 1;
  const MAX = opts?.max ?? 4;
  const STEP = opts?.step ?? 0.12;

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;

  // Style the container
  node.style.overflow = 'hidden';
  node.style.cursor = 'grab';
  node.style.touchAction = 'none';

  function getContent(): HTMLElement | SVGElement | null {
    return (node.querySelector('svg') || node.firstElementChild) as HTMLElement | SVGElement | null;
  }

  function applyTransform() {
    const el = getContent();
    if (!el) return;
    if (scale <= MIN + 0.01) {
      // Reset
      el.style.transform = '';
      el.style.transformOrigin = '';
      panX = 0;
      panY = 0;
      node.style.cursor = 'grab';
    } else {
      el.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
      el.style.transformOrigin = '0 0';
      node.style.cursor = isDragging ? 'grabbing' : 'grab';
    }
    // Show zoom level indicator
    updateIndicator();
  }

  // Zoom level indicator (small badge)
  let indicator: HTMLDivElement | null = null;
  let indicatorTimeout: ReturnType<typeof setTimeout> | null = null;

  function updateIndicator() {
    if (scale <= MIN + 0.01) {
      if (indicator) { indicator.remove(); indicator = null; }
      return;
    }
    if (!indicator) {
      indicator = document.createElement('div');
      Object.assign(indicator.style, {
        position: 'absolute', bottom: '6px', right: '6px', zIndex: '10',
        background: 'rgba(24,24,24,0.75)', color: '#fff',
        fontSize: '9px', fontWeight: '700', fontFamily: "'Inter', sans-serif",
        padding: '2px 6px', borderRadius: '4px', pointerEvents: 'none',
        backdropFilter: 'blur(4px)', transition: 'opacity 200ms',
        letterSpacing: '0.02em',
      });
      // Ensure parent is positioned
      const pos = getComputedStyle(node).position;
      if (pos === 'static') node.style.position = 'relative';
      node.appendChild(indicator);
    }
    indicator.textContent = `${Math.round(scale * 100)}%`;
    indicator.style.opacity = '1';

    // Fade out after a bit
    if (indicatorTimeout) clearTimeout(indicatorTimeout);
    indicatorTimeout = setTimeout(() => {
      if (indicator) indicator.style.opacity = '0.4';
    }, 1200);
  }

  function clampPan() {
    if (scale <= MIN) { panX = 0; panY = 0; return; }
    const rect = node.getBoundingClientRect();
    const el = getContent();
    if (!el) return;
    // Limit panning so content doesn't go too far off
    const maxPanX = (rect.width * (scale - 1)) / (2 * scale);
    const maxPanY = (rect.height * (scale - 1)) / (2 * scale);
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    e.stopPropagation();

    const rect = node.getBoundingClientRect();
    // Cursor position as fraction [0..1]
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;

    const oldScale = scale;
    const delta = e.deltaY > 0 ? -STEP : STEP;
    scale = Math.max(MIN, Math.min(MAX, scale + delta));

    if (scale !== oldScale) {
      // Adjust pan so zoom targets the cursor position
      const ds = scale - oldScale;
      panX -= (fx - 0.5) * rect.width * ds / (scale * scale);
      panY -= (fy - 0.5) * rect.height * ds / (scale * scale);
    }

    if (scale <= MIN) { scale = MIN; panX = 0; panY = 0; }
    clampPan();
    applyTransform();
  }

  function handleMouseDown(e: MouseEvent) {
    if (scale <= MIN) return; // no pan when not zoomed
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
    node.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartX) / scale;
    const dy = (e.clientY - dragStartY) / scale;
    panX = dragStartPanX + dx;
    panY = dragStartPanY + dy;
    clampPan();
    applyTransform();
  }

  function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    node.style.cursor = scale > MIN ? 'grab' : 'grab';
  }

  // Double-click to reset
  function handleDblClick(e: MouseEvent) {
    e.preventDefault();
    scale = MIN;
    panX = 0;
    panY = 0;
    applyTransform();
  }

  node.addEventListener('wheel', handleWheel, { passive: false });
  node.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  node.addEventListener('dblclick', handleDblClick);

  return {
    update(newOpts?: { min?: number; max?: number; step?: number }) {
      // opts can be updated if needed
    },
    destroy() {
      node.removeEventListener('wheel', handleWheel);
      node.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      node.removeEventListener('dblclick', handleDblClick);
      if (indicator) indicator.remove();
      if (indicatorTimeout) clearTimeout(indicatorTimeout);
    },
  };
}
