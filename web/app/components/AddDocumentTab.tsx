"use client";

import { useState, useRef } from "react";
import { Loader2, Plus, Tag, Link as LinkIcon, Split, FileText, CheckCircle2, AlertCircle, Upload } from "lucide-react";

export default function AddDocumentTab() {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState("");

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
      for (let i = 0; i < docs.length; i++) {
        const docContent = docs[i];
        setMessage(`Adding document ${i + 1} of ${docs.length}...`);
        
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            content: docContent,
            metadata: { category: "", source: "" },
          }),
        });

        if (!res.ok) throw new Error(`Failed to add document ${i + 1}`);
        successCount++;
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
          </form>
        </div>
      </div>
    </div>
  );
}