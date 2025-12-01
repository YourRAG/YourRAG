"use client";

import { useState } from "react";
import {
  Loader2,
  Play,
  Copy,
  CheckCircle2,
  BarChart3,
  FolderPlus,
  FolderEdit,
  ArrowRightLeft,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface StepStatus {
  completed: boolean;
  loading: boolean;
  result?: unknown;
  error?: string;
}

interface AdvancedApiDemoProps {
  apiKey: string;
  onAuthRequired: () => void;
}

export default function AdvancedApiDemo({ apiKey, onAuthRequired }: AdvancedApiDemoProps) {
  const [origin, setOrigin] = useState("");
  const [expanded, setExpanded] = useState(false);
  
  // Get Stats
  const [statsStatus, setStatsStatus] = useState<StepStatus>({ completed: false, loading: false });
  const [statsData, setStatsData] = useState<{ totalDocuments: number; totalGroups: number } | null>(null);
  
  // Create Group
  const [newGroupName, setNewGroupName] = useState("My New Group");
  const [createGroupStatus, setCreateGroupStatus] = useState<StepStatus>({ completed: false, loading: false });
  
  // Rename Group
  const [renameOldName, setRenameOldName] = useState("");
  const [renameNewName, setRenameNewName] = useState("");
  const [renameStatus, setRenameStatus] = useState<StepStatus>({ completed: false, loading: false });
  
  // Move Document
  const [moveDocId, setMoveDocId] = useState("");
  const [moveTargetGroup, setMoveTargetGroup] = useState("");
  const [moveStatus, setMoveStatus] = useState<StepStatus>({ completed: false, loading: false });
  
  // Batch Delete
  const [batchDeleteIds, setBatchDeleteIds] = useState("1,2,3");
  const [batchDeleteStatus, setBatchDeleteStatus] = useState<StepStatus>({ completed: false, loading: false });
  
  useState(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Get Stats
  const handleGetStats = async () => {
    if (!apiKey) {
      onAuthRequired();
      return;
    }
    
    setStatsStatus({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/stats`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to get stats");
      }
      
      const data = await res.json();
      setStatsData(data);
      setStatsStatus({ completed: true, loading: false, result: data });
    } catch (error) {
      setStatsStatus({ completed: false, loading: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  // Create Group
  const handleCreateGroup = async () => {
    if (!apiKey) {
      onAuthRequired();
      return;
    }
    if (!newGroupName.trim()) return;
    
    setCreateGroupStatus({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to create group");
      }
      
      const data = await res.json();
      setCreateGroupStatus({ completed: true, loading: false, result: data });
      setRenameOldName(newGroupName.trim());
    } catch (error) {
      setCreateGroupStatus({ completed: false, loading: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  // Rename Group
  const handleRenameGroup = async () => {
    if (!apiKey) {
      onAuthRequired();
      return;
    }
    if (!renameOldName.trim() || !renameNewName.trim()) return;
    
    setRenameStatus({ completed: false, loading: true });
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/groups/by-name/${encodeURIComponent(renameOldName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ name: renameNewName.trim() }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to rename group");
      }
      
      const data = await res.json();
      setRenameStatus({ completed: true, loading: false, result: data });
    } catch (error) {
      setRenameStatus({ completed: false, loading: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  // Move Document
  const handleMoveDocument = async () => {
    if (!apiKey) {
      onAuthRequired();
      return;
    }
    if (!moveDocId.trim()) return;
    
    setMoveStatus({ completed: false, loading: true });
    
    try {
      const body: { group_name?: string; group_id?: null } = {};
      if (moveTargetGroup.trim()) {
        body.group_name = moveTargetGroup.trim();
      } else {
        body.group_id = null;
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/documents/${moveDocId}/move`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to move document");
      }
      
      const data = await res.json();
      setMoveStatus({ completed: true, loading: false, result: data });
    } catch (error) {
      setMoveStatus({ completed: false, loading: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  // Batch Delete
  const handleBatchDelete = async () => {
    if (!apiKey) {
      onAuthRequired();
      return;
    }
    if (!batchDeleteIds.trim()) return;
    
    setBatchDeleteStatus({ completed: false, loading: true });
    
    try {
      const ids = batchDeleteIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/documents/batch`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ ids }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to batch delete");
      }
      
      const data = await res.json();
      setBatchDeleteStatus({ completed: true, loading: false, result: data });
    } catch (error) {
      setBatchDeleteStatus({ completed: false, loading: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  };

  // cURL commands
  const curlStats = `curl -X GET "${origin}/api/stats" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}"`;

  const curlCreateGroup = `curl -X POST "${origin}/api/groups" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{"name": "${newGroupName}"}'`;

  const curlRenameGroup = `curl -X PUT "${origin}/api/groups/by-name/${encodeURIComponent(renameOldName || '{old_name}')}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{"name": "${renameNewName || 'new_name'}"}'`;

  const curlMoveDocument = `curl -X PUT "${origin}/api/documents/${moveDocId || '{doc_id}'}/move" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{"group_name": "${moveTargetGroup || 'target_group'}"}'`;

  const curlBatchDelete = `curl -X DELETE "${origin}/api/documents/batch" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{"ids": [${batchDeleteIds}]}'`;

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Advanced API Operations</h3>
            <p className="text-sm text-slate-500">Stats, Group Management, Move &amp; Batch Operations</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      
      {expanded && (
        <div className="p-4 space-y-6 border-t border-slate-200">
          {/* Get Stats */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-slate-900">Get Stats</span>
                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">GET /api/stats</span>
              </div>
              <button
                onClick={handleGetStats}
                disabled={statsStatus.loading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {statsStatus.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Run
              </button>
            </div>
            
            <div className="bg-slate-900 rounded-lg p-3 group relative">
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto">{curlStats}</pre>
              <button onClick={() => copyToClipboard(curlStats)} className="absolute top-2 right-2 p-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {statsData && (
              <div className="flex gap-4">
                <div className="bg-indigo-50 rounded-lg p-3 flex-1 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{statsData.totalDocuments}</div>
                  <div className="text-xs text-slate-600">Documents</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 flex-1 text-center">
                  <div className="text-2xl font-bold text-purple-600">{statsData.totalGroups}</div>
                  <div className="text-xs text-slate-600">Groups</div>
                </div>
              </div>
            )}
            
            {statsStatus.error && <div className="text-red-600 text-sm">Error: {statsStatus.error}</div>}
          </div>

          {/* Create Group */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FolderPlus className="w-4 h-4 text-green-600" />
              <span className="font-medium text-slate-900">Create Group</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">POST /api/groups</span>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Group name"
              />
              <button
                onClick={handleCreateGroup}
                disabled={createGroupStatus.loading || !newGroupName.trim()}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createGroupStatus.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Create
              </button>
            </div>
            
            <div className="bg-slate-900 rounded-lg p-3 group relative">
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto">{curlCreateGroup}</pre>
              <button onClick={() => copyToClipboard(curlCreateGroup)} className="absolute top-2 right-2 p-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {createGroupStatus.completed && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Group created successfully!
              </div>
            )}
            {createGroupStatus.error && <div className="text-red-600 text-sm">Error: {createGroupStatus.error}</div>}
          </div>

          {/* Rename Group */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FolderEdit className="w-4 h-4 text-orange-600" />
              <span className="font-medium text-slate-900">Rename Group</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">PUT /api/groups/by-name/:name</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={renameOldName}
                onChange={(e) => setRenameOldName(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Current name"
              />
              <input
                type="text"
                value={renameNewName}
                onChange={(e) => setRenameNewName(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm"
                placeholder="New name"
              />
            </div>
            
            <button
              onClick={handleRenameGroup}
              disabled={renameStatus.loading || !renameOldName.trim() || !renameNewName.trim()}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {renameStatus.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderEdit className="w-3 h-3" />}
              Rename
            </button>
            
            <div className="bg-slate-900 rounded-lg p-3 group relative">
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto">{curlRenameGroup}</pre>
              <button onClick={() => copyToClipboard(curlRenameGroup)} className="absolute top-2 right-2 p-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {renameStatus.completed && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Group renamed successfully!
              </div>
            )}
            {renameStatus.error && <div className="text-red-600 text-sm">Error: {renameStatus.error}</div>}
          </div>

          {/* Move Document */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-slate-900">Move Document</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">PUT /api/documents/:id/move</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={moveDocId}
                onChange={(e) => setMoveDocId(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Document ID"
              />
              <input
                type="text"
                value={moveTargetGroup}
                onChange={(e) => setMoveTargetGroup(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Target group name (empty to ungroup)"
              />
            </div>
            
            <button
              onClick={handleMoveDocument}
              disabled={moveStatus.loading || !moveDocId.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {moveStatus.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
              Move
            </button>
            
            <div className="bg-slate-900 rounded-lg p-3 group relative">
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto">{curlMoveDocument}</pre>
              <button onClick={() => copyToClipboard(curlMoveDocument)} className="absolute top-2 right-2 p-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {moveStatus.completed && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Document moved successfully!
              </div>
            )}
            {moveStatus.error && <div className="text-red-600 text-sm">Error: {moveStatus.error}</div>}
          </div>

          {/* Batch Delete */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-4 h-4 text-red-600" />
              <span className="font-medium text-slate-900">Batch Delete Documents</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">DELETE /api/documents/batch</span>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={batchDeleteIds}
                onChange={(e) => setBatchDeleteIds(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-mono"
                placeholder="Document IDs (comma-separated)"
              />
              <button
                onClick={handleBatchDelete}
                disabled={batchDeleteStatus.loading || !batchDeleteIds.trim()}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {batchDeleteStatus.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Delete
              </button>
            </div>
            
            <div className="bg-slate-900 rounded-lg p-3 group relative">
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto">{curlBatchDelete}</pre>
              <button onClick={() => copyToClipboard(curlBatchDelete)} className="absolute top-2 right-2 p-1 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100">
                <Copy className="w-3 h-3" />
              </button>
            </div>
            
            {batchDeleteStatus.completed && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {(batchDeleteStatus.result as { deletedCount?: number })?.deletedCount || 0} documents deleted!
              </div>
            )}
            {batchDeleteStatus.error && <div className="text-red-600 text-sm">Error: {batchDeleteStatus.error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}