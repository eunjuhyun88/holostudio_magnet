/**
 * widgetStore.ts — Free-placement widget state management
 *
 * Each dashboard widget has a rect (x, y, w, h), visibility, minimized state,
 * and z-index. Positions persist to localStorage and scale to viewport size.
 */
import { writable, derived, get } from "svelte/store";
import {
  WIDGET_META,
  DEFAULT_LAYOUT_LOGGED_IN,
  DEFAULT_LAYOUT_LOGGED_OUT,
  type WidgetId,
  type WidgetCategory,
} from "../data/widgetDefaults.ts";

// ── Types ──

export type { WidgetId, WidgetCategory };

export interface WidgetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig {
  id: WidgetId;
  label: string;
  category: WidgetCategory;
  rect: WidgetRect;
  visible: boolean;
  minimized: boolean;
  zIndex: number;
  minW: number;
  minH: number;
}

export interface WidgetStoreState {
  widgets: Record<WidgetId, WidgetConfig>;
  maxZ: number;
}

type WidgetLayoutMode = "guest" | "member";

// ── Constants ──

const STORAGE_KEY_PREFIX = "hoot-widgets-v11";

function storageKeyFor(mode: WidgetLayoutMode) {
  return `${STORAGE_KEY_PREFIX}:${mode}`;
}

// ── Helpers ──

function buildDefaultState(loggedIn: boolean): WidgetStoreState {
  const layout = loggedIn ? DEFAULT_LAYOUT_LOGGED_IN : DEFAULT_LAYOUT_LOGGED_OUT;
  const widgets: Record<string, WidgetConfig> = {};

  for (const meta of WIDGET_META) {
    const layoutEntry = layout[meta.id];
    widgets[meta.id] = {
      id: meta.id,
      label: meta.label,
      category: meta.category,
      rect: layoutEntry?.rect ?? { x: 20, y: 20, w: meta.minW, h: meta.minH },
      visible: layoutEntry?.visible ?? false,
      minimized: false,
      zIndex: 10,
      minW: meta.minW,
      minH: meta.minH,
    };
  }

  return { widgets: widgets as Record<WidgetId, WidgetConfig>, maxZ: 10 };
}

// ── Store ──

function createWidgetStore() {
  const { subscribe, update, set } = writable<WidgetStoreState>(
    buildDefaultState(false)
  );

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let currentMode: WidgetLayoutMode = "guest";

  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const state = get({ subscribe });
      const serialized: Record<string, { rect: WidgetRect; visible: boolean; minimized: boolean }> = {};
      for (const [id, cfg] of Object.entries(state.widgets)) {
        serialized[id] = { rect: cfg.rect, visible: cfg.visible, minimized: cfg.minimized };
      }
      try {
        localStorage.setItem(storageKeyFor(currentMode), JSON.stringify(serialized));
      } catch {
        // localStorage full or unavailable
      }
    }, 200);
  }

  return {
    subscribe,

    /** Load layout from localStorage, or use defaults */
    loadLayout(loggedIn: boolean) {
      currentMode = loggedIn ? "member" : "guest";
      const base = buildDefaultState(loggedIn);

      try {
        const raw = localStorage.getItem(storageKeyFor(currentMode));
        if (raw) {
          const saved = JSON.parse(raw) as Record<string, { rect: WidgetRect; visible: boolean; minimized: boolean }>;
          for (const [id, data] of Object.entries(saved)) {
            if (base.widgets[id as WidgetId]) {
              base.widgets[id as WidgetId].rect = data.rect;
              base.widgets[id as WidgetId].visible = data.visible;
              base.widgets[id as WidgetId].minimized = data.minimized;
            }
          }
        }
      } catch {
        // corrupted data, use defaults
      }

      set(base);
    },

    /** Reset to defaults (clear localStorage) */
    resetLayout(loggedIn: boolean) {
      currentMode = loggedIn ? "member" : "guest";
      try { localStorage.removeItem(storageKeyFor(currentMode)); } catch {}
      set(buildDefaultState(loggedIn));
    },

    /** Move widget to new position */
    moveWidget(id: WidgetId, x: number, y: number) {
      update((s) => {
        if (s.widgets[id]) {
          s.widgets[id].rect.x = Math.max(0, x);
          s.widgets[id].rect.y = Math.max(0, y);
        }
        return s;
      });
      persist();
    },

    /** Resize widget */
    resizeWidget(id: WidgetId, w: number, h: number) {
      update((s) => {
        const cfg = s.widgets[id];
        if (cfg) {
          cfg.rect.w = Math.max(cfg.minW, w);
          cfg.rect.h = Math.max(cfg.minH, h);
        }
        return s;
      });
      persist();
    },

    /** Bring widget to front */
    bringToFront(id: WidgetId) {
      update((s) => {
        s.maxZ += 1;
        if (s.widgets[id]) {
          s.widgets[id].zIndex = s.maxZ;
        }
        // Normalize if z-index gets too high
        if (s.maxZ > 9000) {
          const allZ = Object.values(s.widgets).map((w) => w.zIndex);
          const minZ = Math.min(...allZ);
          for (const w of Object.values(s.widgets)) {
            w.zIndex = w.zIndex - minZ + 10;
          }
          s.maxZ = s.maxZ - minZ + 10;
        }
        return s;
      });
    },

    /** Toggle minimize */
    toggleMinimize(id: WidgetId) {
      update((s) => {
        if (s.widgets[id]) {
          s.widgets[id].minimized = !s.widgets[id].minimized;
        }
        return s;
      });
      persist();
    },

    /** Adjust right-side widgets to fit viewport width without overlapping hero center */
    adjustForViewport(viewportWidth: number) {
      const rightWidgets: WidgetId[] = ["network-status", "ecosystem", "my-models", "my-bonds"];
      // Hero area is centered, max-width 720px — keep widgets outside of it
      const heroHalfW = 360; // 720 / 2
      const heroRight = Math.floor(viewportWidth / 2) + heroHalfW + 16;
      update((s) => {
        for (const id of rightWidgets) {
          const cfg = s.widgets[id];
          if (!cfg) continue;
          // Ensure widget doesn't go off-screen right
          const maxX = viewportWidth - cfg.rect.w - 16;
          // Ensure widget starts after hero area
          const minX = Math.max(heroRight, 16);
          cfg.rect.x = Math.min(maxX, Math.max(minX, cfg.rect.x));
        }
        return s;
      });
    },

    /** Toggle visibility */
    toggleVisible(id: WidgetId) {
      update((s) => {
        if (s.widgets[id]) {
          s.widgets[id].visible = !s.widgets[id].visible;
        }
        return s;
      });
      persist();
    },

  };
}

export const widgetStore = createWidgetStore();

/** Derived: sorted widget list for rendering */
export const widgetList = derived(widgetStore, ($s) =>
  Object.values($s.widgets).sort((a, b) => a.zIndex - b.zIndex)
);

/** Derived: visible widget list */
export const visibleWidgets = derived(widgetList, ($list) =>
  $list.filter((w) => w.visible)
);

/** Derived: hidden widget list (for toolbar) */
export const hiddenWidgets = derived(widgetList, ($list) =>
  $list.filter((w) => !w.visible)
);

/** Derived: all widgets sorted by category for dock */
export const allWidgets = derived(widgetStore, ($s) => {
  const order: WidgetCategory[] = ['research', 'action', 'network', 'portfolio', 'protocol'];
  return Object.values($s.widgets).sort((a, b) => {
    const ai = order.indexOf(a.category);
    const bi = order.indexOf(b.category);
    return ai - bi;
  });
});
