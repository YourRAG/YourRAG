"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Loader2, 
  Activity as ActivityIcon,
  FileText,
  Search,
  MessageSquare,
  LogIn,
  Settings,
  Trash2,
  Clock
} from "lucide-react";
import { Activity, ActivityType, ActivitiesResponse } from "../../../../types";
import Pagination from "../../../../components/Pagination";

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

export default function AdminUserActivitiesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const userId = parseInt(params.id);
  
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  const pageSize = 10;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchActivities = useCallback(async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (pageNum - 1) * pageSize;
      const res = await fetch(
        `${API_URL}/admin/users/${userId}/activities?limit=${pageSize}&offset=${offset}`,
        { credentials: "include" }
      );
      
      if (res.status === 403) {
        setError("Permission denied. Admin access required.");
        return;
      }
      
      if (res.status === 404) {
        setError("User not found.");
        return;
      }
      
      if (!res.ok) {
        throw new Error("Failed to fetch activities");
      }
      
      const data: ActivitiesResponse = await res.json();
      setActivities(data.activities);
      setTotal(data.total);
      setPage(pageNum);
      setTotalPages(Math.ceil(data.total / pageSize));
    } catch (err) {
      console.error(err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [API_URL, userId]);

  useEffect(() => {
    fetchActivities(1);
  }, [fetchActivities]);

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
              <h1 className="text-2xl font-bold text-slate-900">User Activity</h1>
              <p className="text-slate-500">Viewing activity history for User ID: {userId}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600">
              <ActivityIcon className="w-5 h-5" />
              <span className="font-medium">{total} Activities</span>
            </div>
          </div>

          {error ? (
            <div className="p-12 text-center text-red-500">
              <ActivityIcon className="w-12 h-12 mx-auto mb-4 text-red-300" />
              {error}
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <ActivityIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              No activities found for this user
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100">
                {activities.map((activity) => (
                  <div key={activity.id} className="p-5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getActivityColor(activity.type)}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900">{activity.title}</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {activity.type}
                          </span>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-slate-600 mb-1">{activity.description}</p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span title={new Date(activity.createdAt).toLocaleString()}>
                            {formatRelativeTime(activity.createdAt)}
                          </span>
                        </div>
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

              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-200">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={fetchActivities}
                    isLoading={loading}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}