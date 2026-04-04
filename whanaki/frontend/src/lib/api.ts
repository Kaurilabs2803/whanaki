/**
 * Typed API client for the Whānaki FastAPI backend.
 * All calls go through Next.js rewrite: /api/backend/* → FastAPI /v1/*
 */

export interface ModelOption {
  model_id: string;
  display_name: string;
  description: string;
  speed: "fast" | "balanced" | "thorough";
  is_active: boolean;
  is_default: boolean;
  parameter_count: string | null;
}

export interface Citation {
  doc_id: string;
  filename: string;
  page: number | null;
  section: string | null;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model_used: string | null;
  citations: Citation[];
  input_tokens: number | null;
  output_tokens: number | null;
  generation_ms: number | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  default_model: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  page_count: number | null;
  status: "uploading" | "processing" | "ready" | "failed";
  error_message: string | null;
  tags: string[];
  created_at: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  monthly_query_limit: number;
  ragflow_dataset_id: string | null;
  logo_url: string | null;
  primary_color: string;
  trial_ends_at: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  clerk_id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UsageSummary {
  month: string;
  query_count: number;
  queries_included: number;
  queries_remaining: number;
  total_input_tokens: number;
  total_output_tokens: number;
  model_breakdown: Record<string, number>;
  plan: string;
  percentage_used: number;
}

// ── SSE streaming types ────────────────────────────────────────────────────────

export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "citation"; citation: Citation }
  | { type: "done"; message_id: string; stats: Record<string, unknown> }
  | { type: "error"; detail: string };

// ── API functions ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  tenant: {
    get: (token: string) =>
      apiFetch<TenantInfo>("/tenant", token),

    update: (token: string, body: { name?: string; primary_color?: string }) =>
      apiFetch<TenantInfo>("/tenant", token, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    delete: (token: string) =>
      apiFetch<void>("/tenant", token, { method: "DELETE" }),
  },

  users: {
    list: (token: string) =>
      apiFetch<Member[]>("/users", token),

    remove: (token: string, userId: string) =>
      apiFetch<void>(`/users/${userId}`, token, { method: "DELETE" }),
  },

  models: {
    list: (token: string) =>
      apiFetch<ModelOption[]>("/models", token),
  },

  conversations: {
    list: (token: string) =>
      apiFetch<Conversation[]>("/conversations", token),

    messages: (token: string, conversationId: string) =>
      apiFetch<ChatMessage[]>(`/conversations/${conversationId}/messages`, token),

    delete: (token: string, conversationId: string) =>
      apiFetch<{ deleted: boolean }>(`/conversations/${conversationId}`, token, {
        method: "DELETE",
      }),
  },

  documents: {
    list: (token: string) =>
      apiFetch<Document[]>("/documents", token),

    get: (token: string, docId: string) =>
      apiFetch<Document>(`/documents/${docId}`, token),

    delete: (token: string, docId: string) =>
      apiFetch<{ deleted: boolean }>(`/documents/${docId}`, token, {
        method: "DELETE",
      }),

    deleteAll: (token: string) =>
      apiFetch<{ deleted: number; failed: number }>("/documents", token, {
        method: "DELETE",
      }),

    upload: async (
      token: string,
      file: File,
      tags: string[] = []
    ): Promise<Document> => {
      const form = new FormData();
      form.append("file", file);
      if (tags.length > 0) form.append("tags", tags.join(","));

      const res = await fetch("/api/backend/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed: HTTP ${res.status}`);
      }

      return res.json();
    },
  },

  usage: {
    summary: (token: string) =>
      apiFetch<UsageSummary>("/usage", token),
  },

  /**
   * Stream a chat query via SSE.
   * Calls onToken for each token, onCitation for each citation,
   * onDone when complete, onError on failure.
   */
  chat: {
    stream: async (
      token: string,
      payload: {
        message: string;
        model: string;
        conversation_id?: string | null;
        document_filter?: string[] | null;
      },
      callbacks: {
        onToken: (t: string) => void;
        onCitation: (c: Citation) => void;
        onDone: (messageId: string, stats: Record<string, unknown>) => void;
        onError: (detail: string) => void;
        onConversationId?: (id: string) => void;
      }
    ): Promise<void> => {
      const res = await fetch("/api/backend/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        callbacks.onError(data.detail || `HTTP ${res.status}`);
        return;
      }

      // Surface conversation ID from header (new conversation case)
      const convId = res.headers.get("X-Conversation-Id");
      if (convId && callbacks.onConversationId) {
        callbacks.onConversationId(convId);
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") return;

          try {
            const event: SSEEvent = JSON.parse(raw);
            if (event.type === "token") callbacks.onToken(event.content);
            else if (event.type === "citation") callbacks.onCitation(event.citation);
            else if (event.type === "done") callbacks.onDone(event.message_id, event.stats);
            else if (event.type === "error") callbacks.onError(event.detail);
          } catch {
            // Malformed line, skip
          }
        }
      }
    },
  },
};
