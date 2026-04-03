import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, ImagePlus, Plus, Search, Tag, Trash2, Upload, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Brand = {
  id: number;
  name: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

function imageUrl(path?: string | null) {
  return path ? `${BASE_URL}/api/storage${path}` : "";
}

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const { data: brands = [], isLoading } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/brands`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load brands");
      return res.json();
    },
  });

  const createBrand = useMutation({
    mutationFn: async (payload: { name: string; image_path: string | null }) => {
      const res = await fetch(`${BASE_URL}/api/brands`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to create brand");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      closeModal();
    },
  });

  const updateBrand = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { name: string; image_path: string | null } }) => {
      const res = await fetch(`${BASE_URL}/api/brands/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to update brand");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      closeModal();
    },
  });

  const deleteBrand = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/brands/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to delete brand");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    },
  });

  const filtered = brands.filter((brand) =>
    !search.trim() || brand.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openAdd = () => {
    setEditingBrand(null);
    setName("");
    setImagePath(null);
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setImagePath(brand.image_path);
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBrand(null);
    setName("");
    setImagePath(null);
    setUploading(false);
    setError("");
  };

  async function handleFileUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const urlRes = await fetch(`${BASE_URL}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to upload image");
      }

      setImagePath(objectPath);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Brand name is required");
      return;
    }

    setError("");
    if (editingBrand) {
      await updateBrand.mutateAsync({ id: editingBrand.id, payload: { name: name.trim(), image_path: imagePath } });
      return;
    }
    await createBrand.mutateAsync({ name: name.trim(), image_path: imagePath });
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
            placeholder="Search brands..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-md shadow-black/10"
        >
          <Plus className="w-4 h-4" />
          <span>Add Brand</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-60">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <Tag className="w-9 h-9 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{search ? "No brands found" : "No brands yet"}</h3>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            {search ? `Nothing matching "${search}".` : "Start by creating your first premium brand."}
          </p>
          {!search && (
            <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
              <Plus className="w-4 h-4" />
              <span>Add Brand</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((brand, index) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="aspect-square rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center mb-3">
                {brand.image_path ? (
                  <img src={imageUrl(brand.image_path)} alt={brand.name} className="w-full h-full object-cover" />
                ) : (
                  <Tag className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-slate-900 leading-5">
                  {brand.name}
                </p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(brand)}
                    className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Delete brand "${brand.name}"?`)) return;
                      deleteBrand.mutate(brand.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
              className="relative w-full max-w-xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">{editingBrand ? "Edit Brand" : "Add Brand"}</h2>
                <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Brand Name *</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                    placeholder="e.g. Chanel"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Brand Image</label>
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-28 h-28 rounded-2xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
                        {imagePath ? (
                          <img src={imageUrl(imagePath)} alt={name || "Brand"} className="w-full h-full object-cover" />
                        ) : (
                          <ImagePlus className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
                        >
                          {uploading ? <Upload className="w-4 h-4 animate-pulse" /> : <Upload className="w-4 h-4" />}
                          {uploading ? "Uploading..." : "Upload Image"}
                        </button>
                        {imagePath ? (
                          <button
                            type="button"
                            onClick={() => setImagePath(null)}
                            className="block text-xs text-red-500 hover:text-red-700"
                          >
                            Remove image
                          </button>
                        ) : null}
                        <p className="text-xs text-gray-400">Use a clean square logo or brand image for best results.</p>
                      </div>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleFileUpload(file);
                        event.target.value = "";
                      }
                    }}
                  />
                </div>

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
                  disabled={createBrand.isPending || updateBrand.isPending || uploading}
                  className="px-6 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors disabled:opacity-60"
                >
                  {editingBrand ? "Save Brand" : "Create Brand"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
