"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Users, 
  FileText, 
  Activity, 
  Search, 
  Shield, 
} from "lucide-react";
import { User } from "../types";
import Modal from "./Modal";
import UserListTable, { AdminUser } from "./UserListTable";

interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  totalActivities: number;
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
  
  // Admin list state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotalPages, setAdminTotalPages] = useState(1);
  const [adminsLoading, setAdminsLoading] = useState(true);

  // User list state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(true);

  const [search, setSearch] = useState("");
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

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: adminPage.toString(),
        page_size: "10",
        role: "ADMIN"
      });
      if (search) queryParams.append("search", search);

      const res = await fetch(`${API_URL}/admin/users?${queryParams}`, { 
        credentials: "include" 
      });
      
      if (res.ok) {
        const data: UsersResponse = await res.json();
        setAdmins(data.users);
        setAdminTotalPages(data.total_pages);
      }
    } catch (error) {
      console.error("Failed to fetch admins:", error);
    } finally {
      setAdminsLoading(false);
    }
  }, [API_URL, adminPage, search]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: userPage.toString(),
        page_size: "10",
        role: "USER"
      });
      if (search) queryParams.append("search", search);

      const res = await fetch(`${API_URL}/admin/users?${queryParams}`, { 
        credentials: "include" 
      });
      
      if (res.ok) {
        const data: UsersResponse = await res.json();
        setUsers(data.users);
        setUserTotalPages(data.total_pages);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setUsersLoading(false);
    }
  }, [API_URL, userPage, search]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchStats(), fetchAdmins(), fetchUsers()]);
  }, [fetchStats, fetchAdmins, fetchUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset pages when search changes
  useEffect(() => {
    setAdminPage(1);
    setUserPage(1);
  }, [search]);

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
        // Refresh both lists as a user's status might change
        fetchAdmins();
        fetchUsers();
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
        // Refresh both lists
        fetchAdmins();
        fetchUsers();
      }
    } catch (error) {
      console.error("Failed to unban user:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const openBanModal = (user: AdminUser) => {
    setSelectedUser(user);
    setShowBanModal(true);
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

      {/* Search Bar */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full shadow-sm"
          />
        </div>
      </div>

      {/* Admins List */}
      <UserListTable
        title="Administrators"
        icon={<Shield className="w-5 h-5 text-purple-600" />}
        users={admins}
        loading={adminsLoading}
        page={adminPage}
        totalPages={adminTotalPages}
        onPageChange={setAdminPage}
        onBanUser={openBanModal}
        onUnbanUser={handleUnbanUser}
        actionLoading={actionLoading}
        emptyMessage="No administrators found"
      />

      {/* Users List */}
      <UserListTable
        title="Users"
        icon={<Users className="w-5 h-5 text-blue-600" />}
        users={users}
        loading={usersLoading}
        page={userPage}
        totalPages={userTotalPages}
        onPageChange={setUserPage}
        onBanUser={openBanModal}
        onUnbanUser={handleUnbanUser}
        actionLoading={actionLoading}
        emptyMessage="No users found"
      />

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
              onClick={() => {
                setShowBanModal(false);
                setBanReason("");
                setSelectedUser(null);
              }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleBanUser}
              disabled={!banReason.trim() || actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Banning..." : "Ban User"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}