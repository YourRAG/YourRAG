"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Loader2, Plus, Split, FileText, CheckCircle2, AlertCircle, Upload, Code, Copy, Check, Folder, FolderPlus, ChevronDown, Tag, Link as LinkIcon, FileUp, PanelLeftClose, PanelLeft, Sparkles } from "lucide-react";
import DocumentPreviewPanel from "./DocumentPreviewPanel";

interface DocumentGroup {
  id: number;
  name: string;
  documentCount: number;
}

export default function AddDocumentTab() {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isChunking, setIsChunking] = useState(false);
  const [message, setMessage] = useState("");
  const [showCurl, setShowCurl] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Group selection
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  
  // Optional metadata (collapsible)
  const [showOptionalMeta, setShowOptionalMeta] = useState(false);
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  
  // Preview panel state
  const [showPreviewPanel, setShowPreviewPanel] = useState(true);
  const [activeDocIndex, setActiveDocIndex] = useState<number | undefined>(undefined);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch groups on mount
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
        }
      } catch (error) {
        console.error("Failed to fetch groups:", error);
      }
    };
    fetchGroups();
  }, []);

  const docs = useMemo(() => {
    return content
      .split("--------")
      .map((doc) => doc.trim())
      .filter((doc) => doc.length > 0);
  }, [content]);

  const docCount = docs.length;

  // Check if we should show enhanced layout (large content or multiple docs)
  const shouldShowEnhancedLayout = useMemo(() => {
    return content.length > 1000 || docCount > 1;
  }, [content.length, docCount]);

  // Handle document click from preview panel
  const handleDocumentClick = useCallback((index: number, startPos: number) => {
    setActiveDocIndex(index);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(startPos, startPos);
      
      // Calculate scroll position
      const lineHeight = 20; // approximate line height
      const charsPerLine = 80; // approximate chars per line
      const lineNumber = Math.floor(startPos / charsPerLine);
      const scrollTop = lineNumber * lineHeight;
      
      textareaRef.current.scrollTop = Math.max(0, scrollTop - 100);
      if (backdropRef.current) {
        backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    }
  }, []);

  // Update active doc index based on cursor position
  const updateActiveDocFromCursor = useCallback(() => {
    if (!textareaRef.current) return;
    
    const cursorPos = textareaRef.current.selectionStart;
    const parts = content.split("--------");
    let currentPos = 0;
    let docIndex = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const endPos = currentPos + part.length;
      
      if (part.trim().length > 0) {
        if (cursorPos >= currentPos && cursorPos <= endPos) {
          setActiveDocIndex(docIndex);
          return;
        }
        docIndex++;
      }
      
      currentPos = endPos + 8; // 8 is length of "--------"
    }
  }, [content]);

  // Handle chunking a single document
  const handleChunkDocument = useCallback((docIndex: number, chunks: string[]) => {
    if (chunks.length <= 1) return;
    
    const separator = "\n\n--------\n\n";
    const parts = content.split("--------");
    const docs: { content: string; index: number }[] = [];
    
    parts.forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        docs.push({ content: trimmed, index: docs.length });
      }
    });
    
    if (docIndex >= docs.length) return;
    
    // Replace the document at docIndex with chunked versions
    const newDocs = [...docs];
    newDocs.splice(docIndex, 1, ...chunks.map((c, i) => ({ content: c.trim(), index: docIndex + i })));
    
    const newContent = newDocs.map(d => d.content).join(separator);
    setContent(newContent);
    setMessage(`Document split into ${chunks.length} chunks`);
    setTimeout(() => setMessage(""), 3000);
  }, [content]);

  // Handle chunking all documents
  const handleChunkAll = useCallback((allChunks: string[]) => {
    if (allChunks.length === 0) return;
    
    const separator = "\n\n--------\n\n";
    const newContent = allChunks.map(c => c.trim()).filter(c => c.length > 0).join(separator);
    setContent(newContent);
    setMessage(`All documents split into ${allChunks.length} chunks`);
    setTimeout(() => setMessage(""), 3000);
  }, []);

  // Smart chunk the entire content directly
  const handleSmartChunk = async () => {
    if (!content.trim() || isChunking) return;
    
    setIsChunking(true);
    setMessage("Analyzing document structure...");
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents/smart-chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: content.trim() }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to chunk document");
      }
      
      const data = await res.json();
      if (data.chunks && data.chunks.length > 1) {
        const separator = "\n\n--------\n\n";
        const newContent = data.chunks.map((c: string) => c.trim()).filter((c: string) => c.length > 0).join(separator);
        setContent(newContent);
        setMessage(`Content split into ${data.chunks.length} chunks`);
      } else {
        setMessage("Content is already well-structured");
      }
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Chunking error:", error);
      setMessage("Error: Failed to analyze document");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setIsChunking(false);
    }
  };

  const insertSeparator = () => {
    setContent((prev) => {
      const separator = "\n\n--------\n\n";
      return prev + separator;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setContent((prev) => {
          const separator = "\n\n--------\n\n";
          return prev.trim() ? prev + separator + text : text;
        });
        setMessage("Markdown file imported successfully!");
        setTimeout(() => setMessage(""), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setMessage("Parsing document...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents/parse`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to parse document");
      }

      const data = await res.json();
      
      if (data.content) {
        setContent((prev) => {
          const separator = "\n\n--------\n\n";
          return prev.trim() ? prev + separator + data.content : data.content;
        });
        setMessage(`${file.name} imported successfully! (${data.contentLength} chars)`);
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? `Error: ${error.message}` : "Error parsing document");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setIsParsing(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsAdding(true);
    setMessage("");

    // Split content by separator
    const docs = content
      .split("--------")
      .map((doc) => doc.trim())
      .filter((doc) => doc.length > 0);

    if (docs.length === 0) {
      setIsAdding(false);
      return;
    }

    try {
      let successCount = 0;
      
      // Prepare metadata with group info and optional fields
      const metadata: Record<string, unknown> = {};
      
      // Only include category/source if they have values
      if (category.trim()) {
        metadata.category = category.trim();
      }
      if (source.trim()) {
        metadata.source = source.trim();
      }
      
      // Add group info
      if (isCreatingNewGroup && newGroupName.trim()) {
        metadata.groupName = newGroupName.trim();
      } else if (selectedGroupId) {
        metadata.groupId = selectedGroupId;
      }
      
      for (let i = 0; i < docs.length; i++) {
        const docContent = docs[i];
        setMessage(`Adding document ${i + 1} of ${docs.length}...`);
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            content: docContent,
            metadata: metadata,
          }),
        });

        if (!res.ok) throw new Error(`Failed to add document ${i + 1}`);
        successCount++;
      }

      // Refresh groups if we created a new one
      if (isCreatingNewGroup && newGroupName.trim()) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setGroups(data);
        }
        setIsCreatingNewGroup(false);
        setNewGroupName("");
      }

      setMessage(
        docs.length > 1
          ? `Successfully added ${successCount} documents!`
          : "Document added successfully!"
      );
      setContent("");
      setCategory("");
      setSource("");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error adding documents.");
    } finally {
      setIsAdding(false);
    }
  };

  // Enhanced layout with preview panel
  if (shouldShowEnhancedLayout) {
    return (
      <div className="animate-fade-in h-[calc(100vh-12rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 border border-slate-200 border-b-0">
          <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Add New Document
                  </h2>
                  <p className="text-sm text-slate-500">
                    {docCount} document{docCount !== 1 ? "s" : ""} | {content.length.toLocaleString()} chars
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewPanel(!showPreviewPanel)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title={showPreviewPanel ? "Hide preview panel" : "Show preview panel"}
              >
                {showPreviewPanel ? (
                  <PanelLeftClose className="w-5 h-5" />
                ) : (
                  <PanelLeft className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0 bg-white rounded-b-2xl shadow-lg shadow-slate-200/50 border border-slate-200 border-t-0 overflow-hidden">
          {/* Preview Panel */}
          {showPreviewPanel && (
            <div className="w-80 xl:w-96 border-r border-slate-200 flex-shrink-0 bg-slate-50/30">
              <DocumentPreviewPanel
                content={content}
                onDocumentClick={handleDocumentClick}
                activeDocIndex={activeDocIndex}
                onChunkDocument={handleChunkDocument}
                onChunkAll={handleChunkAll}
              />
            </div>
          )}

          {/* Editor Panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-6 h-full flex flex-col">
                {/* Compact Folder Selection */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-600">Folder:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(null);
                      setIsCreatingNewGroup(false);
                      setNewGroupName("");
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      !selectedGroupId && !isCreatingNewGroup
                        ? "bg-blue-100 text-blue-700 border border-blue-300"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    None
                  </button>
                  
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setIsCreatingNewGroup(false);
                        setNewGroupName("");
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        selectedGroupId === group.id
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                      }`}
                    >
                      <Folder className="w-3.5 h-3.5" />
                      {group.name}
                    </button>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewGroup(true);
                      setSelectedGroupId(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      isCreatingNewGroup
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"
                    }`}
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New
                  </button>

                  {isCreatingNewGroup && (
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Folder name..."
                      className="px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-xs w-40"
                      autoFocus
                    />
                  )}
                </div>

                {/* Optional Tags - Compact */}
                <button
                  type="button"
                  onClick={() => setShowOptionalMeta(!showOptionalMeta)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-fit"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOptionalMeta ? 'rotate-180' : ''}`} />
                  <span className="font-medium">Optional Tags</span>
                </button>
                
                {showOptionalMeta && (
                  <div className="flex gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex-1">
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        <Tag className="w-3 h-3" />
                        Category
                      </label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g., Tutorial"
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
                        <LinkIcon className="w-3 h-3" />
                        Source
                      </label>
                      <input
                        type="text"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="e.g., docs.example.com"
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Content Editor - Takes remaining space */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Content <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        ref={docFileInputRef}
                        className="hidden"
                        onChange={handleDocumentFileUpload}
                      />
                      <button
                        type="button"
                        onClick={() => docFileInputRef.current?.click()}
                        disabled={isParsing}
                        className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50"
                        title="Import PDF/Word"
                      >
                        {isParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />}
                        <span className="hidden xs:inline">PDF/Word</span>
                        <span className="xs:hidden">PDF</span>
                      </button>
                      <input
                        type="file"
                        accept=".md,.markdown,.txt"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-700 font-medium px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                        title="Import MD/TXT"
                      >
                        <Upload className="w-3 h-3" />
                        <span className="hidden xs:inline">MD/TXT</span>
                        <span className="xs:hidden">TXT</span>
                      </button>
                      <button
                        type="button"
                        onClick={insertSeparator}
                        className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                        title="Insert Separator"
                      >
                        <Split className="w-3 h-3" />
                        <span className="hidden xs:inline">Separator</span>
                        <span className="xs:hidden">Sep</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSmartChunk}
                        disabled={isChunking || !content.trim()}
                        className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Smart Chunk: Use AI to split content into semantic segments"
                      >
                        {isChunking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        <span className="hidden xs:inline">Smart Chunk</span>
                        <span className="xs:hidden">AI</span>
                      </button>
                    </div>
                  </div>
                  <div className="relative flex-1 min-h-[200px]">
                    <div
                      ref={backdropRef}
                      className="absolute inset-0 px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none text-slate-900 overflow-hidden"
                      aria-hidden="true"
                    >
                      {content.split(/(--------)/g).map((part, index) => {
                        if (part === "--------") {
                          return (
                            <span
                              key={index}
                              className="inline-flex items-center justify-center w-[8ch] align-middle select-none"
                            >
                              <span className="w-full h-0.5 bg-slate-300 rounded-full" />
                            </span>
                          );
                        }
                        return <span key={index}>{part}</span>;
                      })}
                      {content.endsWith("\n") && <br />}
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onScroll={() => {
                        if (backdropRef.current && textareaRef.current) {
                          backdropRef.current.scrollTop = textareaRef.current.scrollTop;
                        }
                      }}
                      onClick={updateActiveDocFromCursor}
                      onKeyUp={updateActiveDocFromCursor}
                      className="absolute inset-0 w-full h-full px-4 py-3 bg-transparent border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-transparent placeholder:text-slate-400 font-mono text-sm leading-relaxed caret-slate-900 whitespace-pre-wrap break-words selection:bg-blue-500/30 selection:text-transparent"
                      placeholder="Enter the document content here..."
                      required
                    />
                  </div>
                </div>

                {/* Submit Button & Messages */}
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl"
                  >
                    {isAdding ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                    Add {docCount > 1 ? `${docCount} Documents` : "Document"}
                  </button>

                  {message && (
                    <div
                      className={`flex-1 p-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in ${
                        message.includes("Error")
                          ? "bg-red-50 text-red-700 border border-red-100"
                          : "bg-green-50 text-green-700 border border-green-100"
                      }`}
                    >
                      {message.includes("Error") ? (
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                      {message}
                    </div>
                  )}
                </div>

                {/* API Example - Collapsible */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCurl(!showCurl)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium"
                  >
                    <Code className="w-3.5 h-3.5" />
                    {showCurl ? "Hide API Example" : "Show API Example"}
                  </button>

                  {showCurl && (
                    <div className="mt-3 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
                        <div className="text-xs font-medium text-slate-400">cURL</div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`curl -X POST "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents" -H "Content-Type: application/json" -H "Authorization: Bearer rag-xxxxxxxxxxxx" -d '{"content": "Your content", "metadata": {"groupName": "Folder"}}'`)}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="p-3 overflow-x-auto">
                        <pre className="text-xs font-mono text-blue-400 whitespace-pre-wrap">
                          curl -X POST "{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents" \{'\n'}
                          {'  '}-H "Authorization: Bearer rag-xxxxxxxxxxxx" \{'\n'}
                          {'  '}-d {`'{"content": "...", "metadata": {"groupName": "..."}}'`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard layout for small content
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Add New Document
            </h2>
          </div>
          <p className="text-slate-500 ml-12">
            Add content to your knowledge base to make it searchable.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Folder Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Add to Folder <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGroupId(null);
                    setIsCreatingNewGroup(false);
                    setNewGroupName("");
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    !selectedGroupId && !isCreatingNewGroup
                      ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent"
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  No Folder
                </button>
                
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(group.id);
                      setIsCreatingNewGroup(false);
                      setNewGroupName("");
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedGroupId === group.id
                        ? "bg-blue-100 text-blue-700 border-2 border-blue-300"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent"
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    {group.name}
                  </button>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewGroup(true);
                    setSelectedGroupId(null);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    isCreatingNewGroup
                      ? "bg-green-100 text-green-700 border-2 border-green-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-transparent"
                  }`}
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </button>
              </div>
              
              {isCreatingNewGroup && (
                <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Enter folder name..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all text-sm"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Optional Tags - Collapsible */}
            <div>
              <button
                type="button"
                onClick={() => setShowOptionalMeta(!showOptionalMeta)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showOptionalMeta ? 'rotate-180' : ''}`} />
                <span className="font-medium">Optional Tags</span>
                <span className="text-xs text-slate-400">(for display only)</span>
              </button>
              
              {showOptionalMeta && (
                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs text-slate-500 mb-3">
                    These tags are for visual organization only and don&apos;t affect search functionality.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <Tag className="w-3 h-3" />
                        Category
                      </label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g., Tutorial, Reference"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <LinkIcon className="w-3 h-3" />
                        Source
                      </label>
                      <input
                        type="text"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        placeholder="e.g., docs.example.com"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Content <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    ref={docFileInputRef}
                    className="hidden"
                    onChange={handleDocumentFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    disabled={isParsing}
                    className="text-xs flex items-center gap-1 sm:gap-1.5 text-purple-600 hover:text-purple-700 font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Import content from PDF or Word document"
                  >
                    {isParsing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FileUp className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">{isParsing ? "Parsing..." : "Import PDF/Word"}</span>
                    <span className="sm:hidden">{isParsing ? "..." : "PDF"}</span>
                  </button>
                  <input
                    type="file"
                    accept=".md,.markdown,.txt"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1 sm:gap-1.5 text-slate-600 hover:text-slate-700 font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                    title="Import content from a Markdown or text file"
                  >
                    <Upload className="w-3 h-3" />
                    <span className="hidden sm:inline">Import MD/TXT</span>
                    <span className="sm:hidden">TXT</span>
                  </button>
                  <button
                    type="button"
                    onClick={insertSeparator}
                    className="text-xs flex items-center gap-1 sm:gap-1.5 text-blue-600 hover:text-blue-700 font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Insert separator to add multiple documents at once"
                  >
                    <Split className="w-3 h-3" />
                    <span className="hidden sm:inline">Insert Separator</span>
                    <span className="sm:hidden">Sep</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSmartChunk}
                    disabled={isChunking || !content.trim()}
                    className="text-xs flex items-center gap-1 sm:gap-1.5 text-amber-600 hover:text-amber-700 font-medium px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Smart Chunk: Use AI to intelligently split content into semantic segments"
                  >
                    {isChunking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span className="hidden sm:inline">Smart Chunk</span>
                    <span className="sm:hidden">AI</span>
                  </button>
                </div>
              </div>
              <div className="relative group">
                <div
                  ref={backdropRef}
                  className="absolute inset-0 px-4 py-3 bg-slate-50 border border-transparent rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none text-slate-900 overflow-hidden"
                  aria-hidden="true"
                >
                  {content.split(/(--------)/g).map((part, index) => {
                    if (part === "--------") {
                      return (
                        <span
                          key={index}
                          className="inline-flex items-center justify-center w-[8ch] align-middle select-none"
                        >
                          <span className="w-full h-0.5 bg-slate-300 rounded-full" />
                        </span>
                      );
                    }
                    return <span key={index}>{part}</span>;
                  })}
                  {content.endsWith("\n") && <br />}
                </div>
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onScroll={() => {
                    if (backdropRef.current && textareaRef.current) {
                      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
                    }
                  }}
                  rows={10}
                  className="relative w-full px-4 py-3 bg-transparent border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-y text-transparent placeholder:text-slate-400 font-mono text-sm leading-relaxed caret-slate-900 whitespace-pre-wrap break-words selection:bg-blue-500/30 selection:text-transparent"
                  placeholder="Enter the document content here..."
                  required
                />
                <div className="absolute bottom-3 right-3 text-xs text-slate-400 pointer-events-none z-20 flex items-center gap-3">
                  {docCount > 1 && (
                    <span className="text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-md">
                      {docCount} documents
                    </span>
                  )}
                  <span>{content.length} chars</span>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isAdding}
                className="w-full px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
              >
                {isAdding ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Add to Knowledge Base
              </button>
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl flex items-center justify-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${
                  message.includes("Error")
                    ? "bg-red-50 text-red-700 border border-red-100"
                    : "bg-green-50 text-green-700 border border-green-100"
                }`}
              >
                {message.includes("Error") ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {message}
              </div>
            )}

            <div className="pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCurl(!showCurl)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors font-medium"
              >
                <Code className="w-4 h-4" />
                {showCurl ? "Hide API Example" : "Show API Example"}
              </button>

              {showCurl && (
                <div className="mt-4 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-lg animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                    <div className="text-xs font-medium text-slate-400">cURL Request</div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`curl -X POST "${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer rag-xxxxxxxxxxxx" \\
  -d '{
    "content": "Your document content here",
    "metadata": {
      "groupName": "My Folder",
      "category": "Tutorial",
      "source": "docs.example.com"
    }
  }'`)}
                      className="text-slate-500 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <pre className="text-sm font-mono text-blue-400 whitespace-pre">
                      <span className="text-purple-400">curl</span> -X POST <span className="text-green-400">"{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/documents"</span> \{'\n'}
                      {'  '}-H <span className="text-green-400">"Content-Type: application/json"</span> \{'\n'}
                      {'  '}-H <span className="text-green-400">"Authorization: Bearer rag-xxxxxxxxxxxx"</span> \{'\n'}
                      {'  '}-d <span className="text-yellow-400">'{'{'}</span>
                      {'\n    '}<span className="text-orange-400">"content"</span>: <span className="text-green-400">"Your document content here"</span>,
                      {'\n    '}<span className="text-orange-400">"metadata"</span>: <span className="text-yellow-400">{'{'}</span>
                      {'\n      '}<span className="text-orange-400">"groupName"</span>: <span className="text-green-400">"My Folder"</span>,{' '}<span className="text-slate-500">// optional, creates if not exists</span>
                      {'\n      '}<span className="text-orange-400">"category"</span>: <span className="text-green-400">"Tutorial"</span>,{' '}<span className="text-slate-500">// optional, display tag</span>
                      {'\n      '}<span className="text-orange-400">"source"</span>: <span className="text-green-400">"docs.example.com"</span>{' '}<span className="text-slate-500">// optional, display tag</span>
                      {'\n    '}<span className="text-yellow-400">{'}'}</span>
                      {'\n  '}<span className="text-yellow-400">{'}'}'</span>
                    </pre>
                  </div>
                  <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500 space-y-2">
                    <div className="font-medium text-slate-400">Available metadata fields (all optional):</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      <div><span className="font-mono text-green-400">groupName</span> - Add to folder (creates if not exists)</div>
                      <div><span className="font-mono text-green-400">groupId</span> - Add to existing folder by ID</div>
                      <div><span className="font-mono text-green-400">category</span> - Display tag (green)</div>
                      <div><span className="font-mono text-green-400">source</span> - Display tag (purple)</div>
                    </div>
                    <div className="pt-1 border-t border-slate-800 mt-2">Replace <span className="font-mono text-slate-400">rag-xxxxxxxxxxxx</span> with your API key.</div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}