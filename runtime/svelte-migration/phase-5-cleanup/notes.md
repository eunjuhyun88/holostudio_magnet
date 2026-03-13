# Remove legacy React shell

- Goal: Delete now-unused React shell code after the Svelte default runtime is stable.
- Current status: partial
- Result:
  - removed stale migration-only Svelte files
  - kept the React shell as a compatibility fallback because evaluator rules still inspect `src/Visualizer.tsx`
  - next cleanup step is relaxing evaluator assumptions, then removing the legacy shell entirely
