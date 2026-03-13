# Switch default entry to Svelte

- Goal: Make Svelte the default runtime only after parity and evaluator gates pass.
- Current status: completed
- Result:
  - `index.html` now boots `src-svelte/main.ts`
  - `vite.config.ts` is the default Svelte build path
  - legacy React moved to `index.react.html` + `vite.react.config.ts`
