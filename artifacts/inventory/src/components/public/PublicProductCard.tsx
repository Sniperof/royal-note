import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { resolveStorageUrl } from "@/lib/storage";
import type { PublicProduct } from "@/lib/publicCatalog";

function availabilityClasses(label: PublicProduct["availability_label"]) {
  if (label === "available") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "limited") return "border-amber-200 bg-amber-50 text-amber-700";
  if (label === "coming_soon") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function availabilityText(label: PublicProduct["availability_label"]) {
  if (label === "coming_soon") return "Coming Soon";
  if (label === "limited") return "Limited";
  if (label === "available") return "Available";
  return "Unavailable";
}

export default function PublicProductCard({ product }: { product: PublicProduct }) {
  const meta = [product.size, product.concentration, product.gender].filter(Boolean).join(" / ");

  return (
    <Link
      href={`/catalog/${product.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-slate-100">
        {product.thumbnail_path ? (
          <img
            src={resolveStorageUrl(product.thumbnail_path)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_#e2e8f0,_#f8fafc_65%)]">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Royal Note</span>
          </div>
        )}
        <span
          className={`absolute left-3 top-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${availabilityClasses(product.availability_label)}`}
        >
          {availabilityText(product.availability_label)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">{product.brand}</p>
          <h3 className="mt-2 text-lg font-semibold leading-tight text-slate-950">{product.name}</h3>
          <p className="mt-2 text-sm text-slate-500">{meta || "B2B catalogue item"}</p>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">View Product</span>
          <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-700" />
        </div>
      </div>
    </Link>
  );
}
