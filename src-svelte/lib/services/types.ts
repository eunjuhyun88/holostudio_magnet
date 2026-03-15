/**
 * services/types.ts — Re-exports from shared contracts for backward compatibility.
 *
 * Source of truth: packages/contracts/src/dashboard.ts
 * All consumers can continue importing from this file without changes.
 */

export type {
  ResearchSummary,
  NetworkSummary,
  ProtocolSummary,
  ModelSummaryItem,
  ModelsSummary,
  BondItem,
  PortfolioSummary,
  DashboardEvent,
  DashboardData,
} from '@mesh/contracts';
