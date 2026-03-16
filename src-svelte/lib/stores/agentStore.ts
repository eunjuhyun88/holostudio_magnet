import { writable, derived } from 'svelte/store';
import { router } from './router.ts';
import type { AppView } from './router.ts';

// ── Types ──

export interface AgentCard {
  type: 'model' | 'research' | 'gpu' | 'earnings' | 'branch';
  data: Record<string, any>;
}

export interface AgentAction {
  label: string;
  view?: AppView;      // optional navigation target
  handler?: () => void; // custom handler (overrides view navigation)
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  cards?: AgentCard[];
  actions?: AgentAction[];
  timestamp: number;
}

interface AgentState {
  messages: AgentMessage[];
  sheetOpen: boolean;
  loading: boolean;
  inputFocused: boolean;
}

// ── Initial State ──

const initialState: AgentState = {
  messages: [],
  sheetOpen: false,
  loading: false,
  inputFocused: false,
};

// ── Store ──

function createAgentStore() {
  const { subscribe, set, update } = writable<AgentState>(initialState);

  let messageCounter = 0;

  function nextId(): string {
    return `msg-${++messageCounter}-${Date.now()}`;
  }

  return {
    subscribe,

    /** Send user input — generates a placeholder agent response for now */
    async send(input: string) {
      if (!input.trim()) return;

      const userMsg: AgentMessage = {
        id: nextId(),
        role: 'user',
        content: input.trim(),
        timestamp: Date.now(),
      };

      update(s => ({
        ...s,
        messages: [...s.messages, userMsg],
        sheetOpen: true,
        loading: true,
      }));

      // Simulate agent response (placeholder — will be replaced by real API)
      await new Promise(r => setTimeout(r, 800));

      const agentMsg: AgentMessage = {
        id: nextId(),
        role: 'agent',
        content: getPlaceholderResponse(input.trim()),
        timestamp: Date.now(),
      };

      update(s => ({
        ...s,
        messages: [...s.messages, agentMsg],
        loading: false,
      }));
    },

    /** Open sheet without sending */
    openSheet() {
      update(s => ({ ...s, sheetOpen: true }));
    },

    /** Close sheet (keep messages) */
    closeSheet() {
      update(s => ({ ...s, sheetOpen: false }));
    },

    /** Toggle sheet */
    toggleSheet() {
      update(s => ({ ...s, sheetOpen: !s.sheetOpen }));
    },

    /** Set input focus state */
    setInputFocused(focused: boolean) {
      update(s => ({ ...s, inputFocused: focused }));
    },

    /** Clear all messages and close */
    clearMessages() {
      update(s => ({ ...s, messages: [], sheetOpen: false, loading: false }));
    },

    /** Reset to initial state */
    reset() {
      set(initialState);
    },
  };
}

// ── Placeholder Responses ──

function getPlaceholderResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('btc') || lower.includes('bitcoin')) {
    return 'Would you like to create a Bitcoin price prediction model? Press the button below to start research.';
  }
  if (lower.includes('model')) {
    return 'Loading the list of active models. You can view details in the Models tab.';
  }
  if (lower.includes('gpu') || lower.includes('node')) {
    return 'Checking the status of connected nodes. You can view details in the Network tab.';
  }
  if (lower.includes('earn') || lower.includes('reward')) {
    return 'Checking your earnings. You can view detailed history in the Protocol tab.';
  }
  return `Looking into "${input}". Please wait a moment.`;
}

export const agentStore = createAgentStore();

// ── Derived Stores ──

export const agentMessages = derived(agentStore, $s => $s.messages);
export const agentSheetOpen = derived(agentStore, $s => $s.sheetOpen);
export const agentLoading = derived(agentStore, $s => $s.loading);
export const agentInputFocused = derived(agentStore, $s => $s.inputFocused);
