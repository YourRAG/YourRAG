"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Database, MessageSquare, Search, Plus, List, ShieldX, Github, Lock, Sparkles, BookOpen, Zap } from "lucide-react";
import { TabType } from "./types";
import AskTab from "./components/AskTab";
import SearchTab from "./components/SearchTab";
import AddDocumentTab from "./components/AddDocumentTab";
import ManageTab from "./components/ManageTab";
import ProfileTab from "./components/ProfileTab";
import AdminTab from "./components/AdminTab";
import UserMenu from "./components/UserMenu";
import { useAuth } from "./hooks/useAuth";

function HomeContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>("ask");
  const { user, loading, login, logout, banInfo, clearBanInfo, refetch, providers } = useAuth();
  const [showBanModal, setShowBanModal] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["ask", "search", "add", "manage", "profile", "admin"].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [searchParams]);

  // Show ban modal when banInfo is set and redirect away from profile
  useEffect(() => {
    if (banInfo?.banned) {
      setShowBanModal(true);
      // Redirect away from profile tab when banned
      if (activeTab === "profile") {
        setActiveTab("ask");
      }
    }
  }, [banInfo, activeTab]);

  const handleCloseBanModal = () => {
    setShowBanModal(false);
    clearBanInfo();
  };

  // Handler for when any component detects a 403 response
  const handleUnauthorized = useCallback(async () => {
    // Refetch user to check ban status
    await refetch();
  }, [refetch]);

  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-[0.03] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

      <header className="sticky top-0 z-50 glass border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/20">
              <Database className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none tracking-tight">
                RAG <span className="hidden sm:inline">Knowledge</span>
              </h1>
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 uppercase tracking-wider">Base</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {user && (
              <nav className="flex gap-1 bg-slate-100/80 p-1 rounded-xl backdrop-blur-sm border border-slate-200/50">
                <button
                  onClick={() => setActiveTab("ask")}
                  className={`p-1.5 sm:px-4 sm:py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    activeTab === "ask"
                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Ask</span>
                </button>
                <button
                  onClick={() => setActiveTab("search")}
                  className={`p-1.5 sm:px-4 sm:py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    activeTab === "search"
                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
                <button
                  onClick={() => setActiveTab("add")}
                  className={`p-1.5 sm:px-4 sm:py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    activeTab === "add"
                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
                <button
                  onClick={() => setActiveTab("manage")}
                  className={`p-1.5 sm:px-4 sm:py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                    activeTab === "manage"
                      ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage</span>
                </button>
                {user.role === "ADMIN" && (
                  <button
                    onClick={() => setActiveTab("admin")}
                    className={`p-1.5 sm:px-4 sm:py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                      activeTab === "admin"
                        ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                    }`}
                  >
                    <ShieldX className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}
              </nav>
            )}
            
            <UserMenu
              user={user}
              loading={loading}
              onLogin={login}
              onLogout={logout}
              onProfileClick={() => setActiveTab("profile")}
              providers={providers}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 relative z-10 w-full overflow-x-hidden">
        {!user && !loading ? (
          <div className="flex flex-col items-center justify-center py-6 sm:py-24 text-center space-y-6 sm:space-y-12 animate-fade-in">
            <div className="relative hidden sm:block">
              <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl animate-pulse-slow"></div>
              <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-500/10 border border-slate-100 relative">
                <Sparkles className="w-8 h-8 sm:w-12 sm:h-12 text-blue-600" />
              </div>
            </div>
            
            <div className="space-y-3 sm:space-y-6 max-w-3xl">
              <h2 className="text-2xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                Your Personal <br className="sm:hidden" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">AI Knowledge Base</span>
              </h2>
              <p className="text-sm sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed px-4">
                Upload documents, search naturally, and get instant answers.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 w-full max-w-4xl mt-2 sm:mt-8 px-1 sm:px-4">
              <div className="glass-card p-5 sm:p-8 rounded-xl sm:rounded-2xl text-left group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-blue-100 transition-colors">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 sm:mb-3">Knowledge Base</h3>
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed">Upload your notes, articles, and documentation to build a comprehensive knowledge repository.</p>
              </div>
              
              <div className="glass-card p-5 sm:p-8 rounded-xl sm:rounded-2xl text-left group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-purple-100 transition-colors">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 sm:mb-3">Smart Search</h3>
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed">Find exactly what you need instantly using advanced semantic search powered by vector embeddings.</p>
              </div>
              
              <div className="glass-card p-5 sm:p-8 rounded-xl sm:rounded-2xl text-left group hover:-translate-y-1 transition-transform duration-300">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-green-100 transition-colors">
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2 sm:mb-3">Interactive Chat</h3>
                <p className="text-sm sm:text-base text-slate-500 leading-relaxed">Chat naturally with your documents and get accurate answers complete with source citations.</p>
              </div>
            </div>

            <div className="pt-4 sm:pt-8 animate-slide-up flex flex-col sm:flex-row gap-4 justify-center">
              {providers.includes("github") && (
                <button
                  onClick={() => login("github")}
                  className="group relative inline-flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:shadow-slate-900/20 font-medium text-base sm:text-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <Github className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                  <span className="relative z-10">Sign in with GitHub</span>
                </button>
              )}
              {providers.includes("gitee") && (
                <button
                  onClick={() => login("gitee")}
                  className="group relative inline-flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-red-600 text-white rounded-xl sm:rounded-2xl hover:bg-red-700 transition-all shadow-xl hover:shadow-2xl hover:shadow-red-600/20 font-medium text-base sm:text-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span className="relative z-10 font-bold">G</span>
                  <span className="relative z-10">Sign in with Gitee</span>
                </button>
              )}
            </div>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500">Secure access powered by OAuth</p>
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === "ask" && <AskTab />}
            {activeTab === "search" && <SearchTab />}
            {activeTab === "add" && <AddDocumentTab />}
            {activeTab === "manage" && <ManageTab />}
            {activeTab === "profile" && <ProfileTab user={user} onUnauthorized={handleUnauthorized} onUpdate={refetch} />}
            {activeTab === "admin" && user.role === "ADMIN" && <AdminTab />}
          </div>
        )}
      </div>

      {/* Ban Modal */}
      {showBanModal && banInfo && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 text-center">
              <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full">
                <ShieldX className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Account Suspended
              </h2>
              <p className="text-slate-600 mb-6">
                Your account has been suspended due to a violation of our terms of service.
              </p>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 text-left">
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm font-medium text-red-900">
                  {banInfo.reason || "No specific reason provided"}
                </p>
              </div>
              <button
                onClick={handleCloseBanModal}
                className="w-full px-6 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}