<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  /** Pixel size multiplier (default 1 = ~100px tall) */
  export let size: number = 1;

  /** Owl mood drives animation behavior */
  export let mood: 'idle' | 'research' | 'build' | 'celebrate' | 'sleep' = 'idle';

  const COLORS: Record<string, string> = {
    'K': '#2D2D2D', 'T': '#D97757', 't': '#E8956E', 'S': '#C4644A',
    's': '#B85A3E', 'W': '#FFFFFF', 'P': '#1A1A1A', 'F': '#FAF0EB',
    'f': '#EDD8CB', 'C': '#E8D5C4', 'G': '#C8960F', 'g': '#A67A0A',
  };

  // ── Frames ──
  const idle: string[] = [
    '________KK__KK________',
    '_______KtTKKTtK_______',
    '_______KtTTTTtK_______',
    '______KtTTTTTTtK______',
    '_____KTTTTTTTTTtK_____',
    '____KTTTTTTTTTTTTK____',
    '___KTTTTTTTTTTTTTTK___',
    '___KTFFFFFFFFFFFFFFK___',
    '__KTFWWWWFFWWWWFTK__',
    '__KTFWHPPFFHPPWFTK__',
    '__KTFWPPPFFPPPWFTK__',
    '__KTFWWWWffWWWWfTK__',
    '___KTfFFFFGFFFfTK___',
    '__KSTTTTTTGTTTTTTSK__',
    '__KSSTTCCCCCCTTSSKK__',
    '___KSTCCCCCCCCTSSK___',
    '___KKTTCCCCCCTTSK____',
    '____KKTTTTTTTTKK_____',
    '_____KKgKKKKgKK______',
    '_____KggK__KggK______',
  ];

  const blink: string[] = [
    '________KK__KK________',
    '_______KtTKKTtK_______',
    '_______KtTTTTtK_______',
    '______KtTTTTTTtK______',
    '_____KTTTTTTTTTtK_____',
    '____KTTTTTTTTTTTTK____',
    '___KTTTTTTTTTTTTTTK___',
    '___KTFFFFFFFFFFFFFFK___',
    '__KTFFFFFFFFFFFFFFTK__',
    '__KTFFKKKFFKKKFFTK__',
    '__KTFFFFFFFFFFFFFFTK__',
    '__KTFFFFFffFFFFFfTK__',
    '___KTfFFFFGFFFfTK___',
    '__KSTTTTTTGTTTTTTSK__',
    '__KSSTTCCCCCCTTSSKK__',
    '___KSTCCCCCCCCTSSK___',
    '___KKTTCCCCCCTTSK____',
    '____KKTTTTTTTTKK_____',
    '_____KKgKKKKgKK______',
    '_____KggK__KggK______',
  ];

  const lookL: string[] = [
    '________KK__KK________',
    '_______KtTKKTtK_______',
    '_______KtTTTTtK_______',
    '______KtTTTTTTtK______',
    '_____KTTTTTTTTTtK_____',
    '____KTTTTTTTTTTTTK____',
    '___KTTTTTTTTTTTTTTK___',
    '___KTFFFFFFFFFFFFFFK___',
    '__KTFWWWWFFWWWWFTK__',
    '__KTFHPPWFFHPPWFTK__',
    '__KTFPPPWFFPPPWFTK__',
    '__KTFWWWWffWWWWfTK__',
    '___KTfFFFFGFFFfTK___',
    '__KSTTTTTTGTTTTTTSK__',
    '__KSSTTCCCCCCTTSSKK__',
    '___KSTCCCCCCCCTSSK___',
    '___KKTTCCCCCCTTSK____',
    '____KKTTTTTTTTKK_____',
    '_____KKgKKKKgKK______',
    '_____KggK__KggK______',
  ];

  const lookR: string[] = [
    '________KK__KK________',
    '_______KtTKKTtK_______',
    '_______KtTTTTtK_______',
    '______KtTTTTTTtK______',
    '_____KTTTTTTTTTtK_____',
    '____KTTTTTTTTTTTTK____',
    '___KTTTTTTTTTTTTTTK___',
    '___KTFFFFFFFFFFFFFFK___',
    '__KTFWWWWFFWWWWFTK__',
    '__KTFWPHPFFWPHPFTK__',
    '__KTFWPPPFFWPPPFTK__',
    '__KTFWWWWffWWWWfTK__',
    '___KTfFFFFGFFFfTK___',
    '__KSTTTTTTGTTTTTTSK__',
    '__KSSTTCCCCCCTTSSKK__',
    '___KSTCCCCCCCCTSSK___',
    '___KKTTCCCCCCTTSK____',
    '____KKTTTTTTTTKK_____',
    '_____KKgKKKKgKK______',
    '_____KggK__KggK______',
  ];

  const wingUp: string[] = [
    '_KS_____KK__KK_____SK_',
    '_KSK___KtTKKTtK___KSK_',
    '__KS___KtTTTTtK___SK__',
    '______KtTTTTTTtK______',
    '_____KTTTTTTTTTtK_____',
    '____KTTTTTTTTTTTTK____',
    '___KTTTTTTTTTTTTTTK___',
    '___KTFFFFFFFFFFFFFFK___',
    '__KTFWWWWFFWWWWFTK__',
    '__KTFWHPPFFHPPWFTK__',
    '__KTFWPPPFFPPPWFTK__',
    '__KTFWWWWffWWWWfTK__',
    '___KTfFFFFGFFFfTK___',
    '___KTTTTTTTGTTTTTTK___',
    '___KSTCCCCCCTTSSKK___',
    '___KSTCCCCCCCCTSSK___',
    '___KKTTCCCCCCTTSK____',
    '____KKTTTTTTTTKK_____',
    '_____KKgKKKKgKK______',
    '_____KggK__KggK______',
  ];

  // Sleep frame: eyes are ーー lines
  const sleep: string[] = [
    '________KK__KK________',
    '_______KtTKKTtK_______',
    '_______KtTTTTtK_______',
    '______KtTTTTTTtK______',
    '_____KTTTTTTTTTtK_____',
    '____KTTTTTTTTTTTTK____',
    '___KTTTTTTTTTTTTTTK___',
    '___KTFFFFFFFFFFFFFFK___',
    '__KTFFFFFFFFFFFFFFTK__',
    '__KTFFFFFFFFFFFFFFTK__',
    '__KTFFKKKKFFKKKKFTK__',
    '__KTFFFFFffFFFFFfTK__',
    '___KTfFFFFGFFFfTK___',
    '__KSTTTTTTGTTTTTTSK__',
    '__KSSTTCCCCCCTTSSKK__',
    '___KSTCCCCCCCCTSSK___',
    '___KKTTCCCCCCTTSK____',
    '____KKTTTTTTTTKK_____',
    '_____KKgKKKKgKK______',
    '_____KggK__KggK______',
  ];

  type FrameName = 'idle' | 'blink' | 'lookL' | 'lookR' | 'wingUp' | 'sleep';
  const frames: Record<FrameName, string[]> = { idle, blink, lookL, lookR, wingUp, sleep };

  // ── Animation Sequences ──
  type Step = [FrameName, number];
  const sequences: Record<string, Step[]> = {
    idle: [
      ['idle',1200],['blink',100],['idle',80],['blink',85],['idle',1500],
      ['lookL',800],['idle',400],['lookR',600],['idle',1000],
      ['blink',100],['idle',2000],
    ],
    research: [
      ['lookL',500],['lookR',400],['lookL',300],['idle',200],['blink',100],
      ['idle',600],['lookR',800],['idle',400],
      ['lookL',600],['blink',100],['idle',300],['lookR',500],['idle',1000],
    ],
    build: [
      ['idle',400],['wingUp',300],['idle',200],['wingUp',300],['idle',200],
      ['blink',100],['idle',500],['lookR',300],['idle',200],['wingUp',400],
      ['idle',300],['blink',100],['idle',400],
    ],
    celebrate: [
      ['wingUp',200],['idle',150],['wingUp',200],['idle',150],['wingUp',200],
      ['idle',300],['blink',100],['idle',800],
      ['wingUp',200],['idle',150],['wingUp',200],['idle',1500],
    ],
    sleep: [
      ['sleep',2000],['blink',120],['sleep',3000],['blink',120],['sleep',4000],
    ],
  };

  // ── Canvas rendering ──
  let canvasEl: HTMLCanvasElement;
  let animTimer: ReturnType<typeof setTimeout> | null = null;
  let seqIdx = 0;
  let currentMood = mood;

  const PX = 5; // base pixel size
  const allFrameArrays = [idle, blink, lookL, lookR, wingUp, sleep];
  const maxW = Math.max(...allFrameArrays.flatMap(f => f.map(r => r.length)));
  const maxH = Math.max(...allFrameArrays.map(f => f.length));

  $: canvasW = maxW * PX;
  $: canvasH = maxH * PX;
  $: displayW = canvasW * size;
  $: displayH = canvasH * size;

  // Pre-rendered frame cache — avoids per-pixel iteration every animation tick
  const frameCache = new Map<FrameName, HTMLCanvasElement>();
  const RENDER_SCALE = 2;

  function preRenderAllFrames() {
    const w = canvasW * RENDER_SCALE;
    const h = canvasH * RENDER_SCALE;
    for (const [name, grid] of Object.entries(frames) as [FrameName, string[]][]) {
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d')!;
      const offX = Math.floor((maxW - grid[0].length) / 2);
      const offY = Math.floor((maxH - grid.length) / 2);
      for (let y = 0; y < grid.length; y++) {
        const row = grid[y];
        for (let x = 0; x < row.length; x++) {
          const fill = COLORS[row[x]];
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect((x + offX) * PX * RENDER_SCALE, (y + offY) * PX * RENDER_SCALE, PX * RENDER_SCALE, PX * RENDER_SCALE);
          }
        }
      }
      frameCache.set(name, off);
    }
  }

  function drawFrame(frameName: FrameName) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const cached = frameCache.get(frameName);
    if (cached) {
      ctx.clearRect(0, 0, canvasW * RENDER_SCALE, canvasH * RENDER_SCALE);
      ctx.drawImage(cached, 0, 0);
    }
  }

  function runSequence() {
    const seq = sequences[currentMood] || sequences.idle;
    const [frameName, dur] = seq[seqIdx % seq.length];
    drawFrame(frameName);
    seqIdx++;
    animTimer = setTimeout(runSequence, dur);
  }

  function startAnimation() {
    if (animTimer) clearTimeout(animTimer);
    seqIdx = 0;
    currentMood = mood;
    preRenderAllFrames();
    runSequence();
  }

  // React to mood changes
  $: if (canvasEl && mood !== currentMood) {
    currentMood = mood;
    if (animTimer) clearTimeout(animTimer);
    seqIdx = 0;
    runSequence();
  }

  onMount(() => {
    startAnimation();
  });

  onDestroy(() => {
    if (animTimer) clearTimeout(animTimer);
  });
</script>

<canvas
  bind:this={canvasEl}
  width={canvasW * 2}
  height={canvasH * 2}
  class="pixel-owl"
  style="width:{displayW}px;height:{displayH}px;"
></canvas>

<style>
  .pixel-owl {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    display: block;
  }
</style>
