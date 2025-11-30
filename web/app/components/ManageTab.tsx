"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Database, Tag, Link as LinkIcon, Trash2, CheckSquare, Square, FolderPlus, Folder, FolderOpen, MoreVertical, Edit2 } from "lucide-react";
import { DocumentItem, PaginatedDocumentsResponse, DocumentGroup } from "../types";
import Pagination from "./Pagination";
import { ConfirmModal, AlertModal } from "./Modal";

export default function ManageTab() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    docId: number | null; // If null, it's a batch delete
    groupId?: number | null; // If present, it's a group delete
  }>({ isOpen: false, docId: null });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "error" | "success" | "info";
  }>({ isOpen: false, title: "", message: "", variant: "info" });

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch groups");
      const data: DocumentGroup[] = await res.json();
      setGroups(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchDocuments = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    setSelectedIds(new Set()); // Clear selection on page change
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL || ""}/documents?page=${pageNum}&page_size=10`;
      if (selectedGroupId !== null) {
        url += `&group_id=${selectedGroupId}`;
      }
      
      const res = await fetch(url, { credentials: "include" });
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
  }, [selectedGroupId]);

  const handleGroupCreate = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newGroupName }),
      });
      if (!res.ok) throw new Error("Failed to create group");
      await fetchGroups();
      setNewGroupName("");
      setIsCreatingGroup(false);
    } catch (error) {
      console.error(error);
      setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to create group. Please try again.",
        variant: "error",
      });
    }
  };

  const handleGroupUpdate = async () => {
    if (!editingGroupId || !editingGroupName.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups/${editingGroupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editingGroupName }),
      });
      if (!res.ok) throw new Error("Failed to update group");
      await fetchGroups();
      setEditingGroupId(null);
      setEditingGroupName("");
    } catch (error) {
      console.error(error);
       setAlertModal({
        isOpen: true,
        title: "Error",
        message: "Failed to update group. Please try again.",
        variant: "error",
      });
    }
  };

  const handleGroupDeleteClick = (groupId: number) => {
      setConfirmModal({ isOpen: true, docId: null, groupId });
  }

  const handleDeleteClick = (docId: number) => {
    setConfirmModal({ isOpen: true, docId, groupId: null });
  };

  const handleBatchDeleteClick = () => {
    setConfirmModal({ isOpen: true, docId: null, groupId: null });
  };
  
  const handleAssignToGroup = async (targetGroupId: number | null) => {
      if (selectedIds.size === 0) return;
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/groups/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ 
                doc_ids: Array.from(selectedIds),
                group_id: targetGroupId
             }),
          });
          if (!res.ok) throw new Error("Failed to assign documents");
          
          await fetchDocuments(page);
          await fetchGroups(); // Update counts
          setSelectedIds(new Set());
          
          setAlertModal({
            isOpen: true,
            title: "Success",
            message: "Documents moved successfully.",
            variant: "success",
          });

      } catch (error) {
          console.error(error);
           setAlertModal({
            isOpen: true,
            title: "Error",
            message: "Failed to move documents.",
            variant: "error",
          });
      }
  }

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
    // Group delete
    if (confirmModal.groupId) {
        try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || ""}/groups/${confirmModal.groupId}`,
              { method: "DELETE", credentials: "include" }
            );
            if (!res.ok) throw new Error("Failed to delete group");
            await fetchGroups();
            if (selectedGroupId === confirmModal.groupId) setSelectedGroupId(null);
            // Refresh documents list as their group association is removed
            if (selectedGroupId === confirmModal.groupId || selectedGroupId === null) {
                await fetchDocuments(page); 
            }
          } catch (error) {
            console.error(error);
            setAlertModal({
              isOpen: true,
              title: "Error",
              message: "Failed to delete group. Please try again.",
              variant: "error",
            });
          }
    }
    // Single delete
    else if (confirmModal.docId) {
      const docId = confirmModal.docId;
      setDeletingId(docId);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ""}/documents/${docId}`,
          { method: "DELETE", credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to delete document");
        await fetchDocuments(page);
        await fetchGroups(); // Update counts
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
        await fetchGroups(); // Update counts
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
    fetchGroups();
  }, [fetchDocuments, fetchGroups]); // Include dependencies

  return (
    <div className="space-y-6 animate-fade-in flex flex-col md:flex-row gap-6">
      {/* Sidebar: Groups */}
      <div className="w-full md:w-64 flex-shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Folders</h3>
            <button
                onClick={() => setIsCreatingGroup(!isCreatingGroup)}
                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Create Folder"
            >
                <FolderPlus className="w-5 h-5" />
            </button>
          </div>
          
          {isCreatingGroup && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Folder Name"
                    className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleGroupCreate()}
                  />
                  <button onClick={handleGroupCreate} className="text-xs font-medium text-white bg-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-700">Add</button>
              </div>
          )}

          <div className="space-y-1">
              <button
                onClick={() => setSelectedGroupId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    selectedGroupId === null 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    All Documents
                  </div>
              </button>
              
              {groups.map(group => (
                  <div key={group.id} className="group/item relative">
                    {editingGroupId === group.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                             <input
                                type="text"
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                className="flex-1 min-w-0 px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onBlur={() => {
                                    setEditingGroupId(null);
                                    setEditingGroupName("");
                                }}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') handleGroupUpdate();
                                    if(e.key === 'Escape') {
                                        setEditingGroupId(null);
                                        setEditingGroupName("");
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setSelectedGroupId(group.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                                selectedGroupId === group.id
                                ? "bg-blue-50 text-blue-700" 
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                {selectedGroupId === group.id ? <FolderOpen className="w-4 h-4 flex-shrink-0" /> : <Folder className="w-4 h-4 flex-shrink-0" />}
                                <span className="truncate">{group.name}</span>
                            </div>
                            <span className="text-xs text-slate-400 font-normal ml-2">{group.documentCount}</span>
                        </button>
                    )}
                    
                    {/* Folder Actions */}
                     <div className="absolute right-1 top-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-md shadow-sm border border-slate-100 flex items-center">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditingGroupId(group.id);
                                setEditingGroupName(group.name);
                            }}
                            className="p-1 hover:text-blue-600"
                            title="Rename"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleGroupDeleteClick(group.id);
                            }}
                            className="p-1 hover:text-red-600"
                            title="Delete"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                     </div>
                  </div>
              ))}
          </div>
          
          {selectedIds.size > 0 && (
             <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Move to</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedGroupId !== null && (
                        <button onClick={() => handleAssignToGroup(null)} className="w-full text-left px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                             <Database className="w-3 h-3" /> All Docs
                        </button>
                    )}
                    {groups.filter(g => g.id !== selectedGroupId).map(group => (
                        <button key={group.id} onClick={() => handleAssignToGroup(group.id)} className="w-full text-left px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2">
                             <Folder className="w-3 h-3" /> {group.name}
                        </button>
                    ))}
                </div>
             </div>
          )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name || 'Folder' : "Manage Documents"}
            </h2>
            <p className="text-slate-500 mt-1">
                {selectedGroupId 
                    ? `Viewing documents in ${groups.find(g => g.id === selectedGroupId)?.name}` 
                    : "View and delete documents from your knowledge base."}
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
                {selectedGroupId ? <Folder className="w-8 h-8 text-slate-400" /> : <Database className="w-8 h-8 text-slate-400" />}
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
                No documents found
            </h3>
            <p className="text-slate-500">
                {selectedGroupId ? "This folder is empty." : "Add some documents to get started."}
            </p>
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
                        {/* Show folder badge if viewing all documents and doc belongs to a folder */}
                        {selectedGroupId === null && doc.group && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                <Folder className="w-3 h-3" />
                                {doc.group.name}
                            </span>
                        )}
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
            onClose={() => setConfirmModal({ isOpen: false, docId: null, groupId: null })}
            onConfirm={handleDeleteConfirm}
            title={confirmModal.groupId ? "Delete Folder" : (confirmModal.docId ? "Delete Document" : "Delete Documents")}
            message={
                confirmModal.groupId 
                ? "Are you sure you want to delete this folder? The documents inside will NOT be deleted, but will be moved to 'All Documents'."
                : (confirmModal.docId
                ? "Are you sure you want to delete this document? This action cannot be undone."
                : `Are you sure you want to delete ${selectedIds.size} documents? This action cannot be undone.`)
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
    </div>
  );
}