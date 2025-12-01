import {
  ShieldAlert,
  CheckCircle,
  Loader2,
  FileText,
  Activity
} from "lucide-react";
import Link from "next/link";
import { User } from "../types";
import Pagination from "./Pagination";

export interface AdminUser extends User {
  documentCount: number;
  banned: boolean;
  banReason?: string;
  createdAt: string;
}

interface UserListTableProps {
  title: string;
  icon: React.ReactNode;
  users: AdminUser[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onBanUser: (user: AdminUser) => void;
  onUnbanUser: (user: AdminUser) => void;
  actionLoading: boolean;
  emptyMessage?: string;
}

export default function UserListTable({
  title,
  icon,
  users,
  loading,
  page,
  totalPages,
  onPageChange,
  onBanUser,
  onUnbanUser,
  actionLoading,
  emptyMessage = "No users found"
}: UserListTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          {icon}
          {title}
        </h2>
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
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  {emptyMessage}
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
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/users/${user.id}/documents`}
                        className="text-blue-600 hover:text-blue-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Docs
                      </Link>
                      <Link
                        href={`/admin/users/${user.id}/activities`}
                        className="text-amber-600 hover:text-amber-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-1"
                      >
                        <Activity className="w-3 h-3" />
                        Activity
                      </Link>
                      {user.role !== 'ADMIN' && (
                        user.banned ? (
                          <button
                            onClick={() => onUnbanUser(user)}
                            disabled={actionLoading}
                            className="text-green-600 hover:text-green-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                          >
                            Unban
                          </button>
                        ) : (
                          <button
                            onClick={() => onBanUser(user)}
                            disabled={actionLoading}
                            className="text-red-600 hover:text-red-700 font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            Ban
                          </button>
                        )
                      )}
                    </div>
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
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}