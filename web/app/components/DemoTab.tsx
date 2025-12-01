"use client";

import { useState, useRef, useEffect } from "react";
import {
  Loader2,
  FileText,
  Search,
  MessageSquare,
  ChevronRight,
  CheckCircle2,
  Play,
  Copy,
  Key,
  Sparkles,
  ArrowRight,
  Bot,
  User,
} from "lucide-react";
import Markdown from "./Markdown";
import { AlertModal } from "./Modal";

interface StepStatus {
  completed: boolean;
  loading: boolean;
  result?: unknown;
  error?: string;
}

interface SearchResultItem {
  id: number;
  content: string;
  metadata: Record<string, unknown>;
  distance: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function DemoTab() {
  const [origin, setOrigin] = useState("");
  
  // API Key state
  const [apiKeys, setApiKeys] = useState<{ id: number; key: string; name: string }[]>([]);
  const [selectedApiKey, setSelectedApiKey] = useState<string>("");
  const [loadingKeys, setLoadingKeys] = useState(false);
  
  // Step 1: Add Document
  const [documentContent, setDocumentContent] = useState(
    "Artificial Intelligence (AI) is transforming the way we interact with technology. Machine Learning, a subset of AI, enables computers to learn from data without being explicitly programmed. Deep Learning, using neural networks with many layers, has achieved remarkable results in image recognition, natural language processing, and more."
  );
  const [documentGroupName, setDocumentGroupName] = useState("AI Knowledge");
  const [documentCategory, setDocumentCategory] = useState("technology");
  const [documentSource, setDocumentSource] = useState("demo");
  const [step1Status, setStep1Status] = useState<StepStatus>({ completed: false, loading: false });
  
  // Step 2: Search
  const [searchQuery, setSearchQuery] = useState("What is machine learning?");
  const [searchGroupName, setSearchGroupName] = useState("");
  const [step2Status, setStep2Status] = useState<StepStatus>({ completed: false, loading: false });
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  
  // Step 3: Chat
  const [chatQuery, setChatQuery] = useState("Explain AI in simple terms");
  const [step3Status, setStep3Status] = useState<StepStatus>({ completed: false, loading: false });
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [showAuthAlert, setShowAuthAlert] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    
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

    fetchApiKeys();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Step 1: Add Document
  const handleAddDocument = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    setStep1Status({ completed: false, loading: true });
    
    try {
      // Build metadata object
      const metadata: Record<string, string> = {};
      if (documentGroupName.trim()) metadata.groupName = documentGroupName.trim();
      if (documentCategory.trim()) metadata.category = documentCategory.trim();
      if (documentSource.trim()) metadata.source = documentSource.trim();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({
          content: documentContent,
          metadata: metadata,
        }),
      });
      
      if (!res.ok) throw new Error("Failed to add document");
      
