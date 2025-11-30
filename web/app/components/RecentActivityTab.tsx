"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, ActivityType } from "../types";
import { Clock, Activity as ActivityIcon, Loader2, RefreshCw, FileText, Search, MessageSquare, LogIn, Settings, Trash2 } from "lucide-react";
import Pagination from "./Pagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case "DOCUMENT_ADD":
    case "DOCUMENT_UPDATE":
      return <FileText className="w-4 h-4 text-green-600" />;
    case "DOCUMENT_DELETE":
      return <Trash2 className="w-4 h-4 text-red-600" />;
    case "SEARCH":
      return <Search className="w-4 h-4 text-blue-600" />;
    case "RAG_QUERY":
      return <MessageSquare className="w-4 h-4 text-purple-600" />;
    case "LOGIN":
      return <LogIn className="w-4 h-4 text-slate-600" />;
    case "SYSTEM":
      return <Settings className="w-4 h-4 text-orange-600" />;
    default:
      return <ActivityIcon className="w-4 h-4 text-slate-600" />;
  }
};

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case "DOCUMENT_ADD":
    case "DOCUMENT_UPDATE":
      return "bg-green-50 border-green-100";
    case "DOCUMENT_DELETE":
      return "bg-red-50 border-red-100";
    case "SEARCH":
      return "bg-blue-50 border-blue-100";
    case "RAG_QUERY":
      return "bg-purple-50 border-purple-100";
    case "LOGIN":
      return "bg-slate-50 border-slate-100";
    case "SYSTEM":
      return "bg-orange-50 border-orange-100";
    default:
      return "bg-slate-50 border-slate-100";
  }
};

export default function RecentActivityTab() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const fetchActivities = useCallback(async (pageNum: number, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const offset = (pageNum - 1) * pageSize;
      const res = await fetch(`${API_URL}/activities?limit=${pageSize}&offset=${offset}`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch activities");
      }

      const data = await res.json();
      setActivities(data.activities || []);
      setTotal(data.total || 0);
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities(1);
  }, [fetchActivities]);

  const handleRefresh = () => {
    fetchActivities(1, true);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Recent Activity</h2>
          <p className="text-slate-500 mt-1">Track your interactions and history.</p>
        </div>
        <div className="flex items-center gap-2">
          {activities.length > 0 && (
            <button
              onClick={async () => {
                if (confirm("Are you sure you want to clear all activity history?")) {
                  try {
                    const res = await fetch(`${API_URL}/activities`, {
                      method: "DELETE",
                      credentials: "include",
                    });
                    if (res.ok) {
                      handleRefresh();
                    }
                  } catch (err) {
                    console.error("Failed to clear activities:", err);
                  }
                }
              }}
              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
              title="Clear History"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !refreshing ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 border-dashed">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => fetchActivities(page)}
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200 border-dashed">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4">
            <ActivityIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No activity yet</h3>
          <p className="text-slate-500">Your actions will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {activities.map((activity) => (
                <div key={activity.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {activity.title}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(activity.createdAt)}</span>
                        </div>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {activity.description}
                        </p>
                      )}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(activity.metadata).map(([key, value]) => (
                            <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchActivities(p)}
            isLoading={loading || refreshing}
          />
        </div>
      )}
    </div>
  );
}