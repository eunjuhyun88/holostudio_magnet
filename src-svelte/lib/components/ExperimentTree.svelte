<script lang="ts">
  import { onMount } from 'svelte';

  interface TreeNode {
    id: number;
    parentId: number | null;
    status: string;
    metric: number;
    modification: string;
    branchId: number;
    tier: number;
  }

  export let data: TreeNode[] = [];
  export let width: number = 560;
  export let bestMetric: number = Infinity;

  const PAD = { top: 24, right: 20, bottom: 20, left: 20 };
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
    if (n.metric > 0 && n.metric <= bestMetric) return '#27864a';
    if (n.status === 'keep') return '#27864a';
    if (n.status === 'crash') return '#c0392b';
    return 'rgba(154,149,144,0.45)';
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

<div class="tree-container" class:mounted>
  <svg {width} height={plotH} viewBox="0 0 {width} {plotH}" class="tree-svg">
    <defs>
      <filter id="tree-best-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="rgba(39,134,74,0.5)" />
      </filter>
    </defs>

    <!-- Branch lane labels -->
    {#each branches as branchId, i}
      <text
        x={PAD.left - 6}
        y={PAD.top + i * ROW_GAP + ROW_GAP / 2 + 3}
        text-anchor="end"
        fill="var(--text-muted, #9a9590)"
        font-size="7"
        font-weight="600"
        font-family="var(--font-mono, 'JetBrains Mono', monospace)"
        letter-spacing="0.04em"
      >B{branchId}</text>

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
    {#each edges as edge}
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
    {#each data as n, idx}
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
          filter={isBest ? 'url(#tree-best-glow)' : undefined}
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
            font-size="6"
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
            font-size="7"
            font-weight="700"
            font-family="var(--font-mono, 'JetBrains Mono', monospace)"
          >{n.metric.toFixed(3)}</text>
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
