<script lang="ts">
  import { onMount } from 'svelte';
  import { zoomable } from '../actions/zoomable.ts';
  import { CATEGORY_SHORT, CATEGORY_COLORS, resolveExperimentCategory } from '../data/modifications.ts';

  import type { VerificationState } from '../stores/jobStore.ts';

  interface TreeNode {
    id: number;
    parentId: number | null;
    status: string;
    verification: VerificationState;
    metric: number;
    modification: string;
    branchId: number;
    tier: number;
  }

  const VERIFY_ICON_COLOR: Record<VerificationState, string> = {
    'pending': 'none',
    'committed': '#e67e22',
    'revealed': '#2980b9',
    'verified': '#27864a',
    'spot-checked': '#8b5cf6',
  };

  export let data: TreeNode[] = [];
  export let width: number = 560;
  export let bestMetric: number = Infinity;

  const PAD = { top: 24, right: 20, bottom: 20, left: 44 };
  const NODE_R = 5;
  const COL_GAP = 22;
  const ROW_GAP = 40;

  // Group by branch
  $: branchMap = (() => {
    const map = new Map<number, TreeNode[]>();
    for (const n of data) {
      if (!map.has(n.branchId)) map.set(n.branchId, []);
      map.get(n.branchId)!.push(n);
    }
    return map;
  })();

  $: branches = [...branchMap.keys()].sort((a, b) => a - b);

  /** Derive short category label for each branch from its first node's modification */
  $: branchLabel = (() => {
    const labels = new Map<number, { short: string; color: string }>();
    for (const [bid, nodes] of branchMap) {
      const first = nodes[0];
      const cat = first ? resolveExperimentCategory(first.modification) : undefined;
      labels.set(bid, {
        short: cat ? CATEGORY_SHORT[cat] : `B${bid}`,
        color: cat ? CATEGORY_COLORS[cat] : 'var(--text-muted, #9a9590)',
      });
    }
    return labels;
  })();
  $: maxLen = Math.max(1, ...branches.map(b => branchMap.get(b)?.length ?? 0));

  $: plotW = width - PAD.left - PAD.right;
  $: plotH = PAD.top + branches.length * ROW_GAP + PAD.bottom;

  // Position: each branch is a horizontal lane
  $: nodePositions = (() => {
    const pos = new Map<number, { x: number; y: number; node: TreeNode }>();
    branches.forEach((branchId, laneIdx) => {
      const nodes = branchMap.get(branchId) ?? [];
      nodes.forEach((n, colIdx) => {
        const x = PAD.left + (colIdx / Math.max(1, maxLen - 1)) * plotW;
        const y = PAD.top + laneIdx * ROW_GAP + ROW_GAP / 2;
        pos.set(n.id, { x: nodes.length === 1 ? PAD.left + plotW * 0.1 : x, y, node: n });
      });
    });
    return pos;
  })();

  // Edges
  $: edges = (() => {
    const result: { x1: number; y1: number; x2: number; y2: number; crossBranch: boolean }[] = [];
    for (const n of data) {
      if (n.parentId === null) continue;
      const from = nodePositions.get(n.parentId);
      const to = nodePositions.get(n.id);
      if (!from || !to) continue;
      result.push({
        x1: from.x, y1: from.y,
        x2: to.x, y2: to.y,
        crossBranch: from.node.branchId !== to.node.branchId,
      });
    }
    return result;
  })();

  function nodeColor(n: TreeNode): string {
    const cat = resolveExperimentCategory(n.modification);
    const catColor = CATEGORY_COLORS[cat] ?? '#9a9590';
    if (n.status === 'crash') return '#c0392b';
    if (n.metric > 0 && n.metric <= bestMetric) return catColor;
    if (n.status === 'keep') return catColor;
    return catColor + '55'; // faded
  }

  function nodeRadius(n: TreeNode): number {
    if (n.metric > 0 && n.metric <= bestMetric) return 7;
    if (n.status === 'keep') return NODE_R;
    if (n.status === 'crash') return 3;
    return 3.5;
  }

  function tierBadge(tier: number): string {
    if (tier >= 8) return '8G';
    if (tier >= 4) return '4G';
    if (tier >= 2) return '2G';
    return '';
  }

  const TIER_COLORS: Record<number, string> = {
    2: '#2d6ca2',
    4: '#8b5cf6',
    8: '#D97757',
  };

  let mounted = false;
  onMount(() => { mounted = true; });
</script>

