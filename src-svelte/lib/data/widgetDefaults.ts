/**
 * widgetDefaults.ts — Widget metadata and default layouts
 *
 * Positions are flow-based (columns handle layout).
 * rect is kept for drag/resize but not used for initial column rendering.
 */

// ── Types ──

export type WidgetId =
  | "status-panel"
  | "jobs-list"
  | "findings"
  | "event-log"
  | "my-models"
  | "my-bonds"
  | "network-status"
  | "ecosystem";

export type WidgetCategory =
  | "research"
  | "network"
  | "protocol"
  | "action"
  | "portfolio";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  category: WidgetCategory;
  minW: number;
  minH: number;
}

export interface WidgetLayoutEntry {
  rect: { x: number; y: number; w: number; h: number };
  visible: boolean;
}

// ── Widget metadata (static) ──

export const WIDGET_META: WidgetMeta[] = [
  // Research (left column)
  { id: "status-panel", label: "Research Metrics", category: "research", minW: 240, minH: 80 },
  { id: "jobs-list", label: "Research Jobs", category: "research", minW: 220, minH: 160 },
  { id: "findings", label: "Findings", category: "research", minW: 220, minH: 120 },
  { id: "event-log", label: "Event Log", category: "research", minW: 220, minH: 140 },

  // Network & Protocol (right column)
  { id: "network-status", label: "Network", category: "network", minW: 220, minH: 160 },
  { id: "ecosystem", label: "Ecosystem", category: "protocol", minW: 220, minH: 160 },

  // Portfolio (right column)
  { id: "my-models", label: "My Models", category: "portfolio", minW: 220, minH: 160 },
  { id: "my-bonds", label: "My Bonds", category: "portfolio", minW: 220, minH: 140 },
];

// ── Category colors (for widget header dots) ──

export const CATEGORY_COLORS: Record<WidgetCategory, string> = {
  research: "#D97757",   // accent terracotta
  network: "#2980b9",    // blue
  protocol: "#27864a",   // green
  action: "#d4a017",     // gold
  portfolio: "#8e44ad",  // purple
};

// ── Default layouts ──

export const DEFAULT_LAYOUT_LOGGED_IN: Record<WidgetId, WidgetLayoutEntry> = {
  // Left side — research widgets (key widgets ON by default)
  "status-panel":    { rect: { x: 16,  y: 12,  w: 280, h: 90  }, visible: true },
  "jobs-list":       { rect: { x: 16,  y: 112, w: 280, h: 210 }, visible: true },
  "findings":        { rect: { x: 16,  y: 332, w: 280, h: 140 }, visible: false },
  "event-log":       { rect: { x: 16,  y: 482, w: 280, h: 140 }, visible: true },
  // Right side — network & protocol widgets
  "network-status":  { rect: { x: 1120, y: 12,  w: 280, h: 180 }, visible: true },
  "ecosystem":       { rect: { x: 1120, y: 202, w: 280, h: 180 }, visible: true },
  // Right side — portfolio widgets
  "my-models":       { rect: { x: 1120, y: 392, w: 280, h: 200 }, visible: true },
  "my-bonds":        { rect: { x: 1120, y: 602, w: 280, h: 140 }, visible: false },
};

export const DEFAULT_LAYOUT_LOGGED_OUT: Record<WidgetId, WidgetLayoutEntry> = {
  // Left side — research widgets (key ones ON by default)
  "status-panel":    { rect: { x: 16,  y: 12,  w: 260, h: 80  }, visible: true },
  "jobs-list":       { rect: { x: 16,  y: 102, w: 260, h: 200 }, visible: true },
  "findings":        { rect: { x: 16,  y: 312, w: 260, h: 120 }, visible: false },
  "event-log":       { rect: { x: 16,  y: 442, w: 260, h: 120 }, visible: true },
  // Right side — network & protocol widgets
  "network-status":  { rect: { x: 1120, y: 12,  w: 260, h: 170 }, visible: true },
  "ecosystem":       { rect: { x: 1120, y: 192, w: 260, h: 170 }, visible: true },
  // Right side — portfolio widgets (hidden when logged out)
  "my-models":       { rect: { x: 1120, y: 372, w: 260, h: 170 }, visible: false },
  "my-bonds":        { rect: { x: 1120, y: 552, w: 260, h: 110 }, visible: false },
};
