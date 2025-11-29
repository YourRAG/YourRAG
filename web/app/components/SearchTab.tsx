"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  Sparkles,
  FileText,
  Tag,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SearchResult, PaginatedSearchResponse } from "../types";
import { AlertModal } from "./Modal";

export default function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const pageSize = 5;

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "error" | "success" | "info";
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const performSearch = async (searchQuery: string, page: number) => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/search?query=${encodeURIComponent(searchQuery)}&page=${page}&page_size=${pageSize}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Search failed");
      const data: PaginatedSearchResponse = await res.json();
      setResults(data.results);
      setTotalPages(data.total_pages);
      setTotalResults(data.total);
      setCurrentPage(data.page);
    } catch (error) {
      console.error(error);
      setAlertModal({
        isOpen: true,
        title: "Search Failed",
        message: "Search failed. Make sure the backend is running.",
        variant: "error",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    await performSearch(query, 1);
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    await performSearch(query, newPage);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3 sm:space-y-4 py-4 sm:py-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          What are you looking for?
        </h2>
        <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto px-4">
          Search through your knowledge base using natural language. Our RAG
          system will find the most relevant context for you.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question or search for documents..."
            className="block w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all duration-200"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-2 top-2 bottom-2 px-3 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 font-medium text-sm sm:text-base"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="hidden sm:inline">Search</span>
            )}
            {!isSearching && <Search className="w-4 h-4 sm:hidden" />}
          </button>
        </form>
      </div>

      <div className="space-y-4 max-w-3xl mx-auto">
        {results.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Sparkles className="w-4 h-4 text-blue-500" />
              Found {totalResults} relevant results
            </div>
            {totalPages > 1 && (
              <div className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
              </div>
            )}
          </div>
        )}

        {results.map((result) => (
          <div
            key={result.id}
            className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600">
                  <FileText className="w-4 h-4" />
                </span>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                  Distance: {result.distance.toFixed(4)}
                </span>
              </div>
              <div className="flex gap-2">
                {typeof result.metadata?.category === 'string' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                    <Tag className="w-3 h-3" />
                    {result.metadata.category as string}
                  </span>
                )}
                {typeof result.metadata?.source === 'string' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                    <LinkIcon className="w-3 h-3" />
                    {result.metadata.source as string}
                  </span>
                )}
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {result.content}
            </p>
          </div>
        ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isSearching}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, index, array) => {
                  const showEllipsis =
                    index > 0 && page - array[index - 1] > 1;
                  return (
                    <div key={page} className="flex items-center gap-1">
                      {showEllipsis && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(page)}
                        disabled={isSearching}
                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-all ${
                          currentPage === page
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {page}
                      </button>
                    </div>
                  );
                })}
            </div>
            <div className="sm:hidden flex items-center gap-1">
               <span className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
               </span>
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || isSearching}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {results.length === 0 && !isSearching && query && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 mb-4">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No results found
            </h3>
            <p className="text-slate-500">
              Try adjusting your search query or keywords.
            </p>
          </div>
        )}
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />
    </div>
  );
}