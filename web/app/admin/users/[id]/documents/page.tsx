"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Trash2, 
  Loader2, 
  FileText,
  AlertTriangle
} from "lucide-react";
import { DocumentItem, PaginatedDocumentsResponse } from "../../../../types";
import Pagination from "../../../../components/Pagination";
import Modal, { AlertModal } from "../../../../components/Modal";

export default function AdminUserDocumentsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const userId = parseInt(params.id);
  
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  
  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    docId: number | null; // null means batch delete
  }>({
    isOpen: false,
    docId: null,
  });
  
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [errorAlert, setErrorAlert] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: "" });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchDocuments = useCallback(async (pageNum: number) => {
    setLoading(true);
    setSelectedIds(new Set()); // Clear selection on page change
    try {
      const res = await fetch(
        `${API_URL}/documents?page=${pageNum}&page_size=10&user_id=${userId}`,
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
      setLoading(false);
    }
  }, [API_URL, userId]);

  useEffect(() => {
    fetchDocuments(1);
  }, [fetchDocuments]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteClick = (docId: number) => {
    setConfirmModal({ isOpen: true, docId });
  };

  const handleBatchDeleteClick = () => {
    setConfirmModal({ isOpen: true, docId: null });
  };

  const handleDeleteConfirm = async () => {
    // Single delete
    if (confirmModal.docId) {
      const docId = confirmModal.docId;
      setDeletingId(docId);
      try {
        const res = await fetch(
          `${API_URL}/documents/${docId}?user_id=${userId}`,
          { method: "DELETE", credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to delete document");
        await fetchDocuments(page);
      } catch (error) {
        console.error(error);
        setErrorAlert({ isOpen: true, message: "Failed to delete document" });
      } finally {
        setDeletingId(null);
        setConfirmModal({ isOpen: false, docId: null });
      }
    }
    // Batch delete
    else {
      setIsBatchDeleting(true);
      try {
        const res = await fetch(
          `${API_URL}/documents/batch?user_id=${userId}`,
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
        setErrorAlert({ isOpen: true, message: "Failed to delete documents" });
      } finally {
        setIsBatchDeleting(false);
        setConfirmModal({ isOpen: false, docId: null });
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">User Documents</h1>
              <p className="text-slate-500">Managing documents for User ID: {userId}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600">
              <FileText className="w-5 h-5" />
              <span className="font-medium">{total} Documents</span>
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDeleteClick}
                disabled={isBatchDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                {isBatchDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Selected ({selectedIds.size})
              </button>
            )}
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              No documents found for this user
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {/* Header Row for Select All */}
                <div className="px-6 py-3 bg-slate-50 flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === documents.length && documents.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Select All
                  </span>
                </div>

                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group px-6 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors ${
                      selectedIds.has(doc.id) ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => handleSelectOne(doc.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          ID: {doc.id}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(doc.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm line-clamp-2 group-hover:text-slate-900 transition-colors leading-relaxed">
                        {doc.content}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteClick(doc.id)}
                      disabled={deletingId === doc.id}
                      className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
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

              <div className="p-4 border-t border-slate-200">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={fetchDocuments}
                  isLoading={loading}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, docId: null })}
        title="Delete Documents"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-red-50 rounded-xl text-red-700">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h4 className="font-medium mb-1">Warning: Irreversible Action</h4>
              <p className="text-sm opacity-90">
                {confirmModal.docId
                  ? "Are you sure you want to delete this document? This action cannot be undone."
                  : `Are you sure you want to delete ${selectedIds.size} selected documents? This action cannot be undone.`}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setConfirmModal({ isOpen: false, docId: null })}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      <AlertModal
        isOpen={errorAlert.isOpen}
        onClose={() => setErrorAlert({ isOpen: false, message: "" })}
        title="Error"
        message={errorAlert.message}
        variant="error"
      />
    </div>
  );
}