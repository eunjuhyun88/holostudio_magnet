<script lang="ts">
  import { router } from '../stores/router.ts';

  type MetricMode = 'impact' | 'volume';
  type Timeframe = '1w' | '2w' | '1m' | '6m' | 'all';
  type Tone = 'architecture' | 'optimization' | 'data' | 'evaluation';

  interface LabNode {
    id: string;
    label: string;
    summary: string;
    tone: Tone;
    impact?: number;
    volume?: number;
    delta?: number;
    bias?: Partial<Record<Timeframe, number>>;
    children?: LabNode[];
  }

  interface TreemapCell {
    node: LabNode;
    value: number;
    x: number;
    y: number;
    w: number;
    h: number;
    shareOfTotal: number;
    shareOfParent: number;
  }

  const TIMEFRAMES: Timeframe[] = ['1w', '2w', '1m', '6m', 'all'];

  const TONE_META: Record<Tone, { fill: string; stroke: string; accent: string }> = {
    architecture: { fill: '#dbe3f6', stroke: '#2d3553', accent: '#2d4af0' },
    optimization: { fill: '#dff1d9', stroke: '#244d30', accent: '#38d100' },
    data: { fill: '#e5efe1', stroke: '#46503e', accent: '#5b8cfd' },
    evaluation: { fill: '#f0e1f7', stroke: '#4b395c', accent: '#b264e3' },
  };

  const BIAS = {
    surge: { '1w': 1.24, '2w': 1.12, '1m': 1, '6m': 0.84, all: 0.74 },
    steady: { '1w': 1.04, '2w': 1.02, '1m': 1, '6m': 0.94, all: 0.88 },
    ramp: { '1w': 0.92, '2w': 0.98, '1m': 1, '6m': 1.08, all: 1.14 },
    fading: { '1w': 0.86, '2w': 0.91, '1m': 1, '6m': 1.12, all: 1.2 },
  } as const;

  function leaf(
    id: string,
    label: string,
    tone: Tone,
    impact: number,
    volume: number,
    summary: string,
    delta: number,
    bias: keyof typeof BIAS,
  ): LabNode {
    return { id, label, tone, impact, volume, summary, delta, bias: BIAS[bias] };
  }

  function group(id: string, label: string, tone: Tone, summary: string, children: LabNode[]): LabNode {
    return { id, label, tone, summary, children };
  }

  const root: LabNode = {
    id: 'root',
    label: 'Autoresearch Signal Distribution',
    tone: 'architecture',
    summary: 'Inline semantic zoom prototype for research clusters, inspired by the reference interaction.',
    children: [
      group('architecture', 'Architecture', 'architecture', 'High-leverage model structure experiments.', [
        group('routing', 'Sparse Routing', 'architecture', 'Expert allocation and token routing changes.', [
          leaf('routing-gate', 'Gate Annealing', 'architecture', 78, 24, 'Stabilizes expert selection during early iterations.', 8.4, 'surge'),
          leaf('routing-balance', 'Load Rebalance', 'architecture', 62, 18, 'Reduces collapse into a few dominant experts.', 5.9, 'steady'),
          leaf('routing-guard', 'Drop Guardrail', 'architecture', 29, 12, 'Cuts unstable spillover tokens on long prompts.', -1.8, 'fading'),
        ]),
        group('memory', 'Memory Compression', 'architecture', 'Context packing and KV compaction.', [
          leaf('memory-kv', 'KV Window Trim', 'architecture', 71, 16, 'Preserves recent tokens while reducing memory churn.', 6.1, 'surge'),
          leaf('memory-stitch', 'Context Stitching', 'architecture', 48, 11, 'Merges retrieval snippets without losing local order.', 2.7, 'steady'),
          leaf('memory-merge', 'Cache Merge', 'architecture', 31, 8, 'Combines reused retrieval shards into a single pass.', 1.6, 'ramp'),
        ]),
        group('long-context', 'Long Context', 'architecture', 'Attention span and sequence scaling.', [
          leaf('context-rope', 'RoPE Rescale', 'architecture', 58, 15, 'Keeps long runs numerically stable.', 4.8, 'steady'),
          leaf('context-segment', 'Segment Attention', 'architecture', 37, 9, 'Makes late-document references more available.', 1.9, 'ramp'),
          leaf('context-pocket', 'Recall Pockets', 'architecture', 24, 6, 'Carves space for recurring memory anchors.', -0.6, 'fading'),
        ]),
      ]),
      group('optimization', 'Optimization', 'optimization', 'Training-control experiments and search heuristics.', [
        group('lr-programs', 'LR Programs', 'optimization', 'Schedules that shift search speed and stability.', [
          leaf('lr-staircase', 'Staircase Decay', 'optimization', 64, 21, 'Keeps later-stage tuning less chaotic.', 5.5, 'steady'),
          leaf('lr-burst', 'Burst Warmup', 'optimization', 54, 26, 'Pushes exploration early before narrowing.', 6.8, 'surge'),
          leaf('lr-floor', 'Adaptive Floor', 'optimization', 33, 10, 'Stops LR from collapsing too low.', 1.2, 'ramp'),
        ]),
        group('optimizer-stack', 'Optimizer Stack', 'optimization', 'Changes to update rules and decay handling.', [
          leaf('opt-lion', 'Lion Blend', 'optimization', 44, 17, 'Improves fast branch exploitation.', 2.1, 'steady'),
          leaf('opt-sophia', 'Sophia Probe', 'optimization', 39, 12, 'Finds sharper minima on short horizon tests.', 3.4, 'ramp'),
          leaf('opt-decay', 'Decay Guard', 'optimization', 27, 9, 'Stops optimizer from over-regularizing late runs.', -0.4, 'fading'),
        ]),
        group('batch-scaling', 'Batch Scaling', 'optimization', 'Batch and accumulation tradeoffs.', [
          leaf('batch-ladder', 'Batch Ladder', 'optimization', 52, 19, 'Escalates batch size only after stable gains.', 4.1, 'surge'),
          leaf('batch-accum', 'Accumulation Sweep', 'optimization', 34, 13, 'Finds cheap throughput without memory spikes.', 1.3, 'steady'),
          leaf('batch-latency', 'Latency Clamp', 'optimization', 18, 7, 'Avoids oversized batches on slower nodes.', -1.1, 'fading'),
        ]),
      ]),
      group('data', 'Data', 'data', 'Corpus composition and synthetic recovery work.', [
        group('corpus-mix', 'Corpus Mix', 'data', 'Reweighting source pools for signal quality.', [
          leaf('mix-onchain', 'On-chain Reweight', 'data', 82, 28, 'Raises utility of wallet state transitions.', 7.9, 'surge'),
          leaf('mix-forums', 'Forum Rebalance', 'data', 41, 14, 'Balances speculative chatter against grounded sources.', 2.2, 'steady'),
          leaf('mix-rss', 'Newswire Clamp', 'data', 25, 8, 'Prevents high-frequency feeds from drowning other inputs.', -0.9, 'fading'),
        ]),
        group('synthetic', 'Synthetic Repair', 'data', 'Generated corrections and gap filling.', [
          leaf('synth-counter', 'Counterfactual Repair', 'data', 57, 15, 'Creates failure-focused variants of weak examples.', 4.7, 'ramp'),
          leaf('synth-dialogue', 'Dialogue Patch', 'data', 38, 11, 'Fills multi-turn reasoning gaps.', 2.8, 'steady'),
          leaf('synth-anchor', 'Anchor Distill', 'data', 22, 6, 'Produces compact reminders for rare cases.', 0.6, 'steady'),
        ]),
        group('filtering', 'Filtering', 'data', 'Quality and duplication controls.', [
          leaf('filter-hash', 'Near-Dupe Hash', 'data', 46, 18, 'Cuts repeated documents with low informational gain.', 3.2, 'steady'),
          leaf('filter-entropy', 'Entropy Fence', 'data', 31, 9, 'Removes low-signal synthetic fragments.', 1.7, 'ramp'),
          leaf('filter-thrash', 'Thrash Guard', 'data', 16, 5, 'Stops over-pruning during sparse periods.', -1.4, 'fading'),
        ]),
      ]),
      group('evaluation', 'Evaluation', 'evaluation', 'Regression trust and verification loops.', [
        group('benchmarks', 'Benchmark Packs', 'evaluation', 'Core benchmark and holdout bundles.', [
          leaf('bench-regression', 'Regression Pack', 'evaluation', 68, 20, 'Keeps winning branches from breaking prior gains.', 6.2, 'surge'),
          leaf('bench-safety', 'Safety Slice', 'evaluation', 43, 11, 'Tracks harmful completions before branch promotion.', 3.8, 'steady'),
          leaf('bench-latency', 'Latency Slice', 'evaluation', 21, 7, 'Makes speed regressions visible during search.', 0.4, 'ramp'),
        ]),
        group('probes', 'Interpretability Probes', 'evaluation', 'Lightweight probes for why a branch improved.', [
          leaf('probe-token', 'Token Probe', 'evaluation', 49, 13, 'Surfaces token bands that shifted attention.', 2.6, 'steady'),
          leaf('probe-node', 'Node Probe', 'evaluation', 26, 8, 'Explains mesh-specific branch outliers.', 1.1, 'ramp'),
          leaf('probe-loss', 'Loss Lens', 'evaluation', 18, 5, 'Maps wins to recovery from known failure sets.', 0.3, 'steady'),
        ]),
        group('promotion', 'Promotion Rules', 'evaluation', 'Branch keep/discard logic.', [
          leaf('promo-risk', 'Risk Budget', 'evaluation', 53, 14, 'Keeps high-gain branches from shipping with silent regressions.', 4.3, 'surge'),
          leaf('promo-lock', 'Canary Lock', 'evaluation', 35, 10, 'Holds weak confirmations in quarantine.', 2.4, 'steady'),
          leaf('promo-relax', 'Relax Window', 'evaluation', 19, 6, 'Lets promising but noisy branches stay alive longer.', -0.3, 'fading'),
        ]),
      ]),
    ],
  };

  const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  const percentFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

  let metricMode: MetricMode = 'impact';
  let timeframe: Timeframe = '1m';
  let focusPath: string[] = [];
  let hoveredNodeId: string | null = null;
  let selectedNodeId: string | null = null;
  let surfaceWidth = 920;
  let surfaceHeight = 560;

  // UX-Z4/Z5: Zoom animation direction on drill-down / zoom-out
  let zoomDirection: 'in' | 'out' | null = null;
  let _zoomTimer: ReturnType<typeof setTimeout> | null = null;

  function triggerZoom(dir: 'in' | 'out') {
    zoomDirection = dir;
    if (_zoomTimer) clearTimeout(_zoomTimer);
    _zoomTimer = setTimeout(() => { zoomDirection = null; }, 320);
  }

  // UX-Z6: Timeframe morph animation
  let morphing = false;
  let _morphTimer: ReturnType<typeof setTimeout> | null = null;
  let _prevTimeframe = timeframe;

  // UX-Z7: Mouse position for smooth tooltip follow
  let mouseX = 0;
  let mouseY = 0;

  function handleSurfaceMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  // UX-Z1: Squarify memoization cache
  let _sqKey = '';
  let _sqResult: TreemapCell[] = [];

  const PAD = 10;

  // Memoized valueFor — cache keyed by node.id + mode + frame
  let _valueCache = new Map<string, number>();
  let _valueCacheKey = '';

  function invalidateValueCache(mode: MetricMode, frame: Timeframe) {
    const key = `${mode}:${frame}`;
    if (key !== _valueCacheKey) {
      _valueCache.clear();
      _valueCacheKey = key;
    }
  }

  function valueFor(node: LabNode, mode: MetricMode = metricMode, frame: Timeframe = timeframe): number {
    const cacheKey = node.id;
    const cached = _valueCache.get(cacheKey);
    if (cached !== undefined) return cached;

    let result: number;
    if (node.children?.length) {
      result = node.children.reduce((sum, child) => sum + valueFor(child, mode, frame), 0);
    } else {
      const base = mode === 'impact' ? node.impact ?? 0 : node.volume ?? 0;
      result = base * (node.bias?.[frame] ?? 1);
    }
    _valueCache.set(cacheKey, result);
    return result;
  }

  function getNodeById(node: LabNode, id: string): LabNode | null {
    if (node.id === id) return node;
    for (const child of node.children ?? []) {
      const found = getNodeById(child, id);
      if (found) return found;
    }
    return null;
  }

  function getNodeByPath(path: string[]): LabNode {
    let current = root;
    for (const id of path) {
      const next = current.children?.find(child => child.id === id);
      if (!next) break;
      current = next;
    }
    return current;
  }

  function topDescendant(node: LabNode): LabNode {
    if (!node.children?.length) return node;
    return [...node.children]
      .sort((a, b) => valueFor(b) - valueFor(a))
      .map(topDescendant)[0];
  }

  function valueLabel(value: number): string {
    if (metricMode === 'impact') return `${numberFmt.format(value)} score`;
    return `${numberFmt.format(value)} runs`;
  }

  function deltaLabel(node: LabNode | null): string {
    if (!node || node.delta == null) return 'n/a';
    const sign = node.delta >= 0 ? '+' : '';
    return `${sign}${node.delta.toFixed(1)}%`;
  }

  function squarify(
    items: { id: string; value: number }[],
    x: number,
    y: number,
    w: number,
    h: number,
  ): { id: string; x: number; y: number; w: number; h: number }[] {
    if (items.length === 0) return [];
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return items.map(item => ({ id: item.id, x, y, w: 0, h: 0 }));

    const sorted = [...items].sort((a, b) => b.value - a.value);
    const result: { id: string; x: number; y: number; w: number; h: number }[] = [];

    function worstAspect(strip: { value: number }[], stripTotal: number, stripSize: number, crossSize: number) {
      let worst = 0;
      for (const item of strip) {
        const frac = item.value / stripTotal;
        const size = crossSize * frac;
        if (size === 0 || stripSize === 0) continue;
        const aspect = Math.max(stripSize / size, size / stripSize);
        worst = Math.max(worst, aspect);
      }
      return worst;
    }

    function layout(itemsLeft: { id: string; value: number }[], totalLeft: number, startX: number, startY: number, width: number, height: number) {
      if (itemsLeft.length === 0) return;
      if (itemsLeft.length === 1) {
        result.push({ id: itemsLeft[0].id, x: startX, y: startY, w: width, h: height });
        return;
      }

      const horizontal = width >= height;
      let stripSum = 0;
      let best = Infinity;
      let splitIndex = 1;

      for (let i = 0; i < itemsLeft.length; i++) {
        stripSum += itemsLeft[i].value;
        const stripFrac = stripSum / totalLeft;
        const stripSize = horizontal ? width * stripFrac : height * stripFrac;
        const strip = itemsLeft.slice(0, i + 1);
        const aspect = worstAspect(strip, stripSum, stripSize, horizontal ? height : width);
        if (aspect <= best) {
          best = aspect;
          splitIndex = i + 1;
        } else {
          break;
        }
      }

      const strip = itemsLeft.slice(0, splitIndex);
      const rest = itemsLeft.slice(splitIndex);
      const stripTotal = strip.reduce((sum, item) => sum + item.value, 0);
      const stripFrac = stripTotal / totalLeft;

      if (horizontal) {
        const stripWidth = width * stripFrac;
        let cursorY = startY;
        for (const item of strip) {
          const itemHeight = height * (item.value / stripTotal);
          result.push({ id: item.id, x: startX, y: cursorY, w: stripWidth, h: itemHeight });
          cursorY += itemHeight;
        }
        layout(rest, totalLeft - stripTotal, startX + stripWidth, startY, width - stripWidth, height);
      } else {
        const stripHeight = height * stripFrac;
        let cursorX = startX;
        for (const item of strip) {
          const itemWidth = width * (item.value / stripTotal);
          result.push({ id: item.id, x: cursorX, y: startY, w: itemWidth, h: stripHeight });
          cursorX += itemWidth;
        }
        layout(rest, totalLeft - stripTotal, startX, startY + stripHeight, width, height - stripHeight);
      }
    }

    layout(sorted, total, x, y, w, h);
    return result;
  }

  // Invalidate value cache whenever inputs change
  $: invalidateValueCache(metricMode, timeframe);

  $: currentNode = getNodeByPath(focusPath);
  $: breadcrumbNodes = [root, ...focusPath.map((_, index) => getNodeByPath(focusPath.slice(0, index + 1)))];
  $: currentChildren = currentNode.children ?? [];
  $: currentParent = focusPath.length > 0 ? getNodeByPath(focusPath.slice(0, -1)) : root;
  $: rootTotal = valueFor(root);
  $: currentTotal = currentChildren.reduce((sum, child) => sum + valueFor(child), 0);
  $: activeNode = getNodeById(root, selectedNodeId ?? hoveredNodeId ?? currentNode.id) ?? currentNode;
  $: activeParent = activeNode.id === root.id ? null : (focusPath.includes(activeNode.id) ? currentParent : breadcrumbNodes.find(node => node.children?.some(child => child.id === activeNode.id)) ?? currentNode);
  $: topChildren = [...currentChildren]
    .sort((a, b) => valueFor(b) - valueFor(a))
    .slice(0, 5);
  $: timeSeries = TIMEFRAMES.map(tf => {
    return { id: tf, value: valueFor(root, metricMode, tf) };
  });

  // Pre-build children lookup Map for O(1) find in cells
  $: childrenMap = new Map(currentChildren.map(node => [node.id, node]));

  // UX-Z6: Detect timeframe changes → trigger morph animation
  $: if (timeframe !== _prevTimeframe) {
    _prevTimeframe = timeframe;
    morphing = true;
    if (_morphTimer) clearTimeout(_morphTimer);
    _morphTimer = setTimeout(() => { morphing = false; }, 300);
  }

  // UX-Z1: Memoized cells — skip squarify if inputs unchanged
  $: cells = (() => {
    if (surfaceWidth <= 0 || surfaceHeight <= 0 || currentChildren.length === 0) return [] as TreemapCell[];
    const items = currentChildren.map(node => ({ id: node.id, value: Math.max(valueFor(node), 1) }));
    const sqKey = items.map(i => `${i.id}:${i.value.toFixed(1)}`).join(',') + `|${surfaceWidth}|${surfaceHeight}`;

    if (sqKey === _sqKey && _sqResult.length > 0) return _sqResult;
    _sqKey = sqKey;

    const layout = squarify(items, PAD, PAD, Math.max(surfaceWidth - PAD * 2, 0), Math.max(surfaceHeight - PAD * 2, 0));

    const result = layout.map(cell => {
      const node = childrenMap.get(cell.id)!;
      const value = valueFor(node);
      return {
        node,
        value,
        x: cell.x,
        y: cell.y,
        w: cell.w,
        h: cell.h,
        shareOfTotal: rootTotal > 0 ? value / rootTotal : 0,
        shareOfParent: currentTotal > 0 ? value / currentTotal : 0,
      };
    });
    _sqResult = result;
    return result;
  })();

  // O(1) hovered cell lookup via Map
  $: cellMap = new Map(cells.map(cell => [cell.node.id, cell]));
  $: hoveredCell = (hoveredNodeId && cellMap.get(hoveredNodeId)) ?? null;
  // UX-Z7: Tooltip follows mouse with smooth CSS transition (transform-based for GPU accel)
  $: tooltipStyle = (() => {
    if (!hoveredCell) return 'display:none;';
    const left = Math.min(Math.max(mouseX + 16, 18), Math.max(surfaceWidth - 248, 18));
    const top = Math.min(Math.max(mouseY - 40, 18), Math.max(surfaceHeight - 138, 18));
    return `transform: translate3d(${left}px, ${top}px, 0);`;
  })();

  function handleCellClick(cell: TreemapCell) {
    selectedNodeId = cell.node.id;
    if (cell.node.children?.length) {
      triggerZoom('in'); // UX-Z4
      focusPath = [...focusPath, cell.node.id];
      hoveredNodeId = null;
    }
  }

  function handleCellKeydown(event: KeyboardEvent, cell: TreemapCell) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleCellClick(cell);
  }

  function resetToRoot() {
    triggerZoom('out'); // UX-Z5
    focusPath = [];
    selectedNodeId = null;
    hoveredNodeId = null;
  }

  function goToDepth(index: number) {
    if (index < focusPath.length) triggerZoom('out'); // UX-Z5
    focusPath = focusPath.slice(0, index);
    hoveredNodeId = null;
    selectedNodeId = focusPath[index - 1] ?? null;
  }

  function labelFontSize(cell: TreemapCell): number {
    const area = cell.w * cell.h;
    if (area < 4500) return 0;
    if (area < 9500) return 12;
    if (area < 18000) return 14;
    return 16;
  }

  function miniFontSize(cell: TreemapCell): number {
    return Math.max(10, labelFontSize(cell) - 3);
  }

  function isLeaf(node: LabNode): boolean {
    return !node.children?.length;
  }

  function showSubLabel(cell: TreemapCell): boolean {
    return cell.w > 140 && cell.h > 82;
  }