<div class="tree-container" class:mounted use:zoomable>
  <svg {width} height={plotH} viewBox="0 0 {width} {plotH}" class="tree-svg">
    <defs>
      <filter id="tree-best-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="rgba(217,119,87,0.55)" />
      </filter>
      <filter id="tree-keep-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="rgba(217,119,87,0.2)" />
      </filter>
    </defs>

    <!-- Branch lane labels -->
    {#each branches as branchId, i (branchId)}
      <text
        x={PAD.left - 6}
        y={PAD.top + i * ROW_GAP + ROW_GAP / 2 + 3}
        text-anchor="end"
        fill={branchLabel.get(branchId)?.color ?? 'var(--text-muted, #9a9590)'}
        font-size="9"
        font-weight="700"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        letter-spacing="0.04em"
      >{branchLabel.get(branchId)?.short ?? `B${branchId}`}</text>

      <!-- Lane guideline -->
      <line
        x1={PAD.left}
        y1={PAD.top + i * ROW_GAP + ROW_GAP / 2}
        x2={width - PAD.right}
        y2={PAD.top + i * ROW_GAP + ROW_GAP / 2}
        stroke="var(--border-subtle, #EDEAE5)"
        stroke-width="0.5"
        stroke-dasharray="2,4"
      />
    {/each}

    <!-- Edges -->
    {#each edges as edge (edge.x1 + ',' + edge.y1 + ',' + edge.x2 + ',' + edge.y2)}
      <path
        class="tree-edge"
        d="M{edge.x1},{edge.y1} C{(edge.x1 + edge.x2) / 2},{edge.y1} {(edge.x1 + edge.x2) / 2},{edge.y2} {edge.x2},{edge.y2}"
        fill="none"
        stroke={edge.crossBranch ? 'rgba(217,119,87,0.3)' : 'rgba(39,134,74,0.25)'}
        stroke-width={edge.crossBranch ? 0.8 : 1}
        stroke-dasharray={edge.crossBranch ? '3,3' : 'none'}
      />
    {/each}

    <!-- Nodes -->
    {#each data as n, idx (n.id)}
      {@const pos = nodePositions.get(n.id)}
      {#if pos}
        {@const isBest = n.metric > 0 && n.metric <= bestMetric}
        <circle
          class="tree-node"
          cx={pos.x}
          cy={pos.y}
          r={nodeRadius(n)}
          fill={nodeColor(n)}
          stroke={isBest ? 'rgba(255,255,255,0.8)' : n.status === 'keep' ? 'rgba(39,134,74,0.3)' : 'none'}
          stroke-width={isBest ? 1.5 : n.status === 'keep' ? 0.8 : 0}
          filter={isBest ? 'url(#tree-best-glow)' : n.status === 'keep' ? 'url(#tree-keep-glow)' : undefined}
          style="transition-delay:{mounted ? (30 + idx * 20) : 0}ms"
        >
          <title>#{n.id} B{n.branchId} {n.status} {n.metric > 0 ? n.metric.toFixed(3) : '--'} T{n.tier}</title>
        </circle>

        <!-- Tier badge for promoted experiments -->
        {#if tierBadge(n.tier)}
          <text
            x={pos.x}
            y={pos.y - nodeRadius(n) - 3}
            text-anchor="middle"
            fill={TIER_COLORS[n.tier] ?? 'var(--text-muted, #9a9590)'}
            font-size="8"
            font-weight="700"
            font-family="var(--font-mono, 'JetBrains Mono', monospace)"
            class="tree-badge"
          >{tierBadge(n.tier)}</text>
        {/if}

        <!-- Best metric label -->
        {#if isBest}
          <text
            class="tree-best-label"
            x={pos.x}
            y={pos.y + nodeRadius(n) + 10}
            text-anchor="middle"
            fill="#27864a"
            font-size="9"
            font-weight="700"
            font-family="var(--font-mono, 'JetBrains Mono', monospace)"
          >{n.metric.toFixed(3)}</text>
        {/if}

        <!-- Verification indicator -->
        {#if n.verification && n.verification !== 'pending'}
          {@const vc = VERIFY_ICON_COLOR[n.verification]}
          {#if n.verification === 'verified' || n.verification === 'spot-checked'}
            <!-- Checkmark for verified/spot-checked -->
            <circle cx={pos.x + nodeRadius(n) + 4} cy={pos.y - 2} r="3.5" fill={vc} opacity="0.8" class="tree-badge" />
            <path
              d="M{pos.x + nodeRadius(n) + 2},{pos.y - 2} l1.5,1.5 l2.5,-3"
              fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" class="tree-badge"
            />
          {:else}
            <!-- Small dot for committed/revealed -->
            <circle cx={pos.x + nodeRadius(n) + 4} cy={pos.y - 1} r="2" fill={vc} opacity="0.7" class="tree-badge" />
          {/if}
        {/if}
      {/if}
    {/each}
  </svg>

  {#if data.length === 0}
    <div class="tree-empty"><span>Awaiting experiment lineage...</span></div>
  {/if}
</div>


<style>
  .tree-container { position: relative; width: 100%; overflow-x: auto; overflow-y: hidden; }
  .tree-svg { display: block; min-width: 100%; height: auto; }
  .tree-empty {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 0.72rem; color: var(--text-muted, #9a9590);
  }
  .tree-node { opacity: 0; transition: opacity 0.3s ease; }
  .mounted .tree-node { opacity: 1; }
  .tree-edge { opacity: 0; transition: opacity 0.5s ease 0.2s; }
  .mounted .tree-edge { opacity: 1; }
  .tree-badge { opacity: 0; transition: opacity 0.3s ease 0.5s; }
  .mounted .tree-badge { opacity: 0.8; }
  .tree-best-label { opacity: 0; transition: opacity 0.4s ease 0.6s; }
  .mounted .tree-best-label { opacity: 1; }
</style>
