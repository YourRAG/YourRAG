"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2,
  MessageSquare,
  Bot,
  User,
  FileText,
  Tag,
  Settings,
  Sliders,
  Zap,
  History,
  Cpu,
  AlignLeft,
  Key,
  Brain,
  ChevronDown,
  ChevronUp,
  Database,
  FolderOpen,
  Copy,
  Check
} from "lucide-react";
import { RAGMessage, SearchResult, DocumentGroup } from "../types";
import Markdown from "./Markdown";
import { AlertModal } from "./Modal";

export default function AskTab() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<RAGMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [showSources, setShowSources] = useState<number | null>(null);
  const [showReasoning, setShowReasoning] = useState<number | null>(null);
  
  // Configuration States
  const [models, setModels] = useState<{ id: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [useHistory, setUseHistory] = useState(true); // Default to true
  const [temperature, setTemperature] = useState(0.7);
  const [topK, setTopK] = useState(5);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [origin, setOrigin] = useState("");
  
  // API Key State
  const [apiKeys, setApiKeys] = useState<{ id: number; key: string; name: string }[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showAuthAlert, setShowAuthAlert] = useState(false);

  // Document Group State
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(""); // Empty string = all docs

  // Clipboard state
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch models, API keys, and groups on mount
  useEffect(() => {
    setOrigin(window.location.origin);
    const fetchModels = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/v1/models`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setModels(data.data || []);
          if (data.data && data.data.length > 0) {
            setSelectedModel(data.data[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch models", e);
      }
    };

    const fetchApiKeys = async () => {
      setLoadingKeys(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/user/apikeys`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setApiKeys(data);
          if (data.length > 0) {
            setSelectedApiKey(data[0].key);
          }
        }
      } catch (e) {
        console.error("Failed to fetch API keys", e);
      } finally {
        setLoadingKeys(false);
      }
    };

    const fetchGroups = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
        }
      } catch (e) {
        console.error("Failed to fetch groups", e);
      }
    };

    fetchModels();
    fetchApiKeys();
    fetchGroups();
  }, []);

  // Compute the effective model name with group suffix
  const effectiveModel = selectedGroup
    ? `${selectedModel}-${selectedGroup}`
    : selectedModel;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isAsking) return;

    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }

    const userMessage: RAGMessage = { role: "user", content: query };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setQuery("");
    setIsAsking(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`
        },
        // credentials: "include", // Removed credentials include as we are using Bearer token
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
          model: effectiveModel || undefined,
          use_history: useHistory,
          temperature: temperature,
          top_k: topK,
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) throw new Error("RAG query failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantMessage: RAGMessage = {
        role: "assistant",
        content: "",
        reasoning: "",
        sources: [],
      };
      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;

            try {
              const data = JSON.parse(dataStr);
              // Handle custom sources extension
              if (data.sources) {
                assistantMessage = { ...assistantMessage, sources: data.sources };
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = assistantMessage;
                  return newMessages;
                });
              }

              // Handle reasoning content (thinking models like QwQ, DeepSeek-R1)
              // Support both field names: reasoning_content and reasoning
              const reasoningDelta = data.choices?.[0]?.delta?.reasoning_content || data.choices?.[0]?.delta?.reasoning;
              if (reasoningDelta) {
                assistantMessage = {
                  ...assistantMessage,
                  reasoning: (assistantMessage.reasoning || "") + reasoningDelta,
                };
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = assistantMessage;
                  return newMessages;
                });
              }

              // Handle OpenAI compatible content delta
              if (data.choices && data.choices[0]?.delta?.content) {
                assistantMessage = {
                  ...assistantMessage,
                  content: assistantMessage.content + data.choices[0].delta.content,
                };
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = assistantMessage;
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          role: "assistant",
          content:
            "Sorry, an error occurred while processing your question. Please make sure the backend is running.",
        };
        return newMessages;
      });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-10rem)] sm:h-[calc(100vh-12rem)] max-w-7xl mx-auto gap-6 relative">
      {/* Mobile Settings Toggle */}
      <div className="lg:hidden mb-4 flex justify-end">
        <button
          onClick={() => setShowMobileSettings(!showMobileSettings)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm"
        >
          <Settings className="w-4 h-4" />
          {showMobileSettings ? "Hide Settings" : "Show Settings"}
        </button>
      </div>

      {/* Left Sidebar - Configuration Panel */}
      <div className={`
        lg:block lg:w-80 flex-shrink-0 flex flex-col gap-6 p-5 bg-slate-50 rounded-xl border border-slate-200 overflow-y-auto
        ${showMobileSettings ? 'block absolute inset-0 z-20 h-full shadow-xl' : 'hidden'}
        lg:static lg:h-full
      `}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <h3 className="font-semibold text-slate-900">Configuration</h3>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setShowMobileSettings(false)}
            className="lg:hidden p-1 hover:bg-slate-200 rounded-full"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* API Key Selection */}
        <div className="space-y-3 mb-6 mt-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Key className="w-4 h-4 text-yellow-600" />
            API Key
          </label>
          {loadingKeys ? (
            <div className="text-xs text-slate-500">Loading keys...</div>
          ) : apiKeys.length > 0 ? (
            <div className="relative">
              <select
                value={selectedApiKey}
                onChange={(e) => setSelectedApiKey(e.target.value)}
                className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8"
              >
                {apiKeys.map((key) => (
                  <option key={key.id} value={key.key}>
                    {key.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
              <p className="mb-2">No API keys found.</p>
              <a
                href="/?tab=profile"
                className="text-blue-600 hover:underline font-medium flex items-center gap-1"
              >
                Create one in Profile <Settings className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Cpu className="w-4 h-4 text-blue-600" />
            Model
          </label>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8"
            >
              {models.length > 0 ? (
                models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.id}
                  </option>
                ))
              ) : (
                <option value="">Loading models...</option>
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>

        {/* Document Group Selection */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <FolderOpen className="w-4 h-4 text-green-600" />
            Document Scope
          </label>
          <div className="relative">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8"
            >
              <option value="">All Documents</option>
              {groups.map((group) => (
                <option key={group.id} value={group.name}>
                  {group.name} ({group.documentCount})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
          {selectedGroup && (
            <p className="text-[10px] text-green-600 leading-tight flex items-center gap-1">
              <Database className="w-3 h-3" />
              RAG will search only in &quot;{selectedGroup}&quot; group
            </p>
          )}
        </div>

        {/* Context Settings */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <History className="w-4 h-4 text-purple-600" />
            Context
          </label>
          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <div className="relative flex items-center pt-0.5">
                <input
                  type="checkbox"
                  checked={useHistory}
                  onChange={(e) => setUseHistory(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">Use History</span>
                <span className="text-xs text-slate-500 leading-tight mt-1">
                  Include recent conversation history in vector search context
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-6 pt-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 border-t border-slate-200 pt-4">
            <Sliders className="w-4 h-4 text-orange-600" />
            Parameters
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Temperature</span>
              <span className="font-medium text-slate-900">{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-[10px] text-slate-400">
              Higher values make output more random, lower values more deterministic.
            </p>
          </div>

          {/* Top K */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Top K (Retrieval)</span>
              <span className="font-medium text-slate-900">{topK}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <p className="text-[10px] text-slate-400">
              Number of relevant document chunks to retrieve.
            </p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Max Tokens</span>
              <span className="font-medium text-slate-900">{maxTokens}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlignLeft className="w-4 h-4 text-slate-400" />
              <input
                type="number"
                min="1"
                max="32000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* API Usage - Styled like SearchTab cURL Request */}
        <div className="mt-auto pt-6 border-t border-slate-200">
          <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
              <div className="text-xs font-medium text-slate-400">
                cURL Request
              </div>
              <button
                onClick={() => copyToClipboard(`curl -X POST "${origin}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "model": "${effectiveModel || 'default'}",
    "messages": [{"role": "user", "content": "Your question"}],
    "stream": true
  }'`)}
                className="text-slate-500 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-blue-400 whitespace-pre">
                <span className="text-purple-400">curl</span>{" "}
                <span className="text-blue-300">-X</span>{" "}
                <span className="text-yellow-400">POST</span>{" "}
                <span className="text-green-400">&quot;{origin}/v1/chat/completions&quot;</span>{" "}
                \{"\n"}
                {"  "}<span className="text-blue-300">-H</span>{" "}
                <span className="text-green-400">&quot;Content-Type: application/json&quot;</span>{" "}
                \{"\n"}
                {"  "}<span className="text-blue-300">-H</span>{" "}
                <span className="text-green-400">&quot;Authorization: Bearer {selectedApiKey ? selectedApiKey.slice(0, 12) + "..." : "YOUR_API_KEY"}&quot;</span>{" "}
                \{"\n"}
                {"  "}<span className="text-blue-300">-d</span>{" "}
                <span className="text-green-400">&apos;{"{"}{"\n"}</span>
                <span className="text-green-400">{"    "}&quot;model&quot;: &quot;{effectiveModel || "default"}&quot;,{"\n"}</span>
                <span className="text-green-400">{"    "}&quot;messages&quot;: [{"{"}&quot;role&quot;: &quot;user&quot;, &quot;content&quot;: &quot;...&quot;{"}"}],{"\n"}</span>
                <span className="text-green-400">{"    "}&quot;stream&quot;: true{"\n"}</span>
                <span className="text-green-400">{"  "}{"}"}&apos;</span>
              </pre>
            </div>
            <div className="px-4 py-2 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500 space-y-1">
              <div>
                <span className="font-mono text-green-400">model</span>: Use{" "}
                <span className="font-mono text-slate-400">{selectedModel || "model"}-GroupName</span>{" "}
                to filter by group
              </div>
              <div>
                If group not found, automatically falls back to all documents
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Area - Chat Interface */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                RAG Assistant
              </h2>
              <p className="text-slate-500 max-w-md mx-auto leading-relaxed mb-4">
                Configure your search parameters on the left, then ask questions about your knowledge base.
                I&apos;ll retrieve relevant documents and generate answers based on your settings.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4 max-w-lg w-full text-left">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Tag className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                  Group Filtering
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-600 mb-2 sm:mb-3">
                  Add group name to model to filter documents:
                </p>
                <div className="space-y-1.5 sm:space-y-2 text-[10px] sm:text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono text-[10px] sm:text-xs">model</code>
                    <span className="text-slate-500">Search all documents</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono text-[10px] sm:text-xs">model-GroupName</code>
                    <span className="text-slate-500">Search only that group</span>
                  </div>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-2 sm:mt-3">
                  If group doesn&apos;t exist, falls back to all documents.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mt-1">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700 shadow-sm"
                    }`}
                  >
                    <div className="text-sm leading-relaxed">
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <>
                          {/* Show reasoning/thinking content if available */}
                          {msg.reasoning && (
                            <div className="mb-3">
                              <button
                                onClick={() => setShowReasoning(showReasoning === idx ? null : idx)}
                                className="flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 mb-2 transition-colors"
                              >
                                <Brain className="w-3.5 h-3.5" />
                                {showReasoning === idx ? "Hide Thinking" : "Show Thinking"}
                                {showReasoning === idx ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                              {showReasoning === idx && (
                                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                  <Markdown content={msg.reasoning} />
                                </div>
                              )}
                            </div>
                          )}
                          {/* Show thinking status when only reasoning is streaming */}
                          {isAsking && idx === messages.length - 1 && msg.reasoning && !msg.content && (
                            <div className="flex items-center gap-2 text-purple-600 mb-2">
                              <Brain className="w-4 h-4 animate-pulse" />
                              <span className="text-xs">Thinking...</span>
                            </div>
                          )}
                          <Markdown
                            content={
                              msg.content ||
                              (isAsking && idx === messages.length - 1 && !msg.reasoning
                                ? "Thinking..."
                                : "")
                            }
                          />
                        </>
                      )}
                    </div>
                  </div>
                  {msg.role === "assistant" &&
                    msg.sources &&
                    msg.sources.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() =>
                            setShowSources(showSources === idx ? null : idx)
                          }
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          {showSources === idx ? "Hide Sources" : "View Sources"}
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px]">
                            {msg.sources.length}
                          </span>
                        </button>
                        {showSources === idx && (
                          <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            {msg.sources.map((source: SearchResult, sIdx: number) => (
                              <div
                                key={sIdx}
                                className="text-xs bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-blue-200 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  {!!source.metadata?.category && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                                      <Tag className="w-2.5 h-2.5" />
                                      {String(source.metadata.category)}
                                    </span>
                                  )}
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    Dist: {source.distance.toFixed(4)}
                                  </span>
                                </div>
                                <p className="text-slate-600 line-clamp-3 leading-relaxed">
                                  {source.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center order-2 mt-1">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="flex-1 px-4 py-2 bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none"
              disabled={isAsking}
            />
            <button
              type="submit"
              disabled={isAsking || !query.trim()}
              className="flex-shrink-0 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium transition-all shadow-sm"
            >
              {isAsking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5 fill-current" />
              )}
            </button>
          </form>
        </div>
      </div>
      <AlertModal
        isOpen={showAuthAlert}
        onClose={() => setShowAuthAlert(false)}
        title="API Key Required"
        message="Please select an API Key to continue. If you don't have one, please create one in your Profile."
        variant="info"
      />
    </div>
  );
}