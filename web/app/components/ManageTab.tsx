"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Database, Tag, Link as LinkIcon, Trash2, CheckSquare, Square } from "lucide-react";
import { DocumentItem, PaginatedDocumentsResponse } from "../types";
import Pagination from "./Pagination";
import { ConfirmModal, AlertModal } from "./Modal";

export default function ManageTab() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    docId: number | null; // If null, it's a batch delete
  }>({ isOpen: false, docId: null });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "error" | "success" | "info";
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const fetchDocuments = async (pageNum: number) => {
    setIsLoading(true);
    setSelectedIds(new Set()); // Clear selection on page change
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ""}/documents?page=${pageNum}&page_size=10`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data: PaginatedDocumentsResponse = await res.json();
      setDocuments(data.documents);
      setTotalPages(data.total_pages);
      setTotal(data.total);
      setPage(data.page);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (docId: number) => {
    setConfirmModal({ isOpen: true, docId });
  };

  const handleBatchDeleteClick = () => {
    setConfirmModal({ isOpen: true, docId: null });
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  };

  const handleDeleteConfirm = async () => {
    // Single delete
    if (confirmModal.docId) {
      const docId = confirmModal.docId;
      setDeletingId(docId);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/${docId}`,
          { method: "DELETE", credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to delete document");
        await fetchDocuments(page);
      } catch (error) {
        console.error(error);
        setAlertModal({
          isOpen: true,
          title: "Error",
          message: "Failed to delete document. Please try again.",
          variant: "error",
        });
      } finally {
        setDeletingId(null);
      }
    }
    // Batch delete
    else {
      setIsBatchDeleting(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/batch`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          }
        );
        if (!res.ok) throw new Error("Failed to delete documents");
        await fetchDocuments(page);
        setSelectedIds(new Set());
      } catch (error) {
        console.error(error);
        setAlertModal({
          isOpen: true,
          title: "Error",
          message: "Failed to delete documents. Please try again.",
          variant: "error",
        });
      } finally {
        setIsBatchDeleting(false);
      }
    }
  };

  useEffect(() => {
    fetchDocuments(1);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Manage Documents</h2>
          <p className="text-slate-500 mt-1">
            View and delete documents from your knowledge base.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDeleteClick}
              disabled={isBatchDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium animate-in fade-in slide-in-from-right-4 border border-red-100 shadow-sm"
            >
              {isBatchDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete ({selectedIds.size})
            </button>
          )}
          <div className="text-sm font-medium text-slate-500 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
            {total} documents
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
            <Database className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No documents yet
          </h3>
          <p className="text-slate-500">Add some documents to get started.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                {selectedIds.size === documents.length && documents.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
                Select All
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`group flex items-start gap-4 p-5 hover:bg-slate-50 transition-all cursor-pointer ${
                    selectedIds.has(doc.id) ? "bg-blue-50/30" : ""
                  }`}
                  onClick={() => router.push(`/document/${doc.id}`)}
                >
                  <div
                    className="pt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(doc.id);
                    }}
                  >
                    {selectedIds.has(doc.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 group-hover:text-slate-400 transition-colors" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        ID: {doc.id}
                      </span>
                      {typeof doc.metadata?.category === 'string' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <Tag className="w-3 h-3" />
                          {doc.metadata.category}
                        </span>
                      )}
                      {typeof doc.metadata?.source === 'string' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                          <LinkIcon className="w-3 h-3" />
                          {doc.metadata.source}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-sm line-clamp-2 group-hover:text-slate-900 transition-colors leading-relaxed">
                      {doc.content}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(doc.id);
                    }}
                    disabled={deletingId === doc.id}
                    className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete document"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={fetchDocuments}
            isLoading={isLoading}
          />
        </>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, docId: null })}
        onConfirm={handleDeleteConfirm}
        title={confirmModal.docId ? "Delete Document" : "Delete Documents"}
        message={
          confirmModal.docId
            ? "Are you sure you want to delete this document? This action cannot be undone."
            : `Are you sure you want to delete ${selectedIds.size} documents? This action cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

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