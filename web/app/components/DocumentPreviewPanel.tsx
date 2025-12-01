"use client";

import { useMemo } from "react";
import { FileText, ChevronRight, Hash } from "lucide-react";
import Markdown from "./Markdown";

interface DocumentPreviewPanelProps {
  content: string;
  onDocumentClick: (index: number, startPos: number) => void;
  activeDocIndex?: number;
}

interface ParsedDocument {
  content: string;
  index: number;
  startPos: number;
  endPos: number;
  charCount: number;
  preview: string;
}

export default function DocumentPreviewPanel({
  content,
  onDocumentClick,
  activeDocIndex,
}: DocumentPreviewPanelProps) {
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
        <span className="text-xs text-slate-400">
          {content.length.toLocaleString()} chars total
        </span>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {documents.map((doc) => (
          <button
            key={doc.index}
            onClick={() => onDocumentClick(doc.index, doc.startPos)}
            className={`w-full text-left p-3 rounded-xl border transition-all group hover:shadow-md ${
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
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  activeDocIndex === doc.index
                    ? "text-blue-500"
                    : "text-slate-300 group-hover:text-blue-400 group-hover:translate-x-0.5"
                }`}
              />
            </div>
            <div className="text-sm text-slate-600 leading-relaxed line-clamp-3">
              {doc.preview}
            </div>
          </button>
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
    </div>
  );
}