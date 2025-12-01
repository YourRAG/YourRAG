"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Github,
  Code,
  Loader2,
  Trash2,
  RefreshCw,
  FileCode,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Plus,
  ExternalLink,
  Clock,
  Files,
  AlertCircle,
  Folder
} from "lucide-react";
import Modal from "../components/Modal";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface CodeBase {
  group_id: number;
  repo_name: string;
  repo_url: string;
  file_count: number;
  chunk_count: number;
  created_at: string;
}

interface IndexingStatus {
  repo_name: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total_files: number;
  message: string;
  group_id?: number;
  error?: string;
}

interface FileInfo {
  file_path: string;
  language: string;
  chunk_count: number;
  first_doc_id: number;
}

export default function CodeBasePage() {
  const router = useRouter();
  const [codebases, setCodebases] = useState<CodeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoUrl, setRepoUrl] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Selected codebase details
  const [selectedCodebase, setSelectedCodebase] = useState<CodeBase | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  
  // Modals
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; codebase?: CodeBase }>({ isOpen: false });
  const [reindexModal, setReindexModal] = useState<{ isOpen: boolean; file?: FileInfo }>({ isOpen: false });
  const [reindexing, setReindexing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCodebases = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/codebase/list`, {
        credentials: "include"
      });
      
      if (res.status === 401) {
        router.push("/");
        return;
      }
      
      if (!res.ok) throw new Error("Failed to fetch codebases");
      
      const data = await res.json();
      setCodebases(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load code bases");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCodebases();
  }, [fetchCodebases]);

  // Poll indexing status
  useEffect(() => {
    if (!taskId || !indexingStatus) return;
    if (indexingStatus.status === "completed" || indexingStatus.status === "failed") {
      setIndexing(false);
      if (indexingStatus.status === "completed") {
        fetchCodebases();
      }
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/codebase/status/${taskId}`, {
          credentials: "include"
        });
        
        if (res.ok) {
          const status = await res.json();
          setIndexingStatus(status);
          
          if (status.status === "completed" || status.status === "failed") {
            setIndexing(false);
            if (status.status === "completed") {
              fetchCodebases();
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [taskId, indexingStatus, fetchCodebases]);

  const handleIndexRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || indexing) return;

    setError(null);
    setIndexing(true);
    setIndexingStatus(null);

    try {
      const res = await fetch(`${API_URL}/codebase/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: repoUrl.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to start indexing");
      }

      const data = await res.json();
      setTaskId(data.task_id);
      setIndexingStatus(data.status);
      setRepoUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to index repository");
      setIndexing(false);
    }
  };

  const handleSelectCodebase = async (codebase: CodeBase) => {
    setSelectedCodebase(codebase);
    setLoadingFiles(true);
    setExpandedDirs(new Set());

    try {
      const res = await fetch(`${API_URL}/codebase/${codebase.group_id}/files`, {
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to fetch files");

      const data = await res.json();
      setFiles(data.files);
    } catch (err) {
      console.error(err);
      setError("Failed to load files");
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleDeleteCodebase = async () => {
    if (!deleteModal.codebase) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/codebase/${deleteModal.codebase.group_id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to delete codebase");

      setDeleteModal({ isOpen: false });
      setSelectedCodebase(null);
      await fetchCodebases();
    } catch (err) {
      console.error(err);
      setError("Failed to delete code base");
    } finally {
      setDeleting(false);
    }
  };

  const handleReindexFile = async () => {
    if (!reindexModal.file || !selectedCodebase) return;
    
    setReindexing(true);
    try {
      const res = await fetch(`${API_URL}/codebase/${selectedCodebase.group_id}/reindex-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          group_id: selectedCodebase.group_id,
          file_path: reindexModal.file.file_path
        })
      });

      if (!res.ok) throw new Error("Failed to reindex file");

      setReindexModal({ isOpen: false });
      // Refresh files
      await handleSelectCodebase(selectedCodebase);
    } catch (err) {
      console.error(err);
      setError("Failed to reindex file");
    } finally {
      setReindexing(false);
    }
  };

  // Build directory tree from flat file list
  const buildFileTree = (files: FileInfo[]) => {
    const tree: Record<string, FileInfo[]> = {};
    
    files.forEach(file => {
      const parts = file.file_path.split("/");
      if (parts.length === 1) {
        // Root level file
        if (!tree["."]) tree["."] = [];
        tree["."].push(file);
      } else {
        // In a directory
        const dir = parts.slice(0, -1).join("/");
        if (!tree[dir]) tree[dir] = [];
        tree[dir].push(file);
      }
    });

    return tree;
  };

  const toggleDir = (dir: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dir)) {
        next.delete(dir);
      } else {
        next.add(dir);
      }
      return next;
    });
  };

  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      python: "bg-yellow-100 text-yellow-800",
      javascript: "bg-yellow-100 text-yellow-800",
      typescript: "bg-blue-100 text-blue-800",
      go: "bg-cyan-100 text-cyan-800",
      rust: "bg-orange-100 text-orange-800",
      java: "bg-red-100 text-red-800",
      csharp: "bg-purple-100 text-purple-800",
      cpp: "bg-pink-100 text-pink-800",
      c: "bg-gray-100 text-gray-800",
      ruby: "bg-red-100 text-red-800",
      php: "bg-indigo-100 text-indigo-800",
      swift: "bg-orange-100 text-orange-800",
      kotlin: "bg-purple-100 text-purple-800",
      shell: "bg-green-100 text-green-800",
      markdown: "bg-gray-100 text-gray-700",
      json: "bg-gray-100 text-gray-700",
      yaml: "bg-gray-100 text-gray-700"
    };
    return colors[lang] || "bg-gray-100 text-gray-700";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Code Base</h1>
                  <p className="text-sm text-slate-500">Index GitHub repositories for RAG</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Index New Repository */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Index a GitHub Repository</h2>
          <form onSubmit={handleIndexRepo} className="flex gap-3">
            <div className="flex-1 relative">
              <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={indexing}
              />
            </div>
            <button
              type="submit"
              disabled={indexing || !repoUrl.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {indexing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Indexing...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Index Repository
                </>
              )}
            </button>
          </form>

          {/* Indexing Progress */}
          {indexingStatus && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  {indexingStatus.repo_name}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  indexingStatus.status === "completed" ? "bg-green-100 text-green-700" :
                  indexingStatus.status === "failed" ? "bg-red-100 text-red-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {indexingStatus.status}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{indexingStatus.message}</p>
              {indexingStatus.total_files > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(indexingStatus.progress / indexingStatus.total_files) * 100}%`
                    }}
                  />
                </div>
              )}
              {indexingStatus.error && (
                <p className="mt-2 text-sm text-red-600">{indexingStatus.error}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Code Bases List */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Indexed Repositories ({codebases.length})
            </h2>
            
            {codebases.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Code className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No repositories indexed yet</p>
                <p className="text-sm text-slate-400 mt-1">
                  Enter a GitHub URL above to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {codebases.map((codebase) => (
                  <div
                    key={codebase.group_id}
                    onClick={() => handleSelectCodebase(codebase)}
                    className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedCodebase?.group_id === codebase.group_id
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate">
                          {codebase.repo_name}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Files className="w-4 h-4" />
                            {codebase.file_count} files
                          </span>
                          <span className="flex items-center gap-1">
                            <FileCode className="w-4 h-4" />
                            {codebase.chunk_count} chunks
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {new Date(codebase.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({ isOpen: true, codebase });
                        }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Browser */}
          <div className="lg:col-span-2">
            {selectedCodebase ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        {selectedCodebase.repo_name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={selectedCodebase.repo_url || `https://github.com/${selectedCodebase.repo_name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          View on GitHub
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {loadingFiles ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  </div>
                ) : files.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileCode className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No files found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {Object.entries(buildFileTree(files)).map(([dir, dirFiles]) => (
                      <div key={dir}>
                        {dir !== "." && (
                          <button
                            onClick={() => toggleDir(dir)}
                            className="w-full px-4 py-2 flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            {expandedDirs.has(dir) ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span>{dir}/</span>
                            <span className="text-xs text-slate-400 ml-auto">
                              {dirFiles.length} files
                            </span>
                          </button>
                        )}
                        
                        {(dir === "." || expandedDirs.has(dir)) && dirFiles.map((file) => (
                          <div
                            key={file.file_path}
                            className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group"
                          >
                            <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900 truncate">
                                {dir === "." ? file.file_path : file.file_path.split("/").pop()}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${getLanguageColor(file.language)}`}>
                                  {file.language}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {file.chunk_count} chunks
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => setReindexModal({ isOpen: true, file })}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Reindex file"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Folder className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">
                  Select a Repository
                </h3>
                <p className="text-slate-500">
                  Choose a repository from the list to browse its files
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false })}
        title="Delete Code Base"
      >
        <div className="p-6">
          <p className="text-slate-600 mb-4">
            Are you sure you want to delete the code base for{" "}
            <span className="font-semibold text-slate-900">
              {deleteModal.codebase?.repo_name}
            </span>
            ? This will remove all indexed documents and cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteModal({ isOpen: false })}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteCodebase}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reindex File Modal */}
      <Modal
        isOpen={reindexModal.isOpen}
        onClose={() => setReindexModal({ isOpen: false })}
        title="Reindex File"
      >
        <div className="p-6">
          <p className="text-slate-600 mb-4">
            Are you sure you want to reindex{" "}
            <span className="font-semibold text-slate-900">
              {reindexModal.file?.file_path}
            </span>
            ? This will fetch the latest version from GitHub and update the vectors.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setReindexModal({ isOpen: false })}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={reindexing}
            >
              Cancel
            </button>
            <button
              onClick={handleReindexFile}
              disabled={reindexing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {reindexing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reindexing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Reindex
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}