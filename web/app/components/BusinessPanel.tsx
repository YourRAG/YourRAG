"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Calendar,
  DollarSign,
  CheckSquare,
  Square,
  Users,
  Loader2,
  CreditCard,
  RefreshCw,
  ArrowRight,
  History,
  Trash2,
  AlertCircle
} from "lucide-react";
import { AdminUser } from "./UserListTable";
import Modal, { ConfirmModal } from "./Modal";
import { Transaction } from "../types";

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface BusinessPanelProps {
  apiUrl: string;
}

export default function BusinessPanel({ apiUrl }: BusinessPanelProps) {
  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [minCredits, setMinCredits] = useState("");
  const [maxCredits, setMaxCredits] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [role, setRole] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Action state
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionAmount, setActionAmount] = useState("");
  const [actionDescription, setActionDescription] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Transaction History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [targetUser, setTargetUser] = useState<AdminUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deleteTransactionId, setDeleteTransactionId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        page_size: "50", // Larger page size for bulk operations
      });
      
      if (role) queryParams.append("role", role);
      if (search) queryParams.append("search", search);
      if (minCredits) queryParams.append("minCredits", minCredits);
      if (maxCredits) queryParams.append("maxCredits", maxCredits);
      
      // Format dates to ISO strings if present
      if (startDate) {
        queryParams.append("startDate", new Date(startDate).toISOString());
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        queryParams.append("endDate", end.toISOString());
      }

      const res = await fetch(`${apiUrl}/admin/users?${queryParams}`, {
        credentials: "include"
      });
      
      if (res.ok) {
        const data: UsersResponse = await res.json();
        setUsers(data.users);
        setTotalPages(data.total_pages);
        setTotalUsers(data.total);
        // Reset selection when filters change
        if (page === 1) {
          setSelectedUserIds([]);
          setSelectAll(false);
        }
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, page, search, minCredits, maxCredits, startDate, endDate]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, minCredits, maxCredits, startDate, endDate, role]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedUserIds, userId];
      setSelectedUserIds(newSelected);
      if (newSelected.length === users.length) {
        setSelectAll(true);
      }
    }
  };

  const handleBatchAction = async () => {
    if (!actionAmount || !actionDescription || selectedUserIds.length === 0) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/credits/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedUserIds,
          amount: parseInt(actionAmount),
          description: actionDescription
        }),
        credentials: "include"
      });

      if (res.ok) {
        setShowActionModal(false);
        setActionAmount("");
        setActionDescription("");
        setSelectedUserIds([]);
        setSelectAll(false);
        fetchUsers();
      }
    } catch (error) {
      console.error("Failed to execute batch action:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const fetchTransactions = async (userId: number) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${apiUrl}/credits/admin/user/${userId}/transactions?limit=100`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistoryModal = (user: AdminUser) => {
    setTargetUser(user);
    setShowHistoryModal(true);
    fetchTransactions(user.id);
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransactionId || !targetUser) return;

    try {
      const res = await fetch(`${apiUrl}/admin/transactions/${deleteTransactionId}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (res.ok) {
        setDeleteTransactionId(null);
        fetchTransactions(targetUser.id);
      }
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Stats */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Business Panel</h2>
            </div>
            <p className="text-slate-500 max-w-2xl">
              Manage user credits and perform batch operations. Filter users by multiple criteria
              and apply credit adjustments with transaction records.
            </p>
          </div>
          
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-center">
              <div className="text-sm font-medium text-slate-500">Selected Users</div>
              <div className="text-2xl font-bold text-indigo-600">{selectedUserIds.length}</div>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="text-center">
              <div className="text-sm font-medium text-slate-500">Total Users</div>
              <div className="text-2xl font-bold text-slate-900">{totalUsers}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1 flex gap-3">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl border transition-colors flex items-center gap-2 text-sm font-medium ${
                showFilters 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setShowActionModal(true)}
              disabled={selectedUserIds.length === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Adjust Credits ({selectedUserIds.length})
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Registration Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Credits Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minCredits}
                  onChange={(e) => setMinCredits(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxCredits}
                  onChange={(e) => setMaxCredits(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-500">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Roles</option>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div className="flex items-end justify-end">
              <button
                onClick={() => {
                  setSearch("");
                  setMinCredits("");
                  setMaxCredits("");
                  setStartDate("");
                  setEndDate("");
                  setRole("");
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-2 hover:bg-slate-200/50 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {selectAll ? (
                      <CheckSquare className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">User Details</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Credits</th>
                <th className="px-6 py-4">Documents</th>
                <th className="px-6 py-4">Registration Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found matching your criteria
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      selectedUserIds.includes(user.id) ? "bg-indigo-50/30" : ""
                    }`}
                    onClick={() => handleSelectUser(user.id)}
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleSelectUser(user.id)}
                        className="flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {selectedUserIds.includes(user.id) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                            {user.username[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">{user.username}</div>
                          <div className="text-xs text-slate-500">{user.email || "No email"}</div>
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
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {user.credits.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {user.documentCount}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                      <span className="text-slate-400 text-xs block">
                        {new Date(user.createdAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openHistoryModal(user)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Transaction History"
                      >
                        <History className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Simple Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="px-3 py-1 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      <Modal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        title="Batch Credit Adjustment"
      >
        <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-900">Target Users</span>
                </div>
                <p className="text-sm text-blue-700">
                    You are about to adjust credits for <span className="font-bold">{selectedUserIds.length}</span> selected user(s).
                </p>
            </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount (Positive to add, Negative to deduct)
            </label>
            <input
              type="number"
              value={actionAmount}
              onChange={(e) => setActionAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="e.g., 100 or -50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Transaction Description (Required)
            </label>
            <textarea
              value={actionDescription}
              onChange={(e) => setActionDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[80px]"
              placeholder="Reason for adjustment (e.g., 'Promotional Bonus' or 'Monthly Service Fee')"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowActionModal(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleBatchAction}
              disabled={!actionAmount || !actionDescription || actionLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm Adjustment
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Transaction History: ${targetUser?.username}`}
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700">
              Only transaction records are deleted. User credit balances are <strong>NOT</strong> automatically adjusted.
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {loadingHistory ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No transactions found for this user.
              </div>
            ) : (
                <div className="space-y-3 pb-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between group hover:border-slate-300 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                tx.amount > 0 ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"
                            }`}>
                                {tx.type}
                            </span>
                            <span className="text-xs text-slate-400">
                                {new Date(tx.createdAt).toLocaleString()}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className={`font-mono font-bold ${
                            tx.amount > 0 ? "text-green-600" : "text-slate-900"
                        }`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount}
                        </span>
                        <button
                            onClick={() => setDeleteTransactionId(tx.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Transaction Record"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTransactionId}
        onClose={() => setDeleteTransactionId(null)}
        onConfirm={handleDeleteTransaction}
        title="Delete Transaction Record"
        message="Are you sure you want to delete this transaction record? This action ONLY deletes the history log and does NOT affect the user's current credit balance."
        confirmText="Delete Record"
        variant="danger"
      />
    </div>
  );
}