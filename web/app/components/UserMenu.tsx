"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon, Github } from "lucide-react";
import { User } from "../types";

interface UserMenuProps {
  user: User | null;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onProfileClick: () => void;
}

export default function UserMenu({
  user,
  loading,
  onLogin,
  onLogout,
  onProfileClick,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <button
        onClick={onLogin}
        className="flex items-center gap-2 p-1.5 sm:px-4 sm:py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
        aria-label="Sign in with GitHub"
      >
        <Github className="w-4 h-4 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Sign in with GitHub</span>
      </button>
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
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <div className="px-4 py-2 border-b border-slate-200">
            <p className="text-sm font-medium text-slate-900">{user.username}</p>
            {user.email && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>
          
          <button
            onClick={() => {
              onProfileClick();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <UserIcon className="w-4 h-4" />
            Your Profile
          </button>

          <button
            onClick={async () => {
              await onLogout();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}