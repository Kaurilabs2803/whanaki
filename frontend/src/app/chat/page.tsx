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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
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
      } catch (e) { console.error(e); }
    })();
  }, [getToken]);

  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    setLoadingMsgs(true);
    (async () => {
      try {
        const token = await getToken();
        const msgs = await api.conversations.messages(token, activeConvId);
        setMessages(msgs.map((m) => ({ ...m, isStreaming: false })));
      } catch { setError("Failed to load messages."); }
      finally { setLoadingMsgs(false); }
    })();
  }, [activeConvId, getToken]);

  const startNew = useCallback(() => { setActiveConvId(null); setMessages([]); setError(""); setPanelCitations([]); }, []);

  const handleDelete = useCallback(async (id: string) => {
    const token = await getToken();
    await api.conversations.delete(token, id);
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (activeConvId === id) startNew();
  }, [activeConvId, getToken, startNew]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput(""); setError(""); setIsStreaming(true);
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: "user", content: text, citations: [] },
      { id: STREAM_ID, role: "assistant", content: "", citations: [], isStreaming: true },
    ]);
    try {
      const token = await getToken();
      await api.chat.stream(token, { message: text, model: selectedModel, conversation_id: activeConvId }, {
        onConversationId: (id) => { setActiveConvId(id); api.conversations.list(token).then(setConversations).catch(() => {}); },
        onToken: (t) => setMessages((prev) => prev.map((m) => m.id === STREAM_ID ? { ...m, content: m.content + t } : m)),
        onCitation: (c) => setMessages((prev) => prev.map((m) => m.id === STREAM_ID ? { ...m, citations: [...m.citations, c] } : m)),
        onDone: (msgId, stats) => {
          setMessages((prev) => prev.map((m) => m.id === STREAM_ID ? { ...m, id: msgId, isStreaming: false, model_used: stats.model as string, generation_ms: stats.generation_ms as number } : m));
          setIsStreaming(false);
        },
        onError: (detail) => { setError(detail); setMessages((prev) => prev.filter((m) => m.id !== STREAM_ID)); setIsStreaming(false); },
      });
    } catch (e: any) { setError(e.message ?? "Something went wrong."); setMessages((prev) => prev.filter((m) => m.id !== STREAM_ID)); setIsStreaming(false); }
  }, [input, isStreaming, selectedModel, activeConvId, getToken]);

  return (
    <AppShell>
      <div className="flex flex-1 min-h-0">
        <div className="w-52 shrink-0 border-r border-gray-100 bg-white overflow-hidden flex flex-col">
          <ConversationList conversations={conversations} activeId={activeConvId} onSelect={setActiveConvId} onNew={startNew} onDelete={handleDelete} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col bg-gray-50">
          <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
            <p className="text-sm text-gray-500 truncate">
              {activeConvId ? (conversations.find((c) => c.id === activeConvId)?.title ?? "Conversation") : "New conversation"}
            </p>
            {models.length > 0 && <ModelSelector models={models} selected={selectedModel} onChange={setSelectedModel} disabled={isStreaming} compact />}
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            {loadingMsgs && <Spinner className="py-20" />}
            {!loadingMsgs && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="w-14 h-14 bg-[#e1f5ee] rounded-2xl flex items-center justify-center mb-4">
                  <Shield className="w-7 h-7 text-[#0f6e56]" />
                </div>
                <h2 className="font-semibold text-gray-900 mb-1.5">Ask about your documents</h2>
                <p className="text-sm text-gray-400 max-w-sm leading-relaxed">Upload NZ legal documents, then ask questions. Every answer cites its exact source.</p>
                {models.length > 0 && <div className="mt-5"><ModelSelector models={models} selected={selectedModel} onChange={setSelectedModel} disabled={false} /></div>}
              </div>
            )}
            {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            {error && <div className="px-4 pt-2"><Alert variant="error" onDismiss={() => setError("")}>{error}</Alert></div>}
            <div ref={bottomRef} />
          </div>
          <ChatInput value={input} onChange={setInput} onSend={sendMessage} disabled={isStreaming} />
        </div>
        <CitationPanel citations={panelCitations} />
      </div>
    </AppShell>
  );
}
