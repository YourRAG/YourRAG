"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  FileText,
  Activity,
  Search,
  Shield,
  Settings,
  Loader2,
} from "lucide-react";
import { User } from "../types";
import Modal, { ConfirmModal } from "./Modal";
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

interface SystemConfig {
  ENABLE_ACTIVITY_TRACKING?: string;
  DISABLE_REGISTRATION?: string;
  [key: string]: string | undefined;
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
  const [showUnbanConfirm, setShowUnbanConfirm] = useState<{ isOpen: boolean; user: AdminUser | null }>({ isOpen: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);

  // System config state
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

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

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/config`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSystemConfig(data);
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
    } finally {
      setConfigLoading(false);
    }
  }, [API_URL]);

  const updateConfig = useCallback(async (key: string, value: string) => {
    setConfigSaving(true);
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: { [key]: value } }),
        credentials: "include"
      });
      if (res.ok) {
        setSystemConfig(prev => ({ ...prev, [key]: value }));
      }
    } catch (error) {
      console.error("Failed to update config:", error);
    } finally {
      setConfigSaving(false);
    }
  }, [API_URL]);

  const handleActivityTrackingToggle = () => {
    const currentValue = systemConfig.ENABLE_ACTIVITY_TRACKING === "true";
    updateConfig("ENABLE_ACTIVITY_TRACKING", (!currentValue).toString());
  };

  const handleRegistrationToggle = () => {
    const currentValue = systemConfig.DISABLE_REGISTRATION === "true";
    updateConfig("DISABLE_REGISTRATION", (!currentValue).toString());
  };

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
    await Promise.all([fetchStats(), fetchAdmins(), fetchUsers(), fetchConfig()]);
  }, [fetchStats, fetchAdmins, fetchUsers, fetchConfig]);

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

      {/* System Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Settings className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">System Settings</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Disable Registration</p>
              <p className="text-sm text-slate-500">
                Prevent new users from registering (for private/self-hosted deployments)
              </p>
            </div>
            <button
              onClick={handleRegistrationToggle}
              disabled={configLoading || configSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                systemConfig.DISABLE_REGISTRATION === "true"
                  ? "bg-red-600"
                  : "bg-slate-200"
              } ${(configLoading || configSaving) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {configSaving ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                </span>
              ) : (
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    systemConfig.DISABLE_REGISTRATION === "true"
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              )}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Activity Tracking</p>
                <p className="text-sm text-slate-500">
                  Enable or disable user activity tracking (Recent Activity feature)
                </p>
              </div>
              <button
                onClick={handleActivityTrackingToggle}
                disabled={configLoading || configSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  systemConfig.ENABLE_ACTIVITY_TRACKING === "true"
                    ? "bg-blue-600"
                    : "bg-slate-200"
                } ${(configLoading || configSaving) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {configSaving ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                  </span>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      systemConfig.ENABLE_ACTIVITY_TRACKING === "true"
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                )}
              </button>
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
        onUnbanUser={(user) => setShowUnbanConfirm({ isOpen: true, user })}
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
        onUnbanUser={(user) => setShowUnbanConfirm({ isOpen: true, user })}
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

      <ConfirmModal
        isOpen={showUnbanConfirm.isOpen}
        onClose={() => setShowUnbanConfirm({ isOpen: false, user: null })}
        onConfirm={() => {
          if (showUnbanConfirm.user) {
            handleUnbanUser(showUnbanConfirm.user);
          }
        }}
        title="Unban User"
        message={`Are you sure you want to unban ${showUnbanConfirm.user?.username}?`}
        confirmText="Unban User"
        variant="primary"
      />
    </div>
  );
}