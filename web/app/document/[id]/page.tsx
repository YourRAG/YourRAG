"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Tag, Link as LinkIcon, Trash2, Loader2, FileText, AlertCircle } from "lucide-react";
import { DocumentItem } from "../../types";
import { ConfirmModal } from "../../components/Modal";

export default function DocumentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents/${params.id}`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (res.status === 404) throw new Error("Document not found or you don't have permission to view it");
          if (res.status === 401) {
            window.location.href = "/"; // Redirect to login if unauthorized
            return;
          }
          throw new Error("Failed to fetch document");
        }
        const data = await res.json();
        setDoc(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [params.id]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/documents/${params.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      router.push("/?tab=manage");
    } catch (err) {
      console.error(err);
      // Show error toast or alert
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Document</h2>
          <p className="text-slate-500 mb-6">{error || "Document not found"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/?tab=manage")}
          className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-6 transition-colors"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-lg group-hover:border-slate-300 transition-colors shadow-sm">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium">Back to Documents</span>
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Document Details</h1>
                    <p className="text-sm text-slate-500">ID: {doc.id}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {doc.created_at && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 shadow-sm">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Added {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {typeof doc.metadata?.category === 'string' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 border border-green-100 text-green-700 shadow-sm">
                      <Tag className="w-3.5 h-3.5" />
                      {doc.metadata.category}
                    </span>
                  )}
                  {typeof doc.metadata?.source === 'string' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 border border-purple-100 text-purple-700 shadow-sm">
                      <LinkIcon className="w-3.5 h-3.5" />
                      {doc.metadata.source}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-100 text-red-600 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm hover:shadow text-sm font-medium self-start"
              >
                <Trash2 className="w-4 h-4" />
                Delete Document
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <div className="prose prose-slate max-w-none prose-pre:bg-white prose-pre:text-slate-900 prose-pre:p-0 prose-pre:m-0 prose-pre:rounded-none prose-pre:shadow-none">
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <pre className="whitespace-pre-wrap font-mono text-sm text-slate-900 leading-relaxed overflow-x-auto break-words bg-transparent p-0 m-0 border-0 shadow-none">
                  {doc.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone and will remove it from search results."
        confirmText={isDeleting ? "Deleting..." : "Delete Document"}
        variant="danger"
      />
    </div>
  );
}