</script>

<div class="zoom-lab">
  <section class="lab-hero">
    <div class="lab-copy">
      <button class="lab-back" type="button" on:click={() => router.navigate('research')}>Back to Research</button>
      <div class="lab-eyebrow">Reference-aligned prototype</div>
      <h1>Research Semantic Zoom Lab</h1>
      <p>
        Test the interaction model from the reference video as a single analysis surface:
        inline drill-down, preserved breadcrumb context, hover stats, and stable timeframe state.
      </p>
    </div>
    <div class="lab-hero-card">
      <span class="hero-card-label">Primary thesis</span>
      <strong>Context beats magnification.</strong>
      <span>Fullscreen is secondary. The real interaction is inline hierarchical exploration.</span>
    </div>
  </section>

  <section class="lab-shell">
    <div class="lab-canvas-card">
      <div class="lab-toolbar">
        <div class="lab-toggle-group">
          <span class="toolbar-label">Metric</span>
          <button class:active={metricMode === 'impact'} on:click={() => metricMode = 'impact'} type="button">Impact</button>
          <button class:active={metricMode === 'volume'} on:click={() => metricMode = 'volume'} type="button">Experiment Volume</button>
        </div>

        <div class="lab-toolbar-meta">
          <span class="meta-chip">Inline drill-down</span>
          <span class="meta-chip">Hover ratios</span>
          <span class="meta-chip">State-preserving timeframe</span>
        </div>
      </div>

      <div class="lab-summary-row">
        <div class="summary-block">
          <span class="summary-label">Current focus</span>
          <strong>{currentNode.label}</strong>
          <span>{valueLabel(currentNode.id === root.id ? rootTotal : currentTotal)}</span>
        </div>
        <div class="summary-block">
          <span class="summary-label">Top descendant</span>
          <strong>{topDescendant(currentNode).label}</strong>
          <span>{valueLabel(valueFor(topDescendant(currentNode)))}</span>
        </div>
        <div class="summary-block">
          <span class="summary-label">Inspect target</span>
          <strong>{activeNode.label}</strong>
          <span>{deltaLabel(activeNode)} delta</span>
        </div>
      </div>

      <div class="lab-breadcrumb">
        {#each breadcrumbNodes as crumb, index}
          {#if index > 0}<span class="crumb-sep">›</span>{/if}
          <button
            type="button"
            class="crumb-btn"
            class:active={index === breadcrumbNodes.length - 1}
            on:click={() => goToDepth(index)}
          >
            {crumb.label}
          </button>
        {/each}

        {#if focusPath.length > 0}
          <button type="button" class="crumb-reset" on:click={resetToRoot}>Reset</button>
        {/if}
      </div>

      <div class="lab-surface-wrap">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="lab-surface"
          class:zoom-in={zoomDirection === 'in'}
          class:zoom-out={zoomDirection === 'out'}
          bind:clientWidth={surfaceWidth}
          bind:clientHeight={surfaceHeight}
          on:mousemove={handleSurfaceMouseMove}
        >
          <svg
            class="lab-svg"
            class:morphing={morphing}
            role="img"
            aria-label="Semantic zoom research treemap"
            viewBox={`0 0 ${surfaceWidth} ${surfaceHeight}`}
            on:mouseleave={() => hoveredNodeId = null}
          >
            {#each cells as cell (cell.node.id)}
              {@const tone = TONE_META[cell.node.tone]}
              {@const fs = labelFontSize(cell)}
              {@const selected = selectedNodeId === cell.node.id}
              {@const hovered = hoveredNodeId === cell.node.id}
              <g
                class="lab-cell"
                role="button"
                tabindex="0"
                aria-label={`${cell.node.label}: ${valueLabel(cell.value)}`}
                on:click={() => handleCellClick(cell)}
                on:keydown={(event) => handleCellKeydown(event, cell)}
                on:mouseenter={() => hoveredNodeId = cell.node.id}
              >
                <rect
                  x={cell.x + 1.5}
                  y={cell.y + 1.5}
                  width={Math.max(cell.w - 3, 0)}
                  height={Math.max(cell.h - 3, 0)}
                  rx="6"
                  style="fill: {hovered || selected ? tone.accent : tone.fill}; stroke: {tone.stroke}; stroke-width: {hovered || selected ? 2.4 : 1.2};"
                />

                {#if fs > 0}
                  <text x={cell.x + 12} y={cell.y + 20} class="cell-title" font-size={fs}>
                    {cell.node.label}
                  </text>
                  <text x={cell.x + 12} y={cell.y + 40} class="cell-value" font-size={miniFontSize(cell)}>
                    {valueLabel(cell.value)}
                  </text>
                  {#if showSubLabel(cell)}
                    <text x={cell.x + 12} y={cell.y + 58} class="cell-meta" font-size={Math.max(miniFontSize(cell) - 1, 10)}>
                      {percentFmt.format(cell.shareOfParent * 100)}% of current
                    </text>
                    <text x={cell.x + 12} y={cell.y + 76} class="cell-meta" font-size={Math.max(miniFontSize(cell) - 1, 10)}>
                      {isLeaf(cell.node) ? 'Leaf node' : `${cell.node.children?.length ?? 0} child groups`}
                    </text>
                  {/if}
                {/if}
              </g>
            {/each}
          </svg>

          {#if hoveredCell}
            <div class="lab-tooltip" style={tooltipStyle}>
              <span class="tooltip-title">{hoveredCell.node.label}</span>
              <strong>{valueLabel(hoveredCell.value)}</strong>
              <div class="tooltip-row">
                <span>{percentFmt.format(hoveredCell.shareOfTotal * 100)}%</span>
                <span>of total</span>
              </div>
              <div class="tooltip-row">
                <span>{percentFmt.format(hoveredCell.shareOfParent * 100)}%</span>
                <span>of current focus</span>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="lab-timeframe-card">
        <div class="timeframe-head">
          <span class="toolbar-label">Timeframe</span>
          <span class="timeframe-value">{timeframe.toUpperCase()}</span>
        </div>
        <div class="timeframe-buttons">
          {#each TIMEFRAMES as tf}
            <button class:active={timeframe === tf} type="button" on:click={() => timeframe = tf}>
              {tf.toUpperCase()}
            </button>
          {/each}
        </div>

        <div class="timeframe-strip">
          {#each timeSeries as item}
            <button
              type="button"
              class="strip-segment"
              class:active={timeframe === item.id}
              style={`--segment:${(item.value / Math.max(...timeSeries.map(entry => entry.value))) * 100}%`}
              on:click={() => timeframe = item.id}
            >
              <span>{item.id.toUpperCase()}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <aside class="lab-rail">
      <div class="rail-card">
        <span class="rail-label">Inspect node</span>
        <h2>{activeNode.label}</h2>
        <p>{activeNode.summary}</p>
        <div class="rail-stat-grid">
          <div>
            <span>Current value</span>
            <strong>{valueLabel(valueFor(activeNode))}</strong>
          </div>
          <div>
            <span>Delta</span>
            <strong>{deltaLabel(activeNode)}</strong>
          </div>
          <div>
            <span>Share of total</span>
            <strong>{percentFmt.format((valueFor(activeNode) / rootTotal) * 100)}%</strong>
          </div>
          <div>
            <span>Share of parent</span>
            <strong>
              {#if activeParent}
                {percentFmt.format((valueFor(activeNode) / Math.max(valueFor(activeParent), 1)) * 100)}%
              {:else}
                100%
              {/if}
            </strong>
          </div>
        </div>
      </div>

      <div class="rail-card">
        <span class="rail-label">Current focus ranking</span>
        <div class="rail-list">
          {#each topChildren as child, index}
            <button
              type="button"
              class="rail-row"
              on:click={() => {
                selectedNodeId = child.id;
                if (child.children?.length) focusPath = [...focusPath, child.id];
              }}
            >
              <span class="rail-rank">#{index + 1}</span>
              <span class="rail-name">{child.label}</span>
              <span class="rail-value">{valueLabel(valueFor(child))}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="rail-card">
        <span class="rail-label">What this page is testing</span>
        <ul class="principles">
          <li>Breadcrumb-driven return path</li>
          <li>Hover card with global and parent ratios</li>
          <li>Inline hierarchy change without route/modal jumps</li>
          <li>Timeframe state preserved during drill-down</li>
        </ul>
      </div>
    </aside>
  </section>
</div>

<style>
  .zoom-lab {
    min-height: calc(100vh - 44px);
    padding: 28px;
    background:
      radial-gradient(circle at top left, rgba(217, 119, 87, 0.09), transparent 28%),
      linear-gradient(180deg, #f6f1e9 0%, #f4efe7 100%);
    color: #1f1913;
  }

  .lab-hero {
    max-width: 1360px;
    margin: 0 auto 20px;
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(280px, 360px);
    gap: 18px;
    align-items: stretch;
  }

  .lab-copy {
    padding: 20px 22px;
    border: 1px solid rgba(68, 54, 42, 0.1);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 18px 40px rgba(54, 39, 27, 0.07);
  }

  .lab-back {
    margin-bottom: 14px;
    padding: 7px 12px;
    border: 1px solid rgba(68, 54, 42, 0.12);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.88);
    color: #5b4e44;
    font: 600 12px/1 'Inter', sans-serif;
    cursor: pointer;
  }

  .lab-eyebrow {
    color: #8a5a37;
    font: 700 11px/1 'JetBrains Mono', monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .lab-copy h1 {
    margin: 10px 0 8px;
    font: 700 clamp(2rem, 4vw, 3.5rem)/0.96 'Inter', sans-serif;
    letter-spacing: -0.05em;
  }

  .lab-copy p {
    max-width: 760px;
    margin: 0;
    color: #65584b;
    font: 500 15px/1.6 'Inter', sans-serif;
  }

  .lab-hero-card,
  .lab-canvas-card,
  .rail-card {
    border: 1px solid rgba(68, 54, 42, 0.1);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 18px 40px rgba(54, 39, 27, 0.07);
  }

  .lab-hero-card {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.88), rgba(234, 245, 224, 0.72));
  }

  .hero-card-label,
  .rail-label,
  .toolbar-label,
  .summary-label {
    color: #8c7c6d;
    font: 700 11px/1 'JetBrains Mono', monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .lab-hero-card strong {
    font: 700 24px/1.05 'Inter', sans-serif;
    letter-spacing: -0.03em;
  }

  .lab-hero-card span:last-child {
    color: #65584b;
    font: 500 14px/1.5 'Inter', sans-serif;
  }

  .lab-shell {
    max-width: 1360px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(300px, 380px);
    gap: 18px;
    align-items: start;
  }

  .lab-canvas-card {
    padding: 18px;
  }

  .lab-toolbar,
  .lab-summary-row,
  .timeframe-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .lab-toolbar {
    margin-bottom: 14px;
  }

  .lab-toggle-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .lab-toggle-group button,
  .timeframe-buttons button,
  .strip-segment,
  .crumb-btn,
  .crumb-reset,
  .rail-row {
    appearance: none;
    border: 1px solid rgba(68, 54, 42, 0.14);
    background: rgba(255, 255, 255, 0.9);
    color: #53473d;
    cursor: pointer;
    transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease;
  }

  .lab-toggle-group button,
  .timeframe-buttons button {
    padding: 8px 12px;
    border-radius: 999px;
    font: 600 12px/1 'Inter', sans-serif;
  }

  .lab-toggle-group button.active,
  .timeframe-buttons button.active {
    border-color: #121212;
    background: #121212;
    color: #fff;
  }

  .lab-toolbar-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .meta-chip {
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(36, 26, 18, 0.05);
    color: #6b5f55;
    font: 600 11px/1 'Inter', sans-serif;
  }

  .lab-summary-row {
    margin-bottom: 12px;
    padding: 12px 14px;
    border-radius: 18px;
    background: rgba(245, 239, 231, 0.8);
  }

  .summary-block {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .summary-block strong {
    font: 700 16px/1.1 'Inter', sans-serif;
    letter-spacing: -0.02em;
  }

  .summary-block span:last-child {
    color: #7a6c5f;
    font: 500 12px/1.3 'Inter', sans-serif;
  }

  .lab-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .crumb-btn,
  .crumb-reset {
    padding: 6px 10px;
    border-radius: 999px;
    font: 600 12px/1 'Inter', sans-serif;
  }

  .crumb-btn.active {
    background: #eef3ff;
    border-color: #b8c5f0;
    color: #24366e;
  }

  .crumb-reset {
    margin-left: auto;
  }

  .crumb-sep {
    color: #8c7c6d;
    font: 700 12px/1 'JetBrains Mono', monospace;
  }

  .lab-surface-wrap {
    position: relative;
    min-height: 560px;
    border: 1px solid rgba(68, 54, 42, 0.12);
    border-radius: 22px;
    overflow: hidden;
    background: #f8f5ef;
  }

  .lab-surface {
    position: relative;
    min-height: 560px;
  }

  /* UX-Z4: Drill-down zoom-in animation */
  .lab-surface.zoom-in {
    animation: zoomIn 300ms ease-out;
  }

  /* UX-Z5: Breadcrumb zoom-out animation */
  .lab-surface.zoom-out {
    animation: zoomOut 300ms ease-out;
  }

  @keyframes zoomIn {
    0% { transform: scale(0.94); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes zoomOut {
    0% { transform: scale(1.04); opacity: 0.6; }
    100% { transform: scale(1); opacity: 1; }
  }

  .lab-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* UX-Z6: Morph animation when timeframe changes */
  .lab-svg.morphing rect {
    animation: cellMorph 280ms ease-out;
  }

  @keyframes cellMorph {
    0% { opacity: 0.45; }
    100% { opacity: 1; }
  }

  .lab-cell {
    outline: none;
  }

  /* UX-Z3: Smooth fill/stroke transitions on cell rects */
  .lab-cell rect {
    transition: fill 220ms ease, stroke-width 180ms ease, filter 180ms ease;
  }

  .lab-cell:hover rect {
    filter: brightness(1.06) saturate(1.1);
  }

  .lab-cell:focus-visible rect {
    stroke: #111;
    stroke-width: 3;
  }

  .cell-title,
  .cell-value,
  .cell-meta {
    fill: #17130f;
    font-family: 'JetBrains Mono', monospace;
    pointer-events: none;
  }

  .cell-title {
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .cell-value {
    font-weight: 700;
  }

  .cell-meta {
    opacity: 0.72;
  }

  /* UX-Z7: Tooltip uses transform for smooth GPU-accelerated following */
  .lab-tooltip {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 10;
    min-width: 210px;
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(12, 13, 11, 0.94);
    color: #fff;
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.22);
    pointer-events: none;
    transition: transform 70ms ease-out;
    will-change: transform;
  }

  .tooltip-title {
    display: block;
    margin-bottom: 6px;
    color: rgba(255, 255, 255, 0.82);
    font: 600 12px/1.2 'JetBrains Mono', monospace;
  }

  .lab-tooltip strong {
    display: block;
    margin-bottom: 8px;
    color: #4af000;
    font: 700 28px/1 'Inter', sans-serif;
    letter-spacing: -0.03em;
  }

  .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    color: rgba(255, 255, 255, 0.76);
    font: 500 12px/1.45 'JetBrains Mono', monospace;
  }

  .lab-timeframe-card {
    margin-top: 14px;
    padding: 14px;
    border-radius: 20px;
    background: rgba(246, 241, 233, 0.82);
  }

  .timeframe-value {
    color: #3d3228;
    font: 700 12px/1 'JetBrains Mono', monospace;
  }

  .timeframe-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 12px 0;
  }

  .timeframe-strip {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .strip-segment {
    position: relative;
    min-height: 62px;
    padding: 10px;
    border-radius: 16px;
    overflow: hidden;
    text-align: left;
    font: 700 11px/1 'JetBrains Mono', monospace;
  }

  .strip-segment::after {
    content: '';
    position: absolute;
    inset: auto 0 0 0;
    height: var(--segment);
    min-height: 18px;
    background:
      linear-gradient(180deg, rgba(132, 164, 255, 0.42), rgba(90, 215, 124, 0.48));
  }

  .strip-segment.active {
    border-color: #111;
    box-shadow: inset 0 0 0 2px #111;
  }

  .strip-segment span {
    position: relative;
    z-index: 1;
  }

  .lab-rail {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .rail-card {
    padding: 18px;
  }

  .rail-card h2 {
    margin: 10px 0 8px;
    font: 700 28px/1.02 'Inter', sans-serif;
    letter-spacing: -0.04em;
  }

  .rail-card p {
    margin: 0;
    color: #6a5d50;
    font: 500 14px/1.6 'Inter', sans-serif;
  }

  .rail-stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 16px;
  }

  .rail-stat-grid div {
    padding: 12px;
    border-radius: 16px;
    background: rgba(246, 241, 233, 0.8);
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .rail-stat-grid span {
    color: #857667;
    font: 700 10px/1 'JetBrains Mono', monospace;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .rail-stat-grid strong {
    font: 700 16px/1.1 'Inter', sans-serif;
    letter-spacing: -0.02em;
  }

  .rail-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
  }

  .rail-row {
    display: grid;
    grid-template-columns: 38px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    text-align: left;
  }

  .rail-row:hover,
  .lab-toggle-group button:hover,
  .timeframe-buttons button:hover,
  .strip-segment:hover,
  .crumb-btn:hover,
  .crumb-reset:hover {
    transform: translateY(-1px);
    border-color: rgba(17, 17, 17, 0.24);
    background: #fff;
  }

  .rail-rank {
    color: #86786a;
    font: 700 12px/1 'JetBrains Mono', monospace;
  }

  .rail-name {
    font: 600 13px/1.2 'Inter', sans-serif;
  }

  .rail-value {
    color: #473d34;
    font: 700 12px/1 'JetBrains Mono', monospace;
  }

  .principles {
    margin: 14px 0 0;
    padding-left: 18px;
    color: #564a40;
    font: 500 14px/1.6 'Inter', sans-serif;
  }

  @media (max-width: 1100px) {
    .lab-hero,
    .lab-shell {
      grid-template-columns: 1fr;
    }

    .lab-hero-card {
      order: -1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .lab-surface.zoom-in,
    .lab-surface.zoom-out { animation: none; }
    .lab-svg.morphing rect { animation: none; }
    .lab-cell rect { transition: none; }
    .lab-tooltip { transition: none; }
    .rail-row,
    .lab-toggle-group button,
    .timeframe-buttons button,
    .strip-segment,
    .crumb-btn,
    .crumb-reset { transition: none; }
  }

  @media (max-width: 720px) {
    .zoom-lab { padding: 12px; }

    .lab-hero,
    .lab-shell {
      gap: 12px;
    }

    .lab-copy {
      padding: 16px 18px;
    }

    .lab-copy h1 {
      font-size: clamp(1.8rem, 10vw, 2.7rem);
      margin: 8px 0 6px;
    }

    .lab-copy p {
      font-size: 0.92rem;
      line-height: 1.5;
    }

    .lab-copy,
    .lab-hero-card,
    .lab-canvas-card,
    .rail-card {
      border-radius: 20px;
    }

    .lab-hero-card { padding: 16px; }

    .lab-canvas-card,
    .rail-card {
      padding: 14px;
    }

    .lab-summary-row,
    .lab-toolbar,
    .timeframe-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .lab-surface-wrap,
    .lab-surface {
      min-height: 360px;
    }

    .timeframe-strip {
      grid-template-columns: 1fr;
    }

    .rail-stat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
