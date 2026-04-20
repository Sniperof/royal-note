import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, Plus, Ruler, Search, Trash2, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Size = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function SizesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");

  const { data: sizes = [], isLoading } = useQuery<Size[]>({
    queryKey: ["sizes"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/sizes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sizes");
      return res.json();
    },
  });

  const createSize = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const res = await fetch(`${BASE_URL}/api/sizes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create size");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sizes"] });
      closeModal();
    },
  });

  const updateSize = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { name: string; is_active: boolean } }) => {
      const res = await fetch(`${BASE_URL}/api/sizes/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update size");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sizes"] });
      closeModal();
    },
  });

  const deleteSize = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/sizes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to delete size");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sizes"] }),
  });

  const filtered = sizes.filter(
    (s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openAdd = () => {
    setEditingSize(null);
    setName("");
    setIsActive(true);
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (size: Size) => {
    setEditingSize(size);
    setName(size.name);
    setIsActive(size.is_active);
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSize(null);
    setName("");
    setIsActive(true);
    setError("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Size name is required");
      return;
    }
    setError("");
    if (editingSize) {
      await updateSize.mutateAsync({ id: editingSize.id, payload: { name: name.trim(), is_active: isActive } });
    } else {
      await createSize.mutateAsync({ name: name.trim() });
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sizes..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-md shadow-black/10"
        >
          <Plus className="w-4 h-4" />
          <span>Add Size</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Ruler className="w-9 h-9 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{search ? "No sizes found" : "No sizes yet"}</h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            {search ? `Nothing matching "${search}".` : "Add your first size to use in product forms."}
          </p>
          {!search && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Size</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((size, index) => (
            <motion.div
              key={size.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02, duration: 0.2 }}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Ruler className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{size.name}</p>
                  <p className={`text-xs mt-0.5 ${size.is_active ? "text-green-600" : "text-gray-400"}`}>
                    {size.is_active ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => openEdit(size)}
                  className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete size "${size.name}"?`)) return;
                    deleteSize.mutate(size.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">{editingSize ? "Edit Size" : "Add Size"}</h2>
                <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Size Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                    placeholder="e.g. 100ml, 50ml, 200ml"
                    autoFocus
                  />
                </div>

                {editingSize && (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Active</p>
                      <p className="text-xs text-gray-500 mt-0.5">Inactive sizes won't appear in product forms</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-black after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                )}

                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button onClick={closeModal} className="px-6 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={createSize.isPending || updateSize.isPending}
                  className="px-6 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {editingSize ? "Save Size" : "Create Size"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
