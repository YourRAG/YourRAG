"use client";

import { useMemo, useState } from "react";
import { FileText, ChevronRight, Hash, Scissors, Loader2, Sparkles, Shield } from "lucide-react";
import Markdown from "./Markdown";
import FactCheckModal, { CredibilityBadge } from "./FactCheckModal";

interface DocumentPreviewPanelProps {
  content: string;
  onDocumentClick: (index: number, startPos: number) => void;
  activeDocIndex?: number;
  onChunkDocument?: (docIndex: number, chunks: string[]) => void;
  onChunkAll?: (allChunks: string[]) => void;
}

interface ParsedDocument {
  content: string;
  index: number;
  startPos: number;
  endPos: number;
  charCount: number;
  preview: string;
}

interface FactCheckResult {
  credibility_score: number;
  verdict: "verified" | "mostly_true" | "mixed" | "unverified" | "false";
  analysis: string;
  sources: { title: string; url: string; snippet: string }[];
  claims_checked: number;
}

interface DocFactCheckState {
  [docIndex: number]: {
    isLoading: boolean;
    result: FactCheckResult | null;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function DocumentPreviewPanel({
  content,
  onDocumentClick,
  activeDocIndex,
  onChunkDocument,
  onChunkAll,
}: DocumentPreviewPanelProps) {
  const [chunkingIndex, setChunkingIndex] = useState<number | null>(null);
  const [chunkingAll, setChunkingAll] = useState(false);
  
  // Fact check states
  const [factCheckStates, setFactCheckStates] = useState<DocFactCheckState>({});
  const [factCheckModalOpen, setFactCheckModalOpen] = useState(false);
  const [factCheckingAll, setFactCheckingAll] = useState(false);
  const [selectedFactCheck, setSelectedFactCheck] = useState<{
    docIndex: number;
    result: FactCheckResult | null;
    isLoading: boolean;
  } | null>(null);

  const documents = useMemo((): ParsedDocument[] => {
    if (!content.trim()) return [];

    const parts = content.split("--------");
    const result: ParsedDocument[] = [];
    let currentPos = 0;

    parts.forEach((part, index) => {
      const trimmedPart = part.trim();
      if (trimmedPart.length === 0) {
        currentPos += part.length + (index < parts.length - 1 ? 8 : 0);
        return;
      }

      const startPos = content.indexOf(part, currentPos);
      const endPos = startPos + part.length;

      // Generate preview - first 150 chars, but try to break at word boundary
      let preview = trimmedPart.substring(0, 150);
      if (trimmedPart.length > 150) {
        const lastSpace = preview.lastIndexOf(" ");
        if (lastSpace > 100) {
          preview = preview.substring(0, lastSpace);
        }
        preview += "...";
      }

      result.push({
        content: trimmedPart,
        index: result.length,
        startPos,
        endPos,
        charCount: trimmedPart.length,
        preview,
      });

      currentPos = endPos + (index < parts.length - 1 ? 8 : 0);
    });

    return result;
  }, [content]);

  const handleChunkSingle = async (docIndex: number, docContent: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onChunkDocument || chunkingIndex !== null || chunkingAll) return;
    
    setChunkingIndex(docIndex);
    try {
      const res = await fetch(`${API_URL}/documents/smart-chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: docContent }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to chunk document");
      }
      
      const data = await res.json();
      if (data.chunks && data.chunks.length > 0) {
        onChunkDocument(docIndex, data.chunks);
      }
    } catch (error) {
      console.error("Chunking error:", error);
    } finally {
      setChunkingIndex(null);
    }
  };

  const handleChunkAll = async () => {
    if (!onChunkAll || chunkingAll || chunkingIndex !== null) return;
    if (documents.length === 0) return;
    
    setChunkingAll(true);
    try {
      const allChunks: string[] = [];
      
      for (const doc of documents) {
        const res = await fetch(`${API_URL}/documents/smart-chunk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: doc.content }),
        });
        
        if (!res.ok) {
          allChunks.push(doc.content);
          continue;
        }
        
