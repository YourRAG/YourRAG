"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Plus, Split, FileText, CheckCircle2, AlertCircle, Upload, Code, Copy, Check, Folder, FolderPlus } from "lucide-react";

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
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [showCurl, setShowCurl] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Group selection
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);

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

  const docCount = content
    .split("--------")
    .map((doc) => doc.trim())
    .filter((doc) => doc.length > 0).length;

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
      
      // Prepare metadata with group info
      const metadata: Record<string, unknown> = { category: "", source: "" };
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
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error(error);
      setMessage("Error adding documents.");
    } finally {
      setIsAdding(false);
    }
  };

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

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Content <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".md,.markdown"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-700 font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                    title="Import content from a Markdown file"
                  >
                    <Upload className="w-3 h-3" />
                    Import MD
                  </button>
                  <button
                    type="button"
                    onClick={insertSeparator}
                    className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                    title="Insert separator to add multiple documents at once"
                  >
                    <Split className="w-3 h-3" />
                    Insert Separator
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
      "category": "example",
      "groupName": "My Folder"
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
                      {'\n      '}<span className="text-orange-400">"category"</span>: <span className="text-green-400">"example"</span>,
                      {'\n      '}<span className="text-orange-400">"groupName"</span>: <span className="text-green-400">"My Folder"</span>
                      {'\n    '}<span className="text-yellow-400">{'}'}</span>
                      {'\n  '}<span className="text-yellow-400">{'}'}'</span>
                    </pre>
                  </div>
                  <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 text-xs text-slate-500 space-y-1">
                    <div>Replace <span className="font-mono text-slate-400">rag-xxxxxxxxxxxx</span> with your API key from the Manage tab.</div>
                    <div>Use <span className="font-mono text-slate-400">groupName</span> to add to a folder (creates if not exists), or <span className="font-mono text-slate-400">groupId</span> for existing folder.</div>
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