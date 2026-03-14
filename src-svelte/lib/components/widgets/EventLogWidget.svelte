<script lang="ts">
  import type { DashboardEvent } from "../../services/types.ts";

  export let events: DashboardEvent[] = [];

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const TYPE_COLORS: Record<string, string> = {
    SYS: "var(--accent, #D97757)",
    NET: "var(--blue, #2980b9)",
    JOB: "var(--green, #27864a)",
    EXP: "var(--gold, #d4a017)",
    WARN: "var(--red, #c0392b)",
  };
</script>

<div class="el">
  {#each events as ev (ev.id)}
    <div class="el-row">
      <span class="el-time">{fmtTime(ev.timestamp)}</span>
      <span class="el-type" style:color={TYPE_COLORS[ev.type] || "var(--text-muted)"}
            style:background="color-mix(in srgb, {TYPE_COLORS[ev.type] || 'gray'} 12%, transparent)">
        {ev.type}
      </span>
      <span class="el-msg">{ev.message}</span>
    </div>
  {/each}
  {#if events.length === 0}
    <div class="el-empty">No events yet</div>
  {/if}
</div>

<style>
  .el { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow-y: auto; }
  .el-row {
    display: flex; align-items: center; gap: 6px;
    padding: 3px 0;
    border-bottom: 1px solid rgba(0,0,0,0.04);
  }
  .el-row:last-child { border-bottom: none; }
  .el-time {
    font-family: var(--font-mono); font-size: 0.48rem; font-weight: 500;
    color: var(--text-muted, #9a9590); white-space: nowrap; flex-shrink: 0;
  }
  .el-type {
    font-family: var(--font-mono); font-size: 0.44rem; font-weight: 700;
    padding: 0 4px; border-radius: 3px;
    flex-shrink: 0; text-align: center; min-width: 28px;
  }
  .el-msg {
    font-family: var(--font-mono); font-size: 0.52rem;
    color: var(--text-primary, #2C2824); flex: 1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .el-empty {
    font-family: var(--font-mono); font-size: 0.55rem;
    color: var(--text-muted, #9a9590); text-align: center; padding: 12px;
  }
</style>