        const data = await res.json();
        if (data.chunks && data.chunks.length > 0) {
          allChunks.push(...data.chunks);
        } else {
          allChunks.push(doc.content);
        }
      }
      
      if (allChunks.length > 0) {
        onChunkAll(allChunks);
      }
    } catch (error) {
      console.error("Chunk all error:", error);
    } finally {
      setChunkingAll(false);
    }
  };

  // Fact check a single document
  const handleFactCheck = async (docIndex: number, docContent: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If we already have a result, just show it
    const existingState = factCheckStates[docIndex];
    if (existingState?.result) {
      setSelectedFactCheck({
        docIndex,
        result: existingState.result,
        isLoading: false,
      });
      setFactCheckModalOpen(true);
      return;
    }
    
    // Start fact check - don't open modal yet, wait for result
    setFactCheckStates((prev) => ({
      ...prev,
      [docIndex]: { isLoading: true, result: null },
    }));
    
    try {
      const res = await fetch(`${API_URL}/documents/fact-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: docContent, current_time: new Date().toISOString() }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to fact check");
      }
      
      const result: FactCheckResult = await res.json();
      
      setFactCheckStates((prev) => ({
        ...prev,
        [docIndex]: { isLoading: false, result },
      }));
      
      setSelectedFactCheck({
        docIndex,
        result,
        isLoading: false,
      });
      setFactCheckModalOpen(true);
    } catch (error) {
      console.error("Fact check error:", error);
      setFactCheckStates((prev) => ({
        ...prev,
        [docIndex]: { isLoading: false, result: null },
      }));
      setSelectedFactCheck((prev) =>
        prev ? { ...prev, isLoading: false } : null
      );
    }
  };
  
  const handleShowFactCheckResult = (docIndex: number) => {
    const state = factCheckStates[docIndex];
    if (state?.result) {
      setSelectedFactCheck({
        docIndex,
        result: state.result,
        isLoading: false,
      });
      setFactCheckModalOpen(true);
    }
  };

  // Fact check all documents in parallel
  const handleFactCheckAll = async () => {
    if (factCheckingAll || documents.length === 0) return;
    
    setFactCheckingAll(true);
    
    // Filter documents that need checking
    const docsToCheck = documents.filter(doc => !factCheckStates[doc.index]?.result);
    
    if (docsToCheck.length === 0) {
      setFactCheckingAll(false);
      return;
    }
    
    // Set all to loading
    setFactCheckStates((prev) => {
      const newState = { ...prev };
      docsToCheck.forEach(doc => {
        newState[doc.index] = { isLoading: true, result: null };
      });
      return newState;
    });
    
    // Check all in parallel
    const currentTime = new Date().toISOString();
    await Promise.all(
      docsToCheck.map(async (doc) => {
        try {
          const res = await fetch(`${API_URL}/documents/fact-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ content: doc.content, current_time: currentTime }),
          });
          
          if (res.ok) {
            const result: FactCheckResult = await res.json();
            setFactCheckStates((prev) => ({
              ...prev,
              [doc.index]: { isLoading: false, result },
            }));
          } else {
            setFactCheckStates((prev) => ({
              ...prev,
              [doc.index]: { isLoading: false, result: null },
            }));
          }
        } catch (error) {
          console.error("Fact check error:", error);
          setFactCheckStates((prev) => ({
            ...prev,
            [doc.index]: { isLoading: false, result: null },
          }));
        }
      })
    );
    
    setFactCheckingAll(false);
  };

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <FileText className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm text-center">
          Start typing to see document preview
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {documents.length} Document{documents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {content.length.toLocaleString()} chars
          </span>
          {documents.length > 0 && (
            <button
              onClick={handleFactCheckAll}
              disabled={factCheckingAll}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Fact check all documents"
            >
              {factCheckingAll ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Shield className="w-3 h-3" />
              )}
            </button>
          )}
          {onChunkAll && documents.length > 0 && (
            <button
              onClick={handleChunkAll}
              disabled={chunkingAll || chunkingIndex !== null}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Smart chunk all documents"
            >
              {chunkingAll ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">Chunk All</span>
            </button>
          )}
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.index}
            onClick={() => onDocumentClick(doc.index, doc.startPos)}
            className={`w-full text-left p-3 rounded-xl border transition-all group hover:shadow-md cursor-pointer ${
              activeDocIndex === doc.index
                ? "bg-blue-50 border-blue-200 shadow-sm"
                : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                    activeDocIndex === doc.index
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600"
                  }`}
                >
                  {doc.index + 1}
                </span>
                <span className="text-xs text-slate-400">
                  {doc.charCount.toLocaleString()} chars
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Fact Check Badge or Button */}
                {factCheckStates[doc.index]?.result ? (
                  <CredibilityBadge
                    score={factCheckStates[doc.index].result!.credibility_score}
                    verdict={factCheckStates[doc.index].result!.verdict}
                    onClick={() => handleShowFactCheckResult(doc.index)}
                  />
                ) : (
                  <button
                    onClick={(e) => handleFactCheck(doc.index, doc.content, e)}
                    disabled={factCheckStates[doc.index]?.isLoading}
                    className={`p-1.5 rounded-md transition-colors ${
                      factCheckStates[doc.index]?.isLoading
                        ? "bg-blue-100 text-blue-600"
                        : "text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Fact check this document"
                  >
                    {factCheckStates[doc.index]?.isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Shield className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                {onChunkDocument && (
                  <button
                    onClick={(e) => handleChunkSingle(doc.index, doc.content, e)}
                    disabled={chunkingIndex !== null || chunkingAll}
                    className={`p-1.5 rounded-md transition-colors ${
                      chunkingIndex === doc.index
                        ? "bg-amber-100 text-amber-600"
                        : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Smart chunk this document"
                  >
                    {chunkingIndex === doc.index ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Scissors className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${
                    activeDocIndex === doc.index
                      ? "text-blue-500"
                      : "text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5"
                  }`}
                />
              </div>
            </div>
            <div className="text-sm text-slate-600 leading-relaxed line-clamp-3">
              {doc.preview}
            </div>
          </div>
        ))}
      </div>

      {/* Preview of Active Document */}
      {activeDocIndex !== undefined && documents[activeDocIndex] && (
        <div className="border-t border-slate-200 bg-slate-50/50 max-h-[40%] overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Preview - Document {activeDocIndex + 1}
            </span>
            <span className="text-xs text-slate-400">Markdown</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-sm">
              <Markdown content={documents[activeDocIndex].content} />
            </div>
          </div>
        </div>
      )}

      {/* Fact Check Modal */}
      <FactCheckModal
        isOpen={factCheckModalOpen}
        onClose={() => {
          setFactCheckModalOpen(false);
          setSelectedFactCheck(null);
        }}
        result={selectedFactCheck?.result || null}
        isLoading={selectedFactCheck?.isLoading || false}
        onRetry={selectedFactCheck ? () => {
          const docIndex = selectedFactCheck.docIndex;
          const doc = documents[docIndex];
          if (doc) {
            // Clear existing result and retry
            setFactCheckStates((prev) => ({
              ...prev,
              [docIndex]: { isLoading: true, result: null },
            }));
            setSelectedFactCheck({
              docIndex,
              result: null,
              isLoading: true,
            });
            
            // Trigger new fact check
            fetch(`${API_URL}/documents/fact-check`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ content: doc.content, current_time: new Date().toISOString() }),
            })
              .then((res) => {
                if (!res.ok) throw new Error("Failed to fact check");
                return res.json();
              })
              .then((result: FactCheckResult) => {
                setFactCheckStates((prev) => ({
                  ...prev,
                  [docIndex]: { isLoading: false, result },
                }));
                setSelectedFactCheck({
                  docIndex,
                  result,
                  isLoading: false,
                });
              })
              .catch((error) => {
                console.error("Fact check error:", error);
                setFactCheckStates((prev) => ({
                  ...prev,
                  [docIndex]: { isLoading: false, result: null },
                }));
                setSelectedFactCheck((prev) =>
                  prev ? { ...prev, isLoading: false } : null
                );
              });
          }
        } : undefined}
      />
    </div>
  );
}