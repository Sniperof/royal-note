import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Phone, MapPin, Loader2, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCreateCustomer, useUpdateCustomer,
  useCreateSupplier, useUpdateSupplier,
  getGetCustomersQueryKey, getGetSuppliersQueryKey,
} from "@workspace/api-client-react";
import type { ContactPerson } from "@workspace/api-client-react";

interface Neighborhood { id: number; name: string; }

async function fetchNeighborhoods(): Promise<Neighborhood[]> {
  const res = await fetch("/api/neighborhoods");
  if (!res.ok) throw new Error("Failed to fetch neighborhoods");
  return res.json();
}
async function addNeighborhood(name: string): Promise<Neighborhood> {
  const res = await fetch("/api/neighborhoods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to add neighborhood");
  return res.json();
}
async function deleteNeighborhood(id: number): Promise<void> {
  await fetch(`/api/neighborhoods/${id}`, { method: "DELETE" });
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  neighborhood: z.string().nullable().optional(),
  address_detail: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: ContactPerson | null;
  type: "customers" | "suppliers";
}

export function ContactModal({ isOpen, onClose, item, type }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!item;
  const typeLabel = type === "customers" ? "Customer" : "Supplier";

  const [phones, setPhones] = useState<string[]>([""]);
  const [showNhoodManager, setShowNhoodManager] = useState(false);
  const [newNhoodInput, setNewNhoodInput] = useState("");
  const [nhoodSaving, setNhoodSaving] = useState(false);
  const [nhoodDeleting, setNhoodDeleting] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: neighborhoods = [], refetch: refetchNeighborhoods } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: fetchNeighborhoods,
    staleTime: 60_000,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const selectedNeighborhood = watch("neighborhood");

  useEffect(() => {
    if (isOpen) {
      if (item) {
        reset({
          name: item.name,
          neighborhood: item.neighborhood ?? "",
          address_detail: item.address_detail ?? "",
          notes: item.notes ?? "",
        });
        setPhones(item.phone_numbers.length > 0 ? item.phone_numbers : [""]);
      } else {
        reset({ name: "", neighborhood: "", address_detail: "", notes: "" });
        setPhones([""]);
      }
      setShowNhoodManager(false);
      setNewNhoodInput("");
      setSubmitError(null);
    }
  }, [isOpen, item, reset]);

  const createCustomer = useCreateCustomer({
    mutation: {
      onSuccess: () => {
        setSubmitError(null);
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        onClose();
      },
      onError: (error) => {
        setSubmitError(error instanceof Error ? error.message : "Failed to save customer");
      },
    }
  });
  const updateCustomer = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        setSubmitError(null);
        queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey() });
        onClose();
      },
      onError: (error) => {
        setSubmitError(error instanceof Error ? error.message : "Failed to update customer");
      },
    }
  });
  const createSupplier = useCreateSupplier({
    mutation: {
      onSuccess: () => {
        setSubmitError(null);
        queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
        onClose();
      },
      onError: (error) => {
        setSubmitError(error instanceof Error ? error.message : "Failed to save supplier");
      },
    }
  });
  const updateSupplier = useUpdateSupplier({
    mutation: {
      onSuccess: () => {
        setSubmitError(null);
        queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
        onClose();
      },
      onError: (error) => {
        setSubmitError(error instanceof Error ? error.message : "Failed to update supplier");
      },
    }
  });

  const isLoading = createCustomer.isPending || updateCustomer.isPending || createSupplier.isPending || updateSupplier.isPending;

  const addPhone = () => setPhones(p => [...p, ""]);
  const removePhone = (i: number) => setPhones(p => p.filter((_, idx) => idx !== i));
  const updatePhone = (i: number, val: string) => setPhones(p => p.map((v, idx) => idx === i ? val : v));

  const handleAddNeighborhood = async () => {
    const name = newNhoodInput.trim();
    if (!name) return;
    setNhoodSaving(true);
    try {
      const created = await addNeighborhood(name);
      await refetchNeighborhoods();
      setValue("neighborhood", created.name);
      setNewNhoodInput("");
    } finally {
      setNhoodSaving(false);
    }
  };

  const handleDeleteNeighborhood = async (id: number) => {
    setNhoodDeleting(id);
    try {
      await deleteNeighborhood(id);
      await refetchNeighborhoods();
      if (selectedNeighborhood === neighborhoods.find(n => n.id === id)?.name) {
        setValue("neighborhood", "");
      }
    } finally {
      setNhoodDeleting(null);
    }
  };

  const onSubmit = (data: FormValues) => {
    setSubmitError(null);
    const filteredPhones = phones.filter(p => p.trim() !== "");
    const payload = {
      name: data.name,
      neighborhood: data.neighborhood || null,
      address_detail: data.address_detail || null,
      notes: data.notes || null,
      phone_numbers: filteredPhones,
    };
    if (type === "customers") {
      isEdit && item ? updateCustomer.mutate({ id: item.id, data: payload }) : createCustomer.mutate({ data: payload });
    } else {
      isEdit && item ? updateSupplier.mutate({ id: item.id, data: payload }) : createSupplier.mutate({ data: payload });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? `Edit ${typeLabel}` : `Add ${typeLabel}`}
            </h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="overflow-y-auto flex-1">
            <div className="px-6 py-5 space-y-4">
              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{submitError}</p>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("name")}
                  placeholder={`${typeLabel} name`}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              {/* Neighborhood */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    Neighborhood
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNhoodManager(v => !v)}
                    className="text-xs text-gray-400 hover:text-black flex items-center gap-1 border border-gray-200 hover:border-gray-400 px-2 py-0.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Manage list
                  </button>
                </div>

                <select
                  {...register("neighborhood")}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all bg-white"
                >
                  <option value="">— Select neighborhood —</option>
                  {neighborhoods.map(n => (
                    <option key={n.id} value={n.name}>{n.name}</option>
                  ))}
                </select>

                {/* Neighborhood manager panel */}
                <AnimatePresence>
                  {showNhoodManager && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                        {/* Add new */}
                        <div className="flex gap-2 p-3 border-b border-gray-200">
                          <input
                            type="text"
                            value={newNhoodInput}
                            onChange={e => setNewNhoodInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddNeighborhood())}
                            placeholder="New neighborhood name…"
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                          />
                          <button
                            type="button"
                            onClick={handleAddNeighborhood}
                            disabled={nhoodSaving || !newNhoodInput.trim()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                          >
                            {nhoodSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Add
                          </button>
                        </div>
                        {/* List */}
                        <div className="max-h-36 overflow-y-auto divide-y divide-gray-100">
                          {neighborhoods.length === 0 && (
                            <p className="text-center text-xs text-gray-400 py-4">No neighborhoods yet</p>
                          )}
                          {neighborhoods.map(n => (
                            <div key={n.id} className="flex items-center justify-between px-3 py-2 hover:bg-white transition-colors">
                              <span className="text-sm text-gray-700">{n.name}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteNeighborhood(n.id)}
                                disabled={nhoodDeleting === n.id}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                              >
                                {nhoodDeleting === n.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Address Detail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Detail</label>
                <textarea
                  {...register("address_detail")}
                  placeholder="Building number, floor, extra notes..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all resize-none"
                />
              </div>

              {/* Phone Numbers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Phone Numbers</label>
                  <button
                    type="button"
                    onClick={addPhone}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-black border border-gray-200 hover:border-gray-400 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add number
                  </button>
                </div>
                <div className="space-y-2">
                  {phones.map((phone, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          value={phone}
                          onChange={e => updatePhone(i, e.target.value)}
                          placeholder={`Phone ${i + 1}`}
                          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
                        />
                      </div>
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhone(i)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register("notes")}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <span>{isEdit ? "Save Changes" : `Add ${typeLabel}`}</span>
                }
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
