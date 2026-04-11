import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ShieldCheck,
  Store,
  BadgeDollarSign,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ManagedUser {
  id: number;
  username: string;
  fullName: string;
  role: "super_admin" | "wholesale_trader" | "sales_representative";
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_CONFIG = {
  super_admin: {
    label: "Super Admin",
    icon: ShieldCheck,
    bg: "bg-purple-50",
    color: "text-purple-700",
    border: "border-purple-200",
  },
  wholesale_trader: {
    label: "Wholesale Trader",
    icon: Store,
    bg: "bg-blue-50",
    color: "text-blue-700",
    border: "border-blue-200",
  },
  sales_representative: {
    label: "Sales Representative",
    icon: BadgeDollarSign,
    bg: "bg-emerald-50",
    color: "text-emerald-700",
    border: "border-emerald-200",
  },
};

function UserFormModal({
  user,
  onClose,
}: {
  user?: ManagedUser;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(user);
  const [form, setForm] = useState({
    username: user?.username ?? "",
    fullName: user?.fullName ?? "",
    role: user?.role ?? "wholesale_trader",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    isActive: user?.isActive ?? true,
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit
        ? `${BASE_URL}/api/users/${user!.id}`
        : `${BASE_URL}/api/users`;
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        role: form.role,
        email: form.email || null,
        phone: form.phone || null,
        isActive: form.isActive,
      };
      if (!isEdit) {
        body.username = form.username;
        body.password = form.password;
      } else if (form.password) {
        body.password = form.password;
      }
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const f = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="p-6 space-y-4"
        >
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.fullName}
              onChange={(e) => f("fullName", e.target.value)}
              placeholder="e.g. Ahmed Al-Rashid"
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
              required
            />
          </div>

          {/* Username — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                value={form.username}
                onChange={(e) => f("username", e.target.value)}
                placeholder="e.g. ahmed_trader"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
                required
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password{!isEdit && <span className="text-red-500"> *</span>}
              {isEdit && (
                <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={(e) => f("password", e.target.value)}
                placeholder={isEdit ? "New password..." : "Set a password"}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
                required={!isEdit}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-700"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["super_admin", "wholesale_trader", "sales_representative"] as const).map((r) => {
                const cfg = ROLE_CONFIG[r];
                const Icon = cfg.icon;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => f("role", r)}
                    className={`flex items-center gap-2 px-3.5 py-3 rounded-xl border text-sm font-medium transition-all ${
                      form.role === r
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current/30`
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => f("email", e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => f("phone", e.target.value)}
                placeholder="+971..."
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all"
              />
            </div>
          </div>

          {/* Active toggle (edit only) */}
          {isEdit && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => f("isActive", !form.isActive)}
                className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? "bg-gray-900" : "bg-gray-300"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : ""}`}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {form.isActive ? "Active" : "Inactive"}
              </span>
            </label>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : isEdit ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagementPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  const { data: users = [], isLoading } = useQuery<ManagedUser[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Delete failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
  });

  const admins = users.filter((u) => u.role === "super_admin");
  const traders = users.filter((u) => u.role === "wholesale_trader");
  const salesReps = users.filter((u) => u.role === "sales_representative");

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">User Management</h1>
              <p className="text-sm text-gray-500">{users.length} total user{users.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={() => { setEditUser(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add User</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Super Admins */}
            <UserSection
              title="Super Admins"
              role="super_admin"
              users={admins}
              currentUserId={me?.id}
              onEdit={(u) => { setEditUser(u); setShowForm(true); }}
              onDelete={(u) => setDeleteTarget(u)}
            />

            {/* Wholesale Traders */}
            <UserSection
              title="Wholesale Traders"
              role="wholesale_trader"
              users={traders}
              currentUserId={me?.id}
              onEdit={(u) => { setEditUser(u); setShowForm(true); }}
              onDelete={(u) => setDeleteTarget(u)}
            />

            <UserSection
              title="Sales Representatives"
              role="sales_representative"
              users={salesReps}
              currentUserId={me?.id}
              onEdit={(u) => { setEditUser(u); setShowForm(true); }}
              onDelete={(u) => setDeleteTarget(u)}
            />
          </>
        )}
      </div>

      {showForm && (
        <UserFormModal
          user={editUser}
          onClose={() => { setShowForm(false); setEditUser(undefined); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deleteTarget.fullName}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                ) : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserSection({
  title,
  role,
  users,
  currentUserId,
  onEdit,
  onDelete,
}: {
  title: string;
  role: "super_admin" | "wholesale_trader" | "sales_representative";
  users: ManagedUser[];
  currentUserId?: number;
  onEdit: (u: ManagedUser) => void;
  onDelete: (u: ManagedUser) => void;
}) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
          <Icon className="w-3.5 h-3.5" />
          {title}
        </span>
        <span className="text-sm text-gray-400">{users.length}</span>
      </div>

      {users.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-8 text-center text-sm text-gray-400">
          No {title.toLowerCase()} yet
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isMe={user.id === currentUserId}
              onEdit={() => onEdit(user)}
              onDelete={() => onDelete(user)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  isMe,
  onEdit,
  onDelete,
}: {
  user: ManagedUser;
  isMe: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition-colors">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-base font-bold text-gray-700 flex-shrink-0 select-none">
        {user.fullName[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{user.fullName}</span>
          {isMe && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">You</span>
          )}
        </div>
        <p className="text-xs text-gray-400 font-mono">@{user.username}</p>
        {(user.email || user.phone) && (
          <p className="text-xs text-gray-500 mt-0.5">
            {[user.email, user.phone].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {user.isActive ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">
            <XCircle className="w-3 h-3" />
            Inactive
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={isMe}
          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
