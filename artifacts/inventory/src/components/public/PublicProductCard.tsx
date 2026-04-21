import { Link } from "wouter";
import { ArrowRight, Check, Plus } from "lucide-react";
import { usePublicRequest } from "@/context/PublicRequestContext";
import { resolveStorageUrl } from "@/lib/storage";
import type { PublicProduct } from "@/lib/publicCatalog";

function availabilityStyles(label: PublicProduct["availability_label"]) {
  if (label === "available") return "bg-[#141413] text-white";
  if (label === "limited") return "bg-[#4D49BE] text-white";
  if (label === "coming_soon") return "bg-white text-[#141413] ring-1 ring-[#EEEEEE]";
  return "bg-[#F5F5F5] text-[#949494]";
}

function availabilityText(label: PublicProduct["availability_label"]) {
  if (label === "coming_soon") return "Coming Soon";
  if (label === "limited") return "Limited";
  if (label === "available") return "Available";
  return "Unavailable";
}

export default function PublicProductCard({ product }: { product: PublicProduct }) {
  const meta = [product.size, product.concentration, product.gender].filter(Boolean).join(" · ");
  const { addItem, hasItem } = usePublicRequest();
  const selected = hasItem(product.id);

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#F5F5F5]">
        <Link href={`/catalog/${product.id}`} className="block h-full">
          {product.thumbnail_path ? (
            <img
              src={resolveStorageUrl(product.thumbnail_path)}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#FAF9F5]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#949494]">
                Royal Note
              </span>
            </div>
          )}
        </Link>
        <span
          className={`absolute left-3 top-3 inline-flex rounded-full px-[10px] py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${availabilityStyles(product.availability_label)}`}
        >
          {availabilityText(product.availability_label)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <Link href={`/catalog/${product.id}`} className="block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#949494]">
            {product.brand}
          </p>
          <h3 className="rn-display mt-1.5 text-[16px] font-semibold leading-[1.3] text-[#141413]">
            {product.name}
          </h3>
          <p className="mt-1.5 text-[12px] text-[#949494]">{meta || "B2B catalogue item"}</p>
          {product.public_price_hint ? (
            <p className="mt-2 text-[14px] font-semibold text-[#141413]">
              {product.public_price_hint}
            </p>
          ) : null}
        </Link>

        <div className="mt-auto flex items-center gap-2 border-t border-[#EEEEEE] pt-3">
          <button
            type="button"
            onClick={() => addItem(product, 1)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] transition ${
              selected
                ? "bg-[#4D49BE] text-white hover:bg-[#3d39a8]"
                : "bg-[#141413] text-white hover:bg-[#262626]"
            }`}
          >
            {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {selected ? "Add More" : "Add"}
          </button>
          <Link
            href={`/catalog/${product.id}`}
            className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#141413] transition hover:text-[#4D49BE]"
          >
            View
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
