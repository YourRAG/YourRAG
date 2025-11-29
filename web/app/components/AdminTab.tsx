"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Users, 
  FileText, 
  Activity, 
  Search, 
  Shield, 
  ShieldAlert, 
  MoreVertical,
  Ban,
  CheckCircle,
  Loader2
} from "lucide-react";
import { User } from "../types";
import Pagination from "./Pagination";
import Modal from "./Modal";

interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  totalActivities: number;
}

interface AdminUser extends User {
  documentCount: number;
  banned: boolean;
  banReason?: string;
  createdAt: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export default function AdminTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/stats`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [API_URL]);

  const fetchUsers = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        page_size: "10",
      });
      if (search) queryParams.append("search", search);

      const res = await fetch(`${API_URL}/admin/users?${queryParams}`, { 
        credentials: "include" 
      });
      
      if (res.ok) {
        const data: UsersResponse = await res.json();
        setUsers(data.users);
        setTotalPages(data.total_pages);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [API_URL, page, search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchUsers()]);
    setLoading(false);
  }, [fetchStats, fetchUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBanUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedUser.id}/ban`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason }),
        credentials: "include"
      });

      if (res.ok) {
        setShowBanModal(false);
        setBanReason("");
        setSelectedUser(null);
        fetchUsers(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to ban user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to unban ${user.username}?`)) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${user.id}/unban`, {
        method: "PUT",
        credentials: "include"
      });

      if (res.ok) {
        fetchUsers(); // Refresh list
      }
    } catch (error) {
      console.error("Failed to unban user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {stats?.totalUsers || 0}
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Documents</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {stats?.totalDocuments || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Activities</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {stats?.totalActivities || 0}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Users Management */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            User Management
          </h2>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Documents</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                            {user.username[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{user.username}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'ADMIN' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {user.documentCount}
                    </td>
                    <td className="px-6 py-4">
                      {user.banned ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <ShieldAlert className="w-3 h-3" />
                          Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role !== 'ADMIN' && (
                        user.banned ? (
                          <button
                            onClick={() => handleUnbanUser(user)}
                            disabled={actionLoading}
                            className="text-green-600 hover:text-green-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowBanModal(true);
                            }}
                            disabled={actionLoading}
                            className="text-red-600 hover:text-red-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Ban
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Ban Modal */}
      <Modal
        isOpen={showBanModal}
        onClose={() => {
          setShowBanModal(false);
          setBanReason("");
          setSelectedUser(null);
        }}
        title={`Ban User: ${selectedUser?.username}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for ban
            </label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 min-h-[100px]"
              placeholder="Enter the reason for banning this user..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowBanModal(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBanUser}
              disabled={!banReason.trim() || actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Ban User
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}