import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Camera, Trash2, Upload, Star, TrendingUp,
  DollarSign, Package, Barcode, Ruler, Droplets, Tag,
  Calendar, ShoppingCart, AlertCircle, CheckCircle, XCircle,
  X, ZoomIn, Plus, Share2, List, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  useGetInventory,
  getProductImages,
  addProductImage,
  deleteProductImage,
  getProductStats,
} from "@workspace/api-client-react";
import type { InventoryItem } from "@workspace/api-client-react";
import WhatsAppShareModal from "../components/WhatsAppShareModal";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const GENDER_MAP: Record<string, { label: string; color: string; bg: string }> = {
  male:       { label: "Men",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  men:        { label: "Men",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  "for men":  { label: "Men",   color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  female:     { label: "Women", color: "text-pink-700",   bg: "bg-pink-50 border-pink-200" },
  women:      { label: "Women", color: "text-pink-700",   bg: "bg-pink-50 border-pink-200" },
  "for women":{ label: "Women", color: "text-pink-700",   bg: "bg-pink-50 border-pink-200" },
  unisex:     { label: "Unisex",color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
};
function genderInfo(g: string | null | undefined) {
  if (!g) return null;
  return GENDER_MAP[g.toLowerCase()] ?? { label: g, color: "text-gray-700", bg: "bg-gray-100 border-gray-200" };
}

function stockStatus(qty: number) {
  if (qty === 0) return { label: "Out of Stock", icon: XCircle, cls: "text-rose-600 bg-rose-50 border-rose-200" };
  if (qty <= 5) return { label: "Low Stock", icon: AlertCircle, cls: "text-amber-700 bg-amber-50 border-amber-200" };
  if (qty <= 15) return { label: "In Stock", icon: CheckCircle, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  return { label: "Well Stocked", icon: CheckCircle, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

function imageUrl(objectPath: string) {
  return `${BASE_URL}/api/storage${objectPath}`;
}
function categoryLabel(category: string | null | undefined) {
  if (!category) return "Uncategorized";
  if (category === "skin_care") return "Skin Care";
  return category.charAt(0).toUpperCase() + category.slice(1);
}
function locationLabel(location: string | null | undefined) {
  if (!location) return "Not set";
  if (location === "syria") return "Syria";
  if (location === "dubai") return "Dubai";
  return location;
}
function availabilityModeLabel(mode: string | null | undefined) {
  if (mode === "stock_only") return "Own Stock";
  if (mode === "source_only") return "Source Network";
  if (mode === "stock_and_source") return "Hybrid";
  return "Unavailable";
}
function resolveAvailabilityMode(product: {
  availability_mode?: string | null;
  qty?: number | null;
  assigned_source_ids?: number[];
}) {
  if (product.availability_mode) return product.availability_mode;
  const hasStock = Number(product.qty ?? 0) > 0;
  const hasSources = (product.assigned_source_ids?.length ?? 0) > 0;
  if (hasStock && hasSources) return "stock_and_source";
  if (hasStock) return "stock_only";
  if (hasSources) return "source_only";
  return "unavailable";
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const productId = parseInt(id ?? "");

  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allInventory = [] } = useGetInventory();
  interface POSource {
    supplier_name: string;
    supplier_id: number | null;
    po_id: number;
    po_number: string;
    po_type: string;
    payment_method: string;
    po_status: string;
    qty: number;
    unit_cost: string;
    shipping_share: string | null;
    is_received: boolean;
    order_date: string;
    created_at: string;
  }
  interface PLSource {
    id: number;
    supplier_name: string;
    supplier_id: number;
    offered_qty: number;
    cost_usd: string;
    suggested_sale_price_aed: string;
    availability_location?: string | null;
    notes?: string | null;
  }
  interface SourceDetail {
    po_sources: POSource[];
    price_list_sources: PLSource[];
    inventory_sources: Array<{
      id: number;
      name: string;
      availability_location?: string | null;
      is_preferred?: boolean;
      last_known_cost?: string | number | null;
      notes?: string | null;
    }>;
  }

  const [sourcesOpen, setSourcesOpen] = useState(true);

  const { data: sourceDetail } = useQuery<SourceDetail>({
    queryKey: ["inventory-sources-detail", productId],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/inventory/${productId}/sources-detail`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !isNaN(productId),
    staleTime: 30_000,
  });

  const product = (allInventory as Array<InventoryItem & {
    description?: string | null;
    main_category?: string;
    sub_category?: string | null;
    availability_mode?: "stock_only" | "source_only" | "stock_and_source" | "unavailable";
    assigned_source_ids?: number[];
    assigned_sources?: Array<{
      id: number;
      name: string;
      availability_location?: string | null;
      is_preferred?: boolean;
      last_known_cost?: string | number | null;
      notes?: string | null;
    }>;
  }>).find(p => p.id === productId);

  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["product-images", productId],
    queryFn: () => getProductImages(productId),
    enabled: !!productId,
  });

  const { data: allStats = [] } = useQuery({
    queryKey: ["product-stats"],
    queryFn: () => getProductStats(),
  });
  const stats = allStats.find(s => s.inventory_id === productId);
  const currentImage = images[selectedPhoto];
  const currentImagePath = currentImage?.object_path ?? null;

  const addImageMutation = useMutation({
    mutationFn: ({ object_path, caption }: { object_path: string; caption?: string }) =>
      addProductImage(productId, { object_path, caption: caption ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-images", productId] });
      setSelectedPhoto(images.length);
    },
  });

  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) => deleteProductImage(productId, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-images", productId] });
      setSelectedPhoto(0);
    },
  });

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError("");
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

      await addImageMutation.mutateAsync({ object_path: objectPath });
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!product) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Product not found</p>
          <button onClick={() => navigate("/")} className="mt-4 text-sm text-gray-400 hover:text-gray-700 underline">
            Back to Inventory
          </button>
        </div>
      </div>
    );
  }

  const cost = Number(product.cost_usd ?? 0);
  const salePrice = Number(product.sale_price_aed ?? 0);
  const profit = salePrice - cost;
  const margin = salePrice > 0 ? ((profit / salePrice) * 100).toFixed(1) : null;
  const qty = Number(product.qty ?? 0);
  const stock = stockStatus(qty);
  const gender = genderInfo(product.gender);

  const totalRevenue = Number(stats?.total_revenue_aed ?? 0);
  const totalProfit = Number(stats?.total_profit_aed ?? 0);
  const totalSold = Number(stats?.total_units_sold ?? 0);
  const lastSale = stats?.last_sale_price_aed ? Number(stats.last_sale_price_aed) : null;

  return (
    <div className="flex-1 bg-[#FAFAFA]">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Inventory</span>
          </button>
          <div className="flex-1 min-w-0">

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900 truncate">{product.brand} — {product.name}</h1>
              {gender && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${gender.bg} ${gender.color}`}>
                  {gender.label}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${stock.cls}`}>
                <stock.icon className="w-3.5 h-3.5" />
                {stock.label}
              </span>
            </div>
            {product.barcode && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">{product.barcode}</p>
            )}
          </div>
          {/* WhatsApp Share Button */}
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
            style={{ backgroundColor: "#25D366" }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ─────── LEFT: Photo Gallery (2 of 5 cols) ─────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Main Photo */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div
                className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center group cursor-pointer"
                onClick={() => currentImagePath && setLightbox(imageUrl(currentImagePath))}
              >
                {currentImagePath ? (
                  <>
                    <img
                      src={imageUrl(currentImagePath)}
                      alt={`${product.brand} ${product.name}`}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteImageMutation.mutate(currentImage.id!); }}
                      className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-rose-50 border border-gray-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:text-rose-600 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Camera className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 font-medium">No photos yet</p>
                    <p className="text-xs text-gray-300 mt-1">Click Add Photo to get started</p>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {images.length > 0 && (
                <div className="p-3 border-t border-gray-100">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {images.map((img, idx) => (
                      <button
                        key={img.id ?? idx}
                        onClick={() => setSelectedPhoto(idx)}
                        className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                          idx === selectedPhoto
                            ? "border-black shadow-md scale-105"
                            : "border-transparent hover:border-gray-300"
                        }`}
                      >
                        {img.object_path ? (
                          <img
                            src={imageUrl(img.object_path)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).parentElement!.style.background = "#f3f4f6"; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-black hover:bg-gray-50 transition-all flex items-center justify-center text-gray-400 hover:text-gray-700"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-2xl font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Add Photo</>
              )}
            </button>
            {uploadError && (
              <p className="text-xs text-rose-600 text-center">{uploadError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) { handleFileUpload(file); e.target.value = ""; }
              }}
            />

            {images.length > 0 && (
              <p className="text-xs text-gray-400 text-center">{images.length} photo{images.length !== 1 ? "s" : ""}</p>
            )}
          </div>

          {/* ─────── RIGHT: Info Cards (3 of 5 cols) ─────── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Pricing */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-semibold text-gray-900">Pricing</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Cost</p>
                  <p className="text-lg font-bold text-gray-900">${cost.toFixed(2)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <p className="text-xs text-emerald-700 mb-1">Sale Price</p>
                  <p className="text-lg font-bold text-emerald-800">${salePrice.toFixed(2)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${profit >= 0 ? "bg-blue-50 border border-blue-100" : "bg-rose-50 border border-rose-100"}`}>
                  <p className={`text-xs mb-1 ${profit >= 0 ? "text-blue-700" : "text-rose-700"}`}>Profit/Unit</p>
                  <p className={`text-lg font-bold ${profit >= 0 ? "text-blue-800" : "text-rose-800"}`}>
                    {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                  </p>
                </div>
                {margin !== null && (
                  <div className={`rounded-xl p-3 text-center ${parseFloat(margin) >= 0 ? "bg-violet-50 border border-violet-100" : "bg-rose-50 border border-rose-100"}`}>
                    <p className="text-xs text-violet-700 mb-1">Margin</p>
                    <p className="text-lg font-bold text-violet-800">{margin}%</p>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-semibold text-gray-900">Inventory</h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-black text-gray-900">{qty}</p>
                  <p className="text-xs text-gray-500 mt-1">Units in Stock</p>
                </div>
                <div className="flex-1">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border ${stock.cls}`}>
                    <stock.icon className="w-4 h-4" />
                    {stock.label}
                  </div>
                  {qty > 0 && cost > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Total stock value: <span className="font-semibold text-gray-900">${(qty * cost).toFixed(2)}</span>
                    </p>
                  )}
                  {qty > 0 && salePrice > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Potential revenue: <span className="font-semibold text-emerald-700">${(qty * salePrice).toFixed(2)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Product Details */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-semibold text-gray-900">Product Details</h2>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <DetailRow icon={<Barcode className="w-4 h-4" />} label="Barcode" value={product.barcode || "—"} mono />
                <DetailRow icon={<Tag className="w-4 h-4" />} label="Brand" value={product.brand} />
                <DetailRow icon={<Package className="w-4 h-4" />} label="Name" value={product.name} />
                <DetailRow icon={<Tag className="w-4 h-4" />} label="Category" value={categoryLabel(product.main_category)} />
                <DetailRow icon={<Package className="w-4 h-4" />} label="Availability Mode" value={availabilityModeLabel(resolveAvailabilityMode(product))} />
                <DetailRow icon={<Tag className="w-4 h-4" />} label="Subcategory" value={product.sub_category || "—"} />
                <DetailRow icon={<Ruler className="w-4 h-4" />} label="Size" value={product.size || "—"} />
                <DetailRow icon={<Droplets className="w-4 h-4" />} label="Type" value={product.concentration || "—"} />
                {gender && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5"><Star className="w-4 h-4" /></span>
                    <div>
                      <p className="text-xs text-gray-400">Gender</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-medium border ${gender.bg} ${gender.color}`}>
                        {gender.label}
                      </span>
                    </div>
                  </div>
                )}
                {product.created_at && (
                  <DetailRow icon={<Calendar className="w-4 h-4" />} label="Added" value={String(product.created_at).slice(0, 10)} />
                )}
                <DetailRow icon={<Package className="w-4 h-4" />} label="Description" value={product.description || "—"} />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <button
                onClick={() => setSourcesOpen(o => !o)}
                className="flex items-center justify-between w-full mb-1"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center">
                    <List className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="font-semibold text-gray-900">Sources &amp; Availability</h2>
                    <p className="text-xs text-gray-400">All POs, price lists &amp; source contacts · Admin only</p>
                  </div>
                </div>
                {sourcesOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {sourcesOpen && (
                <div className="mt-4 space-y-4">

                  {/* ── Purchase Order history ── */}
                  {(sourceDetail?.po_sources.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Purchase Orders</p>
                      <div className="space-y-2">
                        {sourceDetail!.po_sources.map((src, i) => {
                          const unitCost = Number(src.unit_cost);
                          const shippingShare = Number(src.shipping_share ?? 0);
                          const landedUnit = src.qty > 0 ? unitCost + shippingShare / src.qty : unitCost;
                          const poTypeBadge =
                            src.po_type === "capital_injection"
                              ? <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700">رأس مال</span>
                              : src.po_type === "consignment"
                              ? <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-700">كونسينيمنت</span>
                              : src.payment_method === "credit"
                              ? <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-700">آجل</span>
                              : <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700">Cash</span>;
                          const statusBadge =
                            src.po_status === "received"
                              ? <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-green-100 text-green-700">Received</span>
                              : src.po_status === "confirmed"
                              ? <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700">Confirmed</span>
                              : <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-yellow-100 text-yellow-700">Draft</span>;
                          return (
                            <div key={`po-${i}`} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{src.supplier_name ?? "—"}</p>
                                    {poTypeBadge}
                                    {statusBadge}
                                    {src.is_received && (
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700">Item Received</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{src.po_number} · {src.order_date}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-bold text-gray-900">{src.qty} units</p>
                                  <p className="text-xs text-gray-500">${unitCost.toFixed(2)}/u · Landed ${landedUnit.toFixed(2)}/u</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Price list offers ── */}
                  {(sourceDetail?.price_list_sources.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Price Lists</p>
                      <div className="space-y-2">
                        {sourceDetail!.price_list_sources.map((pl) => (
                          <div key={`pl-${pl.id}`} className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{pl.supplier_name}</p>
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">Price List</span>
                                </div>
                                {pl.availability_location && (
                                  <p className="text-xs text-gray-400 mt-0.5">{pl.availability_location}</p>
                                )}
                                {pl.notes && <p className="text-xs text-gray-400 mt-0.5">• {pl.notes}</p>}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-indigo-700">{pl.offered_qty} units offered</p>
                                <p className="text-xs text-gray-500">${Number(pl.cost_usd).toFixed(2)}/u cost</p>
                                {Number(pl.suggested_sale_price_aed) > 0 && (
                                  <p className="text-xs text-gray-500">{Number(pl.suggested_sale_price_aed).toFixed(2)} AED suggested</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Inventory source network ── */}
                  {(sourceDetail?.inventory_sources.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Source Network</p>
                      <div className="space-y-2">
                        {sourceDetail!.inventory_sources.map((source, index) => (
                          <div key={`src-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{source.name}</p>
                                  {source.is_preferred && (
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700">Preferred</span>
                                  )}
                                </div>
                                {source.availability_location && (
                                  <p className="text-xs text-gray-400 mt-0.5">{locationLabel(source.availability_location)}</p>
                                )}
                                {source.notes && <p className="text-xs text-gray-400 mt-0.5">• {source.notes}</p>}
                              </div>
                              {source.last_known_cost != null && (
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs text-gray-500">Last known cost</p>
                                  <p className="text-sm font-bold text-gray-900">${Number(source.last_known_cost).toFixed(2)}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!sourceDetail || (
                    sourceDetail.po_sources.length === 0 &&
                    sourceDetail.price_list_sources.length === 0 &&
                    sourceDetail.inventory_sources.length === 0
                  ) && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
                      <p className="text-sm text-gray-400">No sources yet for this product</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sales Stats */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h2 className="font-semibold text-gray-900">Sales Performance</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Units Sold" value={String(totalSold)} />
                <StatCard
                  label="Revenue"
                  value={totalRevenue > 0 ? `$${totalRevenue.toFixed(2)}` : "—"}
                  highlight={totalRevenue > 0 ? "emerald" : undefined}
                />
                <StatCard
                  label="Total Profit"
                  value={totalProfit !== 0 ? `$${totalProfit.toFixed(2)}` : "—"}
                  highlight={totalProfit > 0 ? "emerald" : totalProfit < 0 ? "rose" : undefined}
                />
                <StatCard
                  label="Last Sale"
                  value={lastSale ? `$${lastSale.toFixed(2)}` : "—"}
                  sub={lastSale ? "per unit" : undefined}
                />
              </div>
              {totalSold === 0 && (
                <p className="text-xs text-gray-400 text-center mt-3">
                  <ShoppingCart className="w-3.5 h-3.5 inline mr-1" />
                  This product has not been sold yet
                </p>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* WhatsApp Share Modal */}
      {showShare && (
        <WhatsAppShareModal
          product={{
            brand: product.brand,
            name: product.name,
            gender: product.gender ?? null,
            sale_price_aed: product.sale_price_aed,
            size: product.size ?? null,
            concentration: product.concentration ?? null,
          }}
          imageUrl={currentImagePath ? imageUrl(currentImagePath) : null}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="Product"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value, mono }: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className={`text-sm font-medium text-gray-900 truncate ${mono ? "font-mono text-xs" : ""}`}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "emerald" | "rose";
}) {
  const colors = {
    emerald: "text-emerald-700",
    rose: "text-rose-600",
  };
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-base font-bold ${highlight ? colors[highlight] : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
