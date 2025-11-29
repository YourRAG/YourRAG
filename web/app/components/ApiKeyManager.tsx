"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Trash2, Copy, Plus, Calendar, Check, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiKey {
  id: number;
  key: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
}

export default function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | "never">(30);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/user/apikeys`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      } else {
        throw new Error("Failed to fetch API keys");
      }
    } catch (err) {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      let expiresAt = null;
      if (expiryDays !== "never") {
        const date = new Date();
        date.setDate(date.getDate() + (expiryDays as number));
        expiresAt = date.toISOString();
      }

      const res = await fetch(`${API_URL}/user/apikeys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: newKeyName,
          expiresAt,
        }),
      });

      if (res.ok) {
        const newKey = await res.json();
        setApiKeys([newKey, ...apiKeys]);
        setNewKeyName("");
        setIsCreating(false);
      } else {
        throw new Error("Failed to create API key");
      }
    } catch (err) {
      setError("Failed to create API key");
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) return;

    try {
      const res = await fetch(`${API_URL}/user/apikeys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        setApiKeys(apiKeys.filter((k) => k.id !== id));
      } else {
        throw new Error("Failed to delete API key");
      }
    } catch (err) {
      setError("Failed to delete API key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-slate-100 rounded-lg"></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900">API Keys</h3>
          <p className="text-sm text-slate-500">Manage your API keys for accessing the RAG API.</p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Create New Key"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreateKey} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. My App, Development, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expiration</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value === "never" ? "never" : Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value="never">Never</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Create Key
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No API keys created yet.</p>
          </div>
        ) : (
          apiKeys.map((apiKey) => (
            <div
              key={apiKey.id}
              className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-medium text-slate-900">{apiKey.name}</h4>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created: {format(new Date(apiKey.createdAt), "MMM d, yyyy")}
                    </span>
                    {apiKey.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Last used: {format(new Date(apiKey.lastUsedAt), "MMM d, yyyy HH:mm")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteKey(apiKey.id)}
                  className="text-slate-400 hover:text-red-600 transition-colors p-1"
                  title="Delete Key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                <code className="flex-1 text-sm font-mono text-slate-600 truncate">{apiKey.key}</code>
                <button
                  onClick={() => copyToClipboard(apiKey.key)}
                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                  title="Copy Key"
                >
                  {copiedKey === apiKey.key ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {apiKey.expiresAt && (
                 <div className="mt-2 text-xs text-slate-500">
                    Expires: {format(new Date(apiKey.expiresAt), "MMM d, yyyy")}
                 </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}