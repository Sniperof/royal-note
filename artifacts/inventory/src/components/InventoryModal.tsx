import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  useCreateInventoryItem, 
  useUpdateInventoryItem,
  getGetInventoryQueryKey,
  getSearchInventoryQueryKey,
  type InventoryItem,
} from "@workspace/api-client-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const MAIN_CATEGORIES = [
  { value: "perfume", label: "Perfume" },
  { value: "makeup", label: "Makeup" },
  { value: "skin_care", label: "Skin Care" },
] as const;
const CATEGORY_ALIASES = {
  perfume: "perfume",
  parfum: "perfume",
  fragrance: "perfume",
  fragrances: "perfume",
  makeup: "makeup",
  cosmetic: "makeup",
  cosmetics: "makeup",
  skin_care: "skin_care",
  skincare: "skin_care",
  "skin care": "skin_care",
} as const;
const CATEGORY_FIELD_CONFIG = {
  perfume: {
    subcategoryLabel: "Subcategory",
    subcategoryPlaceholder: "e.g. men_fragrance, women_fragrance, niche",
    sizeLabel: "Size",
    sizePlaceholder: "e.g. 100ml",
    secondaryLabel: "Concentration",
    secondaryPlaceholder: "e.g. EDP, EDT, Parfum",
    genderLabel: "Gender",
    showGender: true,
  },
  makeup: {
    subcategoryLabel: "Product Type",
    subcategoryPlaceholder: "e.g. lipstick, foundation, mascara",
    sizeLabel: "Pack Size",
    sizePlaceholder: "e.g. 30ml, 12g, 1 pc",
    secondaryLabel: "Shade / Finish",
    secondaryPlaceholder: "e.g. Nude Beige, Matte, Satin",
    genderLabel: "Target User",
    showGender: false,
  },
  skin_care: {
    subcategoryLabel: "Product Type",
    subcategoryPlaceholder: "e.g. cleanser, serum, moisturizer",
    sizeLabel: "Volume / Size",
    sizePlaceholder: "e.g. 50ml, 100ml, 75g",
    secondaryLabel: "Skin Type / Key Active",
    secondaryPlaceholder: "e.g. Oily Skin, Niacinamide, Hyaluronic Acid",
    genderLabel: "Target User",
    showGender: false,
  },
} as const;

function normalizeMainCategory(value: string | null | undefined): keyof typeof CATEGORY_FIELD_CONFIG {
  const normalized = value?.toLowerCase().trim();
  if (!normalized) return "perfume";
  return CATEGORY_ALIASES[normalized as keyof typeof CATEGORY_ALIASES] ?? "perfume";
}

const LOCATION_OPTIONS = [
  { value: "syria", label: "Syria" },
  { value: "dubai", label: "Dubai" },
] as const;

type SourceAssignment = {
  supplier_id: number;
  availability_location: "syria" | "dubai";
  is_preferred: boolean;
  last_known_cost?: number | null;
  notes?: string | null;
};

