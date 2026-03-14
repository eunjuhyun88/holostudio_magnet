<script lang="ts">
  export let type: "sparkle" | "grid" | "chart" | "globe" | "protocol" | "arrow" | "research" | "portfolio" = "sparkle";
  export let size: number = 16;
</script>

<svg width={size} height={size} viewBox="0 0 16 16" fill="none" class="px-icon" shape-rendering="crispEdges">
  {#if type === "sparkle"}
    <rect x="7" y="1" width="2" height="2" fill="currentColor"/>
    <rect x="7" y="3" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="5" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="7" y="5" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="1" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="3" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="5" y="7" width="6" height="2" fill="currentColor"/>
    <rect x="11" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="13" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="9" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="7" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="9" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="7" y="11" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="7" y="13" width="2" height="2" fill="currentColor"/>
  {:else if type === "grid"}
    <rect x="1" y="1" width="6" height="6" fill="currentColor"/>
    <rect x="9" y="1" width="6" height="6" fill="currentColor" opacity="0.7"/>
    <rect x="1" y="9" width="6" height="6" fill="currentColor" opacity="0.7"/>
    <rect x="9" y="9" width="6" height="6" fill="currentColor"/>
  {:else if type === "chart"}
    <rect x="1" y="13" width="14" height="2" fill="currentColor" opacity="0.3"/>
    <rect x="1" y="1" width="2" height="14" fill="currentColor" opacity="0.3"/>
    <rect x="3" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="7" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="5" width="2" height="2" fill="currentColor"/>
    <rect x="11" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="13" y="1" width="2" height="2" fill="currentColor"/>
    <rect x="4" y="8" width="2" height="2" fill="currentColor" opacity="0.4"/>
    <rect x="6" y="8" width="2" height="2" fill="currentColor" opacity="0.4"/>
    <rect x="8" y="6" width="2" height="2" fill="currentColor" opacity="0.4"/>
    <rect x="10" y="4" width="2" height="2" fill="currentColor" opacity="0.4"/>
    <rect x="12" y="2" width="2" height="2" fill="currentColor" opacity="0.4"/>
  {:else if type === "globe"}
    <rect x="5" y="1" width="6" height="2" fill="currentColor"/>
    <rect x="3" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="11" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="1" y="5" width="2" height="6" fill="currentColor"/>
    <rect x="13" y="5" width="2" height="6" fill="currentColor"/>
    <rect x="3" y="11" width="2" height="2" fill="currentColor"/>
    <rect x="11" y="11" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="13" width="6" height="2" fill="currentColor"/>
    <rect x="1" y="7" width="14" height="2" fill="currentColor" opacity="0.35"/>
    <rect x="7" y="1" width="2" height="14" fill="currentColor" opacity="0.35"/>
    <rect x="5" y="3" width="2" height="2" fill="currentColor" opacity="0.25"/>
    <rect x="9" y="3" width="2" height="2" fill="currentColor" opacity="0.25"/>
    <rect x="5" y="11" width="2" height="2" fill="currentColor" opacity="0.25"/>
    <rect x="9" y="11" width="2" height="2" fill="currentColor" opacity="0.25"/>
  {:else if type === "protocol"}
    <rect x="3" y="1" width="4" height="2" fill="currentColor"/>
    <rect x="1" y="3" width="2" height="4" fill="currentColor"/>
    <rect x="7" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="3" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="5" y="5" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="7" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="9" y="9" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="11" y="7" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="9" y="5" width="4" height="2" fill="currentColor"/>
    <rect x="13" y="7" width="2" height="4" fill="currentColor"/>
    <rect x="9" y="11" width="4" height="2" fill="currentColor"/>
    <rect x="7" y="11" width="2" height="2" fill="currentColor"/>
    <rect x="1" y="5" width="2" height="2" fill="currentColor"/>
    <rect x="3" y="5" width="2" height="2" fill="currentColor"/>
  {:else if type === "arrow"}
    <rect x="1" y="7" width="10" height="2" fill="currentColor" opacity="0.4"/>
    <rect x="9" y="5" width="2" height="2" fill="currentColor"/>
    <rect x="11" y="7" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="9" width="2" height="2" fill="currentColor"/>
  {:else if type === "research"}
    <!-- Microscope / magnifying glass -->
    <rect x="5" y="1" width="6" height="2" fill="currentColor"/>
    <rect x="3" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="11" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="3" y="5" width="2" height="2" fill="currentColor"/>
    <rect x="11" y="5" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="7" width="6" height="2" fill="currentColor"/>
    <rect x="7" y="9" width="2" height="2" fill="currentColor"/>
    <rect x="5" y="11" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="7" y="11" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="11" width="2" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="5" y="13" width="6" height="2" fill="currentColor" opacity="0.4"/>
  {:else if type === "portfolio"}
    <!-- Briefcase -->
    <rect x="5" y="1" width="6" height="2" fill="currentColor" opacity="0.5"/>
    <rect x="5" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="9" y="3" width="2" height="2" fill="currentColor"/>
    <rect x="1" y="5" width="14" height="2" fill="currentColor"/>
    <rect x="1" y="7" width="2" height="6" fill="currentColor"/>
    <rect x="13" y="7" width="2" height="6" fill="currentColor"/>
    <rect x="1" y="13" width="14" height="2" fill="currentColor"/>
    <rect x="7" y="7" width="2" height="4" fill="currentColor" opacity="0.5"/>
    <rect x="5" y="9" width="2" height="2" fill="currentColor" opacity="0.3"/>
    <rect x="9" y="9" width="2" height="2" fill="currentColor" opacity="0.3"/>
  {/if}
</svg>
