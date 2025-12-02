"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  User as UserIcon,
  Github,
  Play,
  Code,
  Coins,
  Receipt,
  Sparkles,
} from "lucide-react";
import { User } from "../types";

interface UserMenuProps {
  user: User | null;
  loading: boolean;
  onLogin: (provider?: string) => void;
  onLogout: () => Promise<void>;
  onProfileClick: () => void;
  onDemoClick: () => void;
  providers: string[];
}

function formatCredits(credits: number): string {
  if (credits >= 10000) {
    return (credits / 1000).toFixed(1) + "k";
  }
  return credits.toLocaleString();
}

export default function UserMenu({
  user,
  loading,
  onLogin,
  onLogout,
  onProfileClick,
  onDemoClick,
  providers,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="flex gap-2">
        {providers.includes("github") && (
          <button
            onClick={() => onLogin("github")}
            className="flex items-center gap-2 p-1.5 sm:px-4 sm:py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
            aria-label="Sign in with GitHub"
          >
            <Github className="w-4 h-4 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </button>
        )}
        {providers.includes("gitee") && (
          <button
            onClick={() => onLogin("gitee")}
            className="flex items-center gap-2 p-1.5 sm:px-4 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            aria-label="Sign in with Gitee"
          >
            <span className="font-bold w-4 h-4 flex items-center justify-center">G</span>
            <span className="hidden sm:inline">Gitee</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="w-8 h-8 rounded-full border-2 border-slate-200 hover:border-blue-500 transition-colors"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            {user.username[0].toUpperCase()}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 overflow-hidden">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <p className="text-sm font-semibold text-slate-900">{user.username}</p>
            {user.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>

          {/* Credits Display */}
          <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
                  <Coins className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-amber-700 font-medium">Credits</p>
                  <p className="text-lg font-bold text-amber-900">{formatCredits(user.credits)}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  router.push("/billing");
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Recharge
              </button>
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                router.push("/billing");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Receipt className="w-4 h-4 text-slate-400" />
              <span>Billing</span>
            </button>

            <button
              onClick={() => {
                router.push("/codebase");
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Code className="w-4 h-4 text-slate-400" />
              <span>Code Base</span>
            </button>

            <button
              onClick={() => {
                onDemoClick();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Play className="w-4 h-4 text-slate-400" />
              <span>Demo</span>
            </button>

            <button
              onClick={() => {
                onProfileClick();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span>Your Profile</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100">
            <button
              onClick={async () => {
                await onLogout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}