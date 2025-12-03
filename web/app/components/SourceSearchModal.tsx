"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2, ExternalLink, Check, AlertCircle, Download, RefreshCw } from "lucide-react";

interface SourceSearchResult {
  url: string;
  title: string;
  snippet: string;
  relevance_score?: number;
}

interface SourceSearchStatus {
  task_id: string;
  status: string;
  current_round: number;
  total_rounds: number;
  message: string;
  results: SourceSearchResult[];
  error?: string;
}

interface BatchImportResult {
  url: string;
  success: boolean;
  content?: string;
  title?: string;
  content_length?: number;
  error?: string;
}

interface SourceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contents: Array<{ content: string; title?: string; url: string }>) => void;
}

// Portal component for rendering modals outside of component hierarchy
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  if (!mounted) return null;
  
  return createPortal(children, document.body);
}

export default function SourceSearchModal({ isOpen, onClose, onImport }: SourceSearchModalProps) {
  const [query, setQuery] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const [resultsPerRound, setResultsPerRound] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<SourceSearchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  
  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!taskId || !isSearching) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/source-search/${taskId}`,
          { credentials: "include" }
        );
        
        if (!res.ok) {
          throw new Error("Failed to fetch status");
        }
        
        const data: SourceSearchStatus = await res.json();
        setStatus(data);
        
        if (data.status === "completed" || data.status === "failed") {
          setIsSearching(false);
          if (data.status === "failed" && data.error) {
            setError(data.error);
          }
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, 1000);
    return () => clearInterval(interval);
  }, [taskId, isSearching]);

  const handleSearch = async () => {
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    setStatus(null);
    setSelectedUrls(new Set());

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/source-search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            query: query.trim(),
            max_rounds: maxRounds,
            results_per_round: resultsPerRound,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Search failed");
      }

      const data = await res.json();
      setTaskId(data.task_id);
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setIsSearching(false);
    }
  };

  const toggleSelect = useCallback((url: string) => {
    setSelectedUrls(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!status?.results) return;
    setSelectedUrls(new Set(status.results.map(r => r.url)));
  }, [status?.results]);

  const deselectAll = useCallback(() => {
    setSelectedUrls(new Set());
  }, []);

  const handleBatchImport = async () => {
    if (selectedUrls.size === 0 || isImporting) return;

    setIsImporting(true);
    setImportProgress(`Importing ${selectedUrls.size} URLs...`);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/batch-import-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            urls: Array.from(selectedUrls),
            max_characters: 15000,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Import failed");
      }

      const data: { total: number; successful: number; failed: number; results: BatchImportResult[] } = await res.json();
      
      // Collect successful imports
      const importedContents = data.results
        .filter(r => r.success && r.content)
        .map(r => ({
          content: r.content!,
          title: r.title,
          url: r.url,
        }));

      if (importedContents.length > 0) {
        onImport(importedContents);
        setImportProgress(`Successfully imported ${data.successful} of ${data.total} URLs`);
        
        // Auto close after successful import
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(`Failed to import any content. ${data.failed} URLs failed.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSingleImport = async (url: string) => {
    setIsImporting(true);
    setImportProgress(`Importing from ${url}...`);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/import-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            url: url,
            max_characters: 15000,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Import failed");
      }

      const data = await res.json();
      
      if (data.content) {
        onImport([{
          content: data.content,
          title: data.title,
          url: url,
        }]);
        setImportProgress("Import successful!");
        
        // Remove from results
        if (status) {
          setStatus({
            ...status,
            results: status.results.filter(r => r.url !== url),
          });
        }
        selectedUrls.delete(url);
        setSelectedUrls(new Set(selectedUrls));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
      setTimeout(() => setImportProgress(null), 2000);
    }
  };

  const resetSearch = () => {
    setQuery("");
    setTaskId(null);
    setStatus(null);
    setError(null);
    setSelectedUrls(new Set());
    setIsSearching(false);
  };

  if (!isOpen) return null;

  const hasResults = status?.results && status.results.length > 0;
  const isComplete = status?.status === "completed";

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div
          className="absolute inset-0"
          onClick={onClose}
        />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Source Search</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a topic to search for sources..."
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim() && !isSearching) {
                  handleSearch();
                }
              }}
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>

          {/* Options */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <label className="text-slate-600">Rounds:</label>
              <select
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                disabled={isSearching}
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-600">Results/round:</label>
              <select
                value={resultsPerRound}
                onChange={(e) => setResultsPerRound(Number(e.target.value))}
                className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                disabled={isSearching}
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={8}>8</option>
              </select>
            </div>
            {hasResults && (
              <button
                onClick={resetSearch}
                className="ml-auto flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                New Search
              </button>
            )}
          </div>
        </div>

        {/* Status / Progress */}
        {(isSearching || status) && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                {isSearching ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    {status?.message || "Starting search..."}
                  </span>
                ) : (
                  status?.message
                )}
              </span>
              {status && (
                <span className="text-slate-500">
                  Round {status.current_round}/{status.total_rounds}
                </span>
              )}
            </div>
            {isSearching && status && (
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${(status.current_round / status.total_rounds) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Import Progress */}
        {importProgress && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-sm text-blue-700">
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            ) : (
              <Check className="w-4 h-4 flex-shrink-0" />
            )}
            {importProgress}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasResults && !isSearching && !error && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Search className="w-10 h-10 mb-2 opacity-50" />
              <p>Enter a topic to discover relevant sources</p>
            </div>
          )}

          {hasResults && (
            <div className="space-y-3">
              {/* Selection controls */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  {status?.results?.length || 0} sources found
                  {selectedUrls.size > 0 && ` (${selectedUrls.size} selected)`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Result list */}
              {status?.results?.map((result) => (
                <div
                  key={result.url}
                  className={`p-3 border rounded-xl transition-all ${
                    selectedUrls.has(result.url)
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSelect(result.url)}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedUrls.has(result.url)
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 hover:border-blue-400"
                      }`}
                    >
                      {selectedUrls.has(result.url) && <Check className="w-3 h-3" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 truncate">
                        {result.title || result.url}
                      </h3>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 truncate"
                      >
                        {result.url}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                      {result.snippet && (
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                          {result.snippet}
                        </p>
                      )}
                    </div>

                    {/* Single import button */}
                    <button
                      onClick={() => handleSingleImport(result.url)}
                      disabled={isImporting}
                      className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Import
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

          {/* Footer with batch import */}
          {hasResults && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
              <p className="text-sm text-slate-600">
                Select sources and click &quot;Import Selected&quot; to batch import
              </p>
              <button
                onClick={handleBatchImport}
                disabled={selectedUrls.size === 0 || isImporting}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium transition-all"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Import Selected ({selectedUrls.size})
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}