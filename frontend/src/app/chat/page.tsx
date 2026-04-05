"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { ConversationList } from "@/components/chat/ConversationList";
import { MessageBubble, type LocalMessage } from "@/components/chat/MessageBubble";
import { CitationPanel } from "@/components/chat/CitationPanel";
import { ChatInput } from "@/components/chat/ChatInput";
import { Spinner, Alert } from "@/components/ui";
import { useToken } from "@/hooks/useToken";
import { api, type Conversation, type ModelOption, type Citation } from "@/lib/api";

export default function ChatPage() {
  const { getToken } = useToken();
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("llama3.1:8b");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [panelCitations, setPanelCitations] = useState<Citation[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const STREAM_ID = "streaming-assistant";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "assistant" && !m.isStreaming);
    setPanelCitations(last?.citations ?? []);
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const [ms, cs] = await Promise.all([api.models.list(token), api.conversations.list(token)]);
        setModels(ms);
        const def = ms.find((m) => m.is_default);
        if (def) setSelectedModel(def.model_id);
        setConversations(cs);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [getToken]);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    setLoadingMsgs(true);
    (async () => {
      try {
        const token = await getToken();
        const msgs = await api.conversations.messages(token, activeConvId);
        setMessages(msgs.map((m) => ({ ...m, isStreaming: false })));
      } catch {
        setError("Failed to load messages.");
      } finally {
        setLoadingMsgs(false);
      }
    })();
  }, [activeConvId, getToken]);

  const startNew = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    setError("");
    setPanelCitations([]);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const token = await getToken();
    await api.conversations.delete(token, id);
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeConvId === id) startNew();
  }, [activeConvId, getToken, startNew]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setError("");
    setIsStreaming(true);
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: "user", content: text, citations: [] },
      { id: STREAM_ID, role: "assistant", content: "", citations: [], isStreaming: true },
    ]);

    try {
      const token = await getToken();
      await api.chat.stream(token, { message: text, model: selectedModel, conversation_id: activeConvId }, {
        onConversationId: (id) => {
          setActiveConvId(id);
          api.conversations.list(token).then(setConversations).catch(() => {});
        },
        onToken: (t) =>
          setMessages((prev) => prev.map((m) => (m.id === STREAM_ID ? { ...m, content: m.content + t } : m))),
        onCitation: (c) =>
          setMessages((prev) => prev.map((m) => (m.id === STREAM_ID ? { ...m, citations: [...m.citations, c] } : m))),
        onDone: (msgId, stats) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === STREAM_ID
                ? {
                    ...m,
                    id: msgId,
                    isStreaming: false,
                    model_used: stats.model as string,
                    generation_ms: stats.generation_ms as number,
                  }
                : m
            )
          );
          setIsStreaming(false);
        },
        onError: (detail) => {
          setError(detail);
          setMessages((prev) => prev.filter((m) => m.id !== STREAM_ID));
          setIsStreaming(false);
        },
      });
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== STREAM_ID));
      setIsStreaming(false);
    }
  }, [input, isStreaming, selectedModel, activeConvId, getToken]);

  return (
    <AppShell>
      <div className="flex h-full min-h-0">
        <div className="surface-panel flex w-72 shrink-0 flex-col border-r border-[var(--border)]">
          <ConversationList
            conversations={conversations}
            activeId={activeConvId}
            onSelect={setActiveConvId}
            onNew={startNew}
            onDelete={handleDelete}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-[rgba(248,245,240,0.45)]">
          <div className="surface-panel border-b px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">Conversation</p>
                <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  {activeConvId
                    ? (conversations.find((c) => c.id === activeConvId)?.title ?? "Conversation")
                    : "New conversation"}
                </p>
              </div>
              {models.length > 0 && (
                <ModelSelector
                  models={models}
                  selected={selectedModel}
                  onChange={setSelectedModel}
                  disabled={isStreaming}
                  compact
                />
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-5">
            {loadingMsgs && <Spinner className="py-20" />}
            {!loadingMsgs && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-[rgba(200,230,201,0.62)] text-[var(--primary)] shadow-soft">
                  <Shield className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-bold text-[var(--foreground)]">Ask across your document set</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">
                  This workspace is tuned for cited, document grounded answers. Upload materials, choose a model,
                  and keep the source trail visible while you work.
                </p>
                {models.length > 0 && (
                  <div className="mt-6">
                    <ModelSelector models={models} selected={selectedModel} onChange={setSelectedModel} disabled={false} />
                  </div>
                )}
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {error && (
              <div className="px-5 pt-2">
                <Alert variant="error" onDismiss={() => setError("")}>
                  {error}
                </Alert>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <ChatInput value={input} onChange={setInput} onSend={sendMessage} disabled={isStreaming} />
        </div>

        <CitationPanel citations={panelCitations} />
      </div>
    </AppShell>
  );
}
