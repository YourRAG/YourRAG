"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User, Activity, UserStats } from "../types";
import { Github, Mail, Calendar, User as UserIcon, Shield, Activity as ActivityIcon, MapPin, Clock, FileText, Search, Database, Loader2, RefreshCw, Settings, Save, Key } from "lucide-react";
import ApiKeyManager from "./ApiKeyManager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ProfileTabProps {
  user: User | null;
  onUnauthorized?: () => void;
  onUpdate?: () => void;
}

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

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k+";
  }
  return num.toString();
}

export default function ProfileTab({ user, onUnauthorized, onUpdate }: ProfileTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topK, setTopK] = useState(user?.topK || 5);
  const [similarityThreshold, setSimilarityThreshold] = useState(user?.similarityThreshold || 0.8);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  
  // System Config State
  const [systemConfig, setSystemConfig] = useState<Record<string, string>>({});
  const [isSavingSystemConfig, setIsSavingSystemConfig] = useState(false);
  const [systemConfigMessage, setSystemConfigMessage] = useState("");
  const [activeInstances, setActiveInstances] = useState<string[]>([]);
  
  const hasFetched = useRef(false);

  useEffect(() => {
    if (user) {
      if (user.topK !== undefined) setTopK(user.topK);
      if (user.similarityThreshold !== undefined) setSimilarityThreshold(user.similarityThreshold);
    }
  }, [user]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSavingSettings(true);
    setSettingsMessage("");

    try {
      const res = await fetch(`${API_URL}/user/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ topK, similarityThreshold }),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      setSettingsMessage("Settings saved successfully!");
      setTimeout(() => setSettingsMessage(""), 3000);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSettingsMessage("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveSystemConfig = async () => {
    if (!user || user.role !== "ADMIN") return;
    setIsSavingSystemConfig(true);
    setSystemConfigMessage("");

    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ configs: systemConfig }),
      });

      if (!res.ok) throw new Error("Failed to update system config");

      setSystemConfigMessage("System config saved successfully!");
      setTimeout(() => setSystemConfigMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save system config:", err);
      setSystemConfigMessage("Failed to save system config.");
    } finally {
      setIsSavingSystemConfig(false);
    }
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user) return;
    
    if (isRefresh) {
      setRefreshing(true);
    }
    setError(null);
    
    try {
      const [activitiesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/activities?limit=10`, { credentials: "include" }),
        fetch(`${API_URL}/user/stats`, { credentials: "include" })
      ]);

      // Check for 403 (banned) response
      if (activitiesRes.status === 403 || statsRes.status === 403) {
        onUnauthorized?.();
        return;
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData.activities || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch system config and instances if admin
      if (user.role === "ADMIN") {
        const [configRes, instancesRes] = await Promise.all([
          fetch(`${API_URL}/admin/config`, { credentials: "include" }),
          fetch(`${API_URL}/system/instances`, { credentials: "include" })
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setSystemConfig(configData);
        }

        if (instancesRes.ok) {
          const instancesData = await instancesRes.json();
          setActiveInstances(instancesData.instances || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch profile data:", err);
      setError("Failed to load profile data");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [user, onUnauthorized]);

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchData(false);
    }
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="w-20 h-20 bg-slate-100 flex items-center justify-center mb-6">
          <UserIcon className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Guest User</h3>
        <p className="text-slate-500 max-w-xs text-center">
          Please sign in to access your profile and manage your settings.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Main Profile Card */}
      <div className="bg-white shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-200 rounded-2xl">
        {/* Cover Image */}
        <div className="h-48 bg-gradient-to-r from-slate-800 to-slate-900 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        </div>

        <div className="px-4 sm:px-8 pb-8">
          {/* Header Section */}
          <div className="relative flex flex-col items-center sm:flex-row -mt-12 sm:-mt-16 mb-6 gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-white shadow-lg overflow-hidden bg-white relative z-10 rounded-2xl">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl sm:text-4xl font-bold text-slate-400">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-20 w-3 h-3 sm:w-4 sm:h-4 bg-green-500 border-2 border-white shadow-sm" title="Online"></div>
            </div>

            {/* Header Info */}
            <div className="flex-1 text-center sm:text-left w-full sm:pt-16 sm:pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2 sm:mb-1 justify-center sm:justify-start">
                <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight truncate max-w-[200px] sm:max-w-md mx-auto sm:mx-0">{user.username}</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-semibold border border-slate-200 self-center sm:self-auto shrink-0 uppercase tracking-wider">
                  <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {user.role === "ADMIN" ? "Administrator" : "Pro Member"}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-slate-500 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>San Francisco, CA</span>
                </div>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span>Product Designer</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="w-full sm:w-auto mt-2 sm:mt-0 sm:pt-16 sm:self-start">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all hover:shadow-lg hover:shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95 uppercase tracking-wide disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
                </button>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Left Column - Info */}
            <div className="space-y-6">
                {/* System Config Card (Admin Only) */}
                {user.role === "ADMIN" && (
                  <>
                    {/* Active Instances Card */}
                    <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <ActivityIcon className="w-4 h-4 text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Instances</h3>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Total Instances</span>
                          <span className="text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {activeInstances.length}
                          </span>
                        </div>
                        
                        {activeInstances.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {activeInstances.map((instance, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="font-mono truncate" title={instance}>{instance}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No active instances found</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Configuration</h3>
                      </div>
                      
                      <div className="space-y-4">
                      {[
                        "EMBEDDING_API_URL",
                        "EMBEDDING_API_KEY",
                        "EMBEDDING_MODEL_NAME",
                        "EMBEDDING_VECTOR_DIMENSION",
                        "LLM_API_URL",
                        "LLM_API_KEY",
                        "LLM_MODEL_NAME",
                        "RAG_SYSTEM_PROMPT"
                      ].map((key) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-slate-700 mb-1 truncate" title={key}>
                            {key}
                          </label>
                          {key === "RAG_SYSTEM_PROMPT" ? (
                            <textarea
                              value={systemConfig[key] || ""}
                              onChange={(e) => setSystemConfig(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all min-h-[100px]"
                              placeholder={`Enter ${key}`}
                            />
                          ) : (
                            <input
                              type={key.includes("KEY") ? "password" : "text"}
                              value={systemConfig[key] || ""}
                              onChange={(e) => setSystemConfig(prev => ({ ...prev, [key]: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              placeholder={`Enter ${key}`}
                            />
                          )}
                        </div>
                      ))}

                      <div className="pt-2">
                        <button
                          onClick={handleSaveSystemConfig}
                          disabled={isSavingSystemConfig}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSavingSystemConfig ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save System Config
                        </button>
                        {systemConfigMessage && (
                          <p className={`text-xs text-center mt-2 ${systemConfigMessage.includes("Failed") ? "text-red-500" : "text-green-500"}`}>
                            {systemConfigMessage}
                          </p>
                        )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* API Keys Card */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Key className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">API Access</h3>
                  </div>
                  <ApiKeyManager />
                </div>

                {/* Settings Card */}
                <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-4 h-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">RAG Settings</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Top K Results
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        Number of relevant documents to retrieve for each query.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          value={topK}
                          onChange={(e) => setTopK(parseInt(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-sm font-mono font-medium text-slate-900 w-8 text-center">
                          {topK}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Similarity Threshold
                      </label>
                      <p className="text-xs text-slate-500 mb-3">
                        Minimum similarity score (0-1) for documents to be considered relevant. Higher means stricter.
                      </p>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={similarityThreshold}
                          onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-sm font-mono font-medium text-slate-900 w-10 text-center">
                          {similarityThreshold.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleSaveSettings}
                        disabled={isSavingSettings || (topK === user?.topK && similarityThreshold === user?.similarityThreshold)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSavingSettings ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save Settings
                      </button>
                      {settingsMessage && (
                        <p className={`text-xs text-center mt-2 ${settingsMessage.includes("Failed") ? "text-red-500" : "text-green-500"}`}>
                          {settingsMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-6 border border-slate-200 rounded-xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Contact Information</h3>
                    <div className="space-y-5">
                        <div className="flex items-center gap-4 group">
                            <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:border-slate-300 transition-all shadow-sm rounded-lg">
                                <Github className="w-5 h-5" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-xs text-slate-500 font-medium mb-0.5 uppercase tracking-wide">GitHub ID</p>
                                <p className="text-sm font-semibold text-slate-900 truncate" title={user.githubId}>{user.githubId}</p>
                            </div>
                        </div>
                        
                        {user.email && (
                            <div className="flex items-center gap-4 group">
                                <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:border-slate-300 transition-all shadow-sm rounded-lg">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-xs text-slate-500 font-medium mb-0.5 uppercase tracking-wide">Email Address</p>
                                    <p className="text-sm font-semibold text-slate-900 truncate" title={user.email}>{user.email}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4 group">
                            <div className="w-10 h-10 bg-white border border-slate-200 flex items-center justify-center text-slate-500 group-hover:text-slate-900 group-hover:border-slate-300 transition-all shadow-sm rounded-lg">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium mb-0.5 uppercase tracking-wide">Member Since</p>
                                <p className="text-sm font-semibold text-slate-900">November 2025</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column - Stats & Activity */}
            <div className="lg:col-span-2 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-white p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 col-span-2 sm:col-span-1 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Documents</p>
                            <FileText className="w-4 h-4 text-slate-400" />
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {initialLoading ? "-" : formatNumber(stats?.documentCount || 0)}
                        </p>
                        <div className="mt-2 flex items-center text-xs text-green-600 font-medium bg-green-50 inline-block px-2 py-1 rounded-md">
                            <span>Added</span>
                        </div>
                    </div>
                    <div className="bg-white p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Queries</p>
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {initialLoading ? "-" : formatNumber(stats?.queryCount || 0)}
                        </p>
                        <div className="mt-2 flex items-center text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-1 rounded-md">
                            <span>RAG</span>
                        </div>
                    </div>
                    <div className="bg-white p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Searches</p>
                            <Database className="w-4 h-4 text-slate-400" />
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {initialLoading ? "-" : formatNumber(stats?.searchCount || 0)}
                        </p>
                        <div className="mt-2 flex items-center text-xs text-slate-600 font-medium bg-slate-50 inline-block px-2 py-1 rounded-md">
                            <span>Total</span>
                        </div>
                    </div>
                </div>

                {/* Recent Activity Timeline */}
                <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                        <div className="flex items-center gap-2">
                          {stats && (
                            <span className="text-xs text-slate-500">
                              {stats.totalActivities} total
                            </span>
                          )}
                        </div>
                    </div>
                    
                    {initialLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                      </div>
                    ) : error ? (
                      <div className="text-center py-8 text-slate-500">
                        <p>{error}</p>
                        <button
                          onClick={handleRefresh}
                          className="mt-2 text-sm text-slate-600 hover:text-slate-900"
                        >
                          Try again
                        </button>
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <ActivityIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p className="font-medium">No activity yet</p>
                        <p className="text-sm mt-1">Your actions will appear here</p>
                      </div>
                    ) : (
                      <div className="relative pl-4 border-l border-slate-200 space-y-8">
                        {activities.map((activity) => (
                          <div key={activity.id} className="relative">
                            <div className="absolute -left-[21px] top-1.5 w-3 h-3 bg-white border-2 border-slate-300"></div>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{activity.title}</p>
                                    {activity.description && (
                                      <p className="text-xs text-slate-500 mt-1">{activity.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatRelativeTime(activity.createdAt)}</span>
                                </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}