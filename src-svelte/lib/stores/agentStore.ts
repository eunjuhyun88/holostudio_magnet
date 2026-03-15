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
  if (lower.includes('btc') || lower.includes('bitcoin') || lower.includes('비트코인')) {
    return '비트코인 가격 예측 모델을 만들어 드릴까요? 연구를 시작하려면 아래 버튼을 눌러주세요.';
  }
  if (lower.includes('모델') || lower.includes('model')) {
    return '현재 활성 모델 목록을 불러오고 있어요. Models 탭에서 자세히 볼 수 있어요.';
  }
  if (lower.includes('gpu') || lower.includes('노드') || lower.includes('node')) {
    return '네트워크에 연결된 노드 현황을 확인하고 있어요. Network 탭에서 상세 정보를 볼 수 있어요.';
  }
  if (lower.includes('수익') || lower.includes('earn') || lower.includes('reward')) {
    return '수익 현황을 조회하고 있어요. Protocol 탭에서 자세한 내역을 확인할 수 있어요.';
  }
  return `"${input}"에 대해 알아보고 있어요. 잠시만 기다려 주세요.`;
}

export const agentStore = createAgentStore();

// ── Derived Stores ──

export const agentMessages = derived(agentStore, $s => $s.messages);
export const agentSheetOpen = derived(agentStore, $s => $s.sheetOpen);
export const agentLoading = derived(agentStore, $s => $s.loading);
export const agentInputFocused = derived(agentStore, $s => $s.inputFocused);