      const data = await res.json();
      setStep1Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep1Status({ 
        completed: false, 
        loading: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  };

  // Step 2: Search Documents
  const handleSearch = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    setStep2Status({ completed: false, loading: true });
    setSearchResults([]);
    
    try {
      let searchUrl = `${process.env.NEXT_PUBLIC_API_URL || ""}/search?query=${encodeURIComponent(searchQuery)}`;
      if (searchGroupName.trim()) {
        searchUrl += `&group_name=${encodeURIComponent(searchGroupName.trim())}`;
      }
      
      const res = await fetch(searchUrl, {
        headers: {
          "Authorization": `Bearer ${selectedApiKey}`,
        },
      });
      
      if (!res.ok) throw new Error("Search failed");
      
      const data = await res.json();
      setSearchResults(data.results || []);
      setStep2Status({ completed: true, loading: false, result: data });
    } catch (error) {
      setStep2Status({ 
        completed: false, 
        loading: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  };

  // Step 3: Chat Completion
  const handleChat = async () => {
    if (!selectedApiKey) {
      setShowAuthAlert(true);
      return;
    }
    
    const userMessage: Message = { role: "user", content: chatQuery };
    setMessages([userMessage]);
    setStep3Status({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedApiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: chatQuery }],
          stream: true,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
      
      if (!res.ok) throw new Error("Chat request failed");
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");
      
      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      
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
              if (data.choices?.[0]?.delta?.content) {
                assistantContent += data.choices[0].delta.content;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { role: "assistant", content: assistantContent };
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
      setStep3Status({ completed: true, loading: false });
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setStep3Status({ 
        completed: false, 
        loading: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  };

  const curlDocuments = `curl -X POST "${origin}/documents" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "content": "${documentContent.replace(/"/g, '\\"').slice(0, 50)}...",
    "metadata": {
      "groupName": "${documentGroupName}",
      "category": "${documentCategory}",
      "source": "${documentSource}"
    }
  }'`;

  const curlSearch = `curl -X GET "${origin}/search?query=${encodeURIComponent(searchQuery)}${searchGroupName.trim() ? `&group_name=${encodeURIComponent(searchGroupName.trim())}` : ''}" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}"`;

  const curlChat = `curl -X POST "${origin}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${selectedApiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "messages": [{"role": "user", "content": "${chatQuery}"}],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 1024
  }'`;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full border border-blue-100">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">Interactive Demo</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">RAG Workflow Demo</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Experience the complete RAG (Retrieval-Augmented Generation) workflow. 
          Follow the three steps below to add documents, search, and chat with your knowledge base.
        </p>
      </div>

      {/* API Key Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Key className="w-5 h-5 text-yellow-700" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">API Key</h3>
            <p className="text-sm text-slate-500">Select an API key to authenticate your requests</p>
          </div>
        </div>
        
        {loadingKeys ? (
          <div className="text-sm text-slate-500">Loading keys...</div>
        ) : apiKeys.length > 0 ? (
          <select
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
            className="w-full max-w-md bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-3"
          >
            {apiKeys.map((key) => (
              <option key={key.id} value={key.key}>
                {key.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-slate-500 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
            No API keys found. Please create one in your Profile.
          </div>
        )}
      </div>

      {/* Workflow Steps */}
      <div className="space-y-6">
        {/* Step 1: Add Document */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step1Status.completed ? "bg-green-100" : "bg-blue-100"
              }`}>
                {step1Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-blue-600">1</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Add Document</h3>
                </div>
                <p className="text-sm text-slate-500">Store content in your knowledge base with vector embeddings</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                POST /documents
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Document Content</label>
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Enter your document content..."
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Folder <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={documentGroupName}
                  onChange={(e) => setDocumentGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AI Knowledge"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category <span className="text-slate-400 font-normal">(tag)</span>
                </label>
                <input
                  type="text"
                  value={documentCategory}
                  onChange={(e) => setDocumentCategory(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., technology"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Source <span className="text-slate-400 font-normal">(tag)</span>
                </label>
                <input
                  type="text"
                  value={documentSource}
                  onChange={(e) => setDocumentSource(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., demo"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleAddDocument}
                disabled={step1Status.loading || !documentContent.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step1Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlDocuments}
              </pre>
              <button
                onClick={() => copyToClipboard(curlDocuments)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Result */}
            {step1Status.completed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Document Added Successfully</span>
                </div>
                <pre className="text-xs text-green-800 font-mono">
                  {JSON.stringify(step1Status.result, null, 2)}
                </pre>
              </div>
            )}
            
            {step1Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step1Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 2: Search */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step2Status.completed ? "bg-green-100" : "bg-purple-100"
              }`}>
                {step2Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-purple-600">2</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Search Documents</h3>
                </div>
                <p className="text-sm text-slate-500">Use semantic search to find relevant documents</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                GET /search
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Search Query</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your search query..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Folder <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={searchGroupName}
                  onChange={(e) => setSearchGroupName(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., AI Knowledge"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleSearch}
                disabled={step2Status.loading || !searchQuery.trim()}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step2Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlSearch}
              </pre>
              <button
                onClick={() => copyToClipboard(curlSearch)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium">Found {searchResults.length} result(s)</span>
                </div>
                {searchResults.map((result, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">
                        Distance: {result.distance.toFixed(4)}
                      </span>
                      {result.metadata?.category && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {String(result.metadata.category)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-3">{result.content}</p>
                  </div>
                ))}
              </div>
            )}
            
            {step2Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step2Status.error}
              </div>
            )}
          </div>
          
          {/* Arrow Connector */}
          <div className="flex justify-center py-2 bg-slate-50">
            <ChevronRight className="w-6 h-6 text-slate-400 rotate-90" />
          </div>
        </div>

        {/* Step 3: Chat */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step3Status.completed ? "bg-green-100" : "bg-green-100"
              }`}>
                {step3Status.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-lg font-bold text-green-600">3</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-slate-900">Chat with RAG</h3>
                </div>
                <p className="text-sm text-slate-500">Ask questions and get AI-powered answers from your documents</p>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                POST /v1/chat/completions
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Your Question</label>
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ask a question..."
                />
              </div>
              
              <button
                onClick={handleChat}
                disabled={step3Status.loading || !chatQuery.trim()}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all shadow-sm"
              >
                {step3Status.loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            
            {/* cURL Example */}
            <div className="bg-slate-900 rounded-lg p-4 group relative">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                {curlChat}
              </pre>
              <button
                onClick={() => copyToClipboard(curlChat)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy to clipboard"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4 max-h-80 overflow-y-auto">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-700"
                    }`}>
                      <div className="text-sm">
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        ) : (
                          <Markdown content={msg.content || (step3Status.loading ? "Thinking..." : "")} />
                        )}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
            
            {step3Status.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                Error: {step3Status.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Workflow Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          Complete Workflow
        </h3>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Add Documents</span>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Search className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">Semantic Search</span>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 hidden sm:block" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">RAG Chat</span>
          </div>
        </div>
        <p className="text-center text-sm text-slate-500 mt-4">
          Your documents are vectorized, searched semantically, and used to generate contextual AI responses.
        </p>
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