const formSchema = z.object({
  barcode: z.string().min(1, "Barcode is required"),
  brand: z.string().min(1, "Brand is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  public_price_hint: z.string().optional().nullable(),
  main_category: z.enum(["perfume", "makeup", "skin_care"]),
  sub_category: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  concentration: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  qty: z.coerce.number().min(0, "Quantity must be 0 or more"),
  cost_usd: z.coerce.number().min(0, "Cost must be 0 or more"),
  sale_price_aed: z.coerce.number().min(0, "Price must be 0 or more"),
  is_active: z.boolean(),
  is_public: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
}

export function InventoryModal({ isOpen, onClose, item }: InventoryModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!item;
  const [sourceAssignments, setSourceAssignments] = useState<SourceAssignment[]>([]);
  const [saveError, setSaveError] = useState("");
  const { data: brands = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["brands", "inventory-brand-options"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/brands`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load brands");
      const data = await res.json();
      return (data as Array<{ id: number; name: string }>).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: isOpen,
  });
  const { data: suppliers = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["suppliers", "source-options"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/suppliers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sources");
      const data = await res.json();
      return (data as Array<{ id: number; name: string }>).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      barcode: "",
      brand: "",
      name: "",
      description: "",
      public_price_hint: "",
      main_category: "perfume",
      sub_category: "",
      size: "",
      concentration: "",
      gender: "",
      qty: 0,
      cost_usd: 0,
      sale_price_aed: 0,
      is_active: true,
      is_public: false,
    },
  });

  const selectedCategory = normalizeMainCategory(watch("main_category"));
  const categoryFields = CATEGORY_FIELD_CONFIG[selectedCategory];

  useEffect(() => {
    if (item && isOpen) {
      const assignedSources = (
        item as typeof item & {
          assigned_sources?: Array<{
            id: number;
            availability_location?: string | null;
            is_preferred?: boolean;
            last_known_cost?: string | number | null;
            notes?: string | null;
          }> | null;
        }
      ).assigned_sources ?? [];

      reset({
        barcode: item.barcode,
        brand: item.brand,
        name: item.name,
        description: (item as typeof item & { description?: string }).description || "",
        public_price_hint: (item as typeof item & { public_price_hint?: string | null }).public_price_hint || "",
        main_category: normalizeMainCategory(
          (item as typeof item & { main_category?: string | null }).main_category,
        ),
        sub_category: (item as typeof item & { sub_category?: string | null }).sub_category || "",
        size: item.size || "",
        concentration: item.concentration || "",
        gender: item.gender || "",
        qty: item.qty,
        cost_usd: parseFloat(item.cost_usd),
        sale_price_aed: parseFloat(item.sale_price_aed),
        is_active: item.is_active ?? true,
        is_public: item.is_public ?? false,
      });
      setSourceAssignments(
        assignedSources.map((source) => ({
          supplier_id: source.id,
          availability_location:
            source.availability_location === "dubai" ? "dubai" : "syria",
          is_preferred: Boolean(source.is_preferred),
          last_known_cost:
            source.last_known_cost === null || source.last_known_cost === undefined
              ? null
              : Number(source.last_known_cost),
          notes: source.notes ?? "",
        })),
      );
    } else if (!isOpen) {
      reset();
      setSourceAssignments([]);
      setSaveError("");
    }
  }, [item, isOpen, reset]);

  useEffect(() => {
    if (!categoryFields.showGender && watch("gender")) {
      setValue("gender", "", { shouldDirty: true });
    }
  }, [categoryFields.showGender, setValue, selectedCategory, watch]);

  const createMutation = useCreateInventoryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getSearchInventoryQueryKey() });
        onClose();
      },
    }
  });

  const updateMutation = useUpdateInventoryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getSearchInventoryQueryKey() });
        onClose();
      },
    }
  });

  const syncSources = async (inventoryId: number) => {
    const normalizedSources = sourceAssignments
      .filter((source) => source.supplier_id > 0)
      .map((source) => ({
        ...source,
        notes: source.notes?.trim() || null,
      }));

    const res = await fetch(`${BASE_URL}/api/inventory/${inventoryId}/sources`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: normalizedSources }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to save product sources");
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setSaveError("");
      if (isEditing && item) {
        const updated = await updateMutation.mutateAsync({ id: item.id, data });
        await syncSources(updated.id);
      } else {
        const created = await createMutation.mutateAsync({ data });
        await syncSources(created.id);
      }
    } catch (error) {
      console.error("Failed to save item", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save product");
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending || isSubmitting;
  const addSource = () => {
    setSourceAssignments((prev) => [
      ...prev,
      {
        supplier_id: 0,
        availability_location: "syria",
        is_preferred: prev.length === 0,
        last_known_cost: null,
        notes: "",
      },
    ]);
  };
  const removeSource = (index: number) => {
    setSourceAssignments((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };
  const updateSource = <K extends keyof SourceAssignment>(
    index: number,
    key: K,
    value: SourceAssignment[K],
  ) => {
    setSourceAssignments((prev) =>
      prev.map((source, currentIndex) => {
        if (currentIndex !== index) return source;
        return { ...source, [key]: value };
      }),
    );
  };
  const setPreferredSource = (index: number) => {
    setSourceAssignments((prev) =>
      prev.map((source, currentIndex) => ({ ...source, is_preferred: currentIndex === index })),
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
            className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[95vh] sm:max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto">
              <form id="inventory-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Barcode */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Barcode *</label>
                    <input
                      {...register("barcode")}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all ${errors.barcode ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                      placeholder="e.g. 3145891263006"
                    />
                    {errors.barcode && <p className="text-sm text-red-500">{errors.barcode.message}</p>}
                  </div>

                  {/* Brand */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Brand *</label>
                    <input
                      {...register("brand")}
                      list="brand-options"
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all ${errors.brand ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                      placeholder="e.g. Chanel"
                    />
                    <datalist id="brand-options">
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.name} />
                      ))}
                    </datalist>
                    {errors.brand && <p className="text-sm text-red-500">{errors.brand.message}</p>}
                  </div>

                  {/* Name */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Product Name *</label>
                    <input
                      {...register("name")}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all ${errors.name ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                      placeholder="e.g. Bleu de Chanel"
                    />
                    {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                  </div>

                  {/* Description */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">
                      Short Description
                      <span className="text-gray-400 font-normal ml-1 text-xs">(shown to wholesale traders)</span>
                    </label>
                    <textarea
                      {...register("description")}
                      rows={2}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all resize-none"
                      placeholder="e.g. Iconic woody aromatic fragrance with warm cedar base…"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Main Category *</label>
                    <select
                      {...register("main_category")}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all appearance-none ${errors.main_category ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                    >
                      {MAIN_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    {errors.main_category && <p className="text-sm text-red-500">{errors.main_category.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{categoryFields.subcategoryLabel}</label>
                    <input
                      {...register("sub_category")}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      placeholder={categoryFields.subcategoryPlaceholder}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Public Price Hint</label>
                    <input
                      {...register("public_price_hint")}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      placeholder='e.g. Starting from $20'
                    />
                    <p className="text-xs text-gray-500">
                      Shown publicly only, does not affect internal pricing.
                    </p>
                  </div>

                  {/* Size */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{categoryFields.sizeLabel}</label>
                    <input
                      {...register("size")}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      placeholder={categoryFields.sizePlaceholder}
                    />
                  </div>

                  {/* Concentration */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{categoryFields.secondaryLabel}</label>
                    <input
                      {...register("concentration")}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      placeholder={categoryFields.secondaryPlaceholder}
                    />
                  </div>

                  {/* Gender */}
                  {categoryFields.showGender && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{categoryFields.genderLabel}</label>
                      <select
                        {...register("gender")}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 transition-all appearance-none"
                      >
                        <option value="">Select gender</option>
                        <option value="Men">Men</option>
                        <option value="Women">Women</option>
                        <option value="Unisex">Unisex</option>
                      </select>
                    </div>
                  )}

                  {/* Quantity */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Quantity *</label>
                    <input
                      type="number"
                      {...register("qty")}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all ${errors.qty ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                    />
                    {errors.qty && <p className="text-sm text-red-500">{errors.qty.message}</p>}
                  </div>

                  {/* Cost USD */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Cost (USD) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        {...register("cost_usd")}
                        className={`w-full pl-8 pr-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all ${errors.cost_usd ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                      />
                    </div>
                    {errors.cost_usd && <p className="text-sm text-red-500">{errors.cost_usd.message}</p>}
                  </div>

                  {/* Sale Price USD */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Sale Price (USD) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        {...register("sale_price_aed")}
                        className={`w-full pl-8 pr-4 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-black/5 transition-all ${errors.sale_price_aed ? 'border-red-500' : 'border-gray-200 focus:border-black'}`}
                      />
                    </div>
                    {errors.sale_price_aed && <p className="text-sm text-red-500">{errors.sale_price_aed.message}</p>}
                  </div>

                  <div className="space-y-3 sm:col-span-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-900">Active</label>
                            <p className="mt-1 text-xs text-gray-500">
                              Product is enabled operationally inside Royal Note.
                            </p>
                          </div>
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input type="checkbox" className="peer sr-only" {...register("is_active")} />
                            <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-black after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
                          </label>
                        </div>

                        <div className="h-px bg-gray-200" />

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-900">Public Catalogue</label>
                            <p className="mt-1 text-xs text-gray-500">
                              Product is visible on the public website when enabled.
                            </p>
                          </div>
                          <label className="relative inline-flex cursor-pointer items-center">
                            <input type="checkbox" className="peer sr-only" {...register("is_public")} />
                            <span className="h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-black after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Product Sources</label>
                        <p className="text-xs text-gray-400 mt-1">
                          Sources stay hidden from buyers. Admin uses them only for external pricing.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addSource}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Add Source
                      </button>
                    </div>

                    <div className="space-y-3">
                      {sourceAssignments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-400 text-center">
                          No sources linked yet
                        </div>
                      ) : (
                        sourceAssignments.map((source, index) => (
                          <div key={`${source.supplier_id}-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-gray-900">Source {index + 1}</p>
                              <button
                                type="button"
                                onClick={() => removeSource(index)}
                                className="text-xs text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Source Contact</label>
                                <select
                                  value={source.supplier_id || ""}
                                  onChange={(event) => updateSource(index, "supplier_id", Number(event.target.value))}
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5"
                                >
                                  <option value="">Select source</option>
                                  {suppliers.map((supplier) => (
                                    <option key={supplier.id} value={supplier.id}>
                                      {supplier.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Availability Location</label>
                                <select
                                  value={source.availability_location}
                                  onChange={(event) =>
                                    updateSource(
                                      index,
                                      "availability_location",
                                      event.target.value as "syria" | "dubai",
                                    )
                                  }
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5"
                                >
                                  {LOCATION_OPTIONS.map((location) => (
                                    <option key={location.value} value={location.value}>
                                      {location.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Last Known Cost (USD)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={source.last_known_cost ?? ""}
                                  onChange={(event) =>
                                    updateSource(
                                      index,
                                      "last_known_cost",
                                      event.target.value ? Number(event.target.value) : null,
                                    )
                                  }
                                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5"
                                  placeholder="Optional"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-600">Priority</label>
                                <button
                                  type="button"
                                  onClick={() => setPreferredSource(index)}
                                  className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                                    source.is_preferred
                                      ? "bg-black text-white border-black"
                                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                  }`}
                                >
                                  {source.is_preferred ? "Preferred Source" : "Mark as Preferred"}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-600">Internal Notes</label>
                              <textarea
                                value={source.notes ?? ""}
                                onChange={(event) => updateSource(index, "notes", event.target.value)}
                                rows={2}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                placeholder="Optional sourcing note for admin only"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 space-y-3">
              {saveError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              ) : null}

              <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={pending}
                className="px-6 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="inventory-form"
                disabled={pending}
                className="px-6 py-2.5 rounded-xl bg-black text-white font-medium hover:bg-gray-800 shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 disabled:hover:transform-none disabled:hover:shadow-none flex items-center space-x-2"
              >
                {pending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEditing ? "Save Changes" : "Create Product"}</span>
                )}
              </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
