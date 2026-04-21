import { Link } from "wouter";
import { ArrowRight, Check, Plus } from "lucide-react";
import { usePublicRequest } from "@/context/PublicRequestContext";
import { resolveStorageUrl } from "@/lib/storage";
import type { PublicProduct } from "@/lib/publicCatalog";

function availabilityStyles(label: PublicProduct["availability_label"]) {
  if (label === "available") return "bg-[#141413] text-white";
  if (label === "limited") return "bg-[#4D49BE] text-white";
  if (label === "coming_soon") return "border border-[#E7E4DB] bg-white text-[#141413]";
  return "bg-[#F2F2F2] text-[#7C7C7C]";
}

function availabilityText(label: PublicProduct["availability_label"]) {
  if (label === "coming_soon") return "Coming Soon";
  if (label === "limited") return "Limited";
  if (label === "available") return "Available";
  return "Unavailable";
}

function imageFallbackTone(product: PublicProduct) {
  if (product.availability_label === "limited") return "from-[#F2F0F6] to-[#ECE8F4]";
  if (product.main_category === "perfume") return "from-[#F5F5F5] to-[#ECEAE4]";
  if (product.main_category === "makeup") return "from-[#F7F2F4] to-[#F1E9ED]";
  return "from-[#F4F2EC] to-[#EEE9DE]";
}

export default function PublicProductCard({ product }: { product: PublicProduct }) {
  const meta = [product.size, product.concentration, product.gender].filter(Boolean).join(" · ");
  const { addItem, hasItem } = usePublicRequest();
  const selected = hasItem(product.id);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[12px] border border-[rgba(0,0,0,0.04)] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.09)]">
      <Link href={`/catalog/${product.id}`} className="relative block">
        <div className="relative aspect-[4/3] overflow-hidden">
          {product.thumbnail_path ? (
            <img
              src={resolveStorageUrl(product.thumbnail_path)}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className={`flex h-full items-center justify-center bg-gradient-to-br ${imageFallbackTone(product)}`}>
              <div className="flex flex-col items-center gap-2">
                <div className="h-3.5 w-7 rounded-t-[3px] bg-[#A69B86]/50" />
                <div className="h-14 w-9 rounded-[4px] bg-[#C4B8A0]/70" />
              </div>
            </div>
          )}

          <span
            className={`absolute left-2 top-2 inline-flex rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-[0.1em] ${availabilityStyles(product.availability_label)}`}
          >
            {availabilityText(product.availability_label)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-[13px] pb-[14px] pt-[11px]">
        <Link href={`/catalog/${product.id}`} className="block">
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[#949494]">
            {product.brand}
          </p>
          <h3 className="rn-display mt-1 text-[17px] font-semibold leading-[1.22] text-[#141413]">
            {product.name}
          </h3>
          <p className="mt-1 text-[10px] text-[#949494]">
            {meta || "B2B catalogue item"}
          </p>
          {product.public_price_hint ? (
            <p className="mt-2 text-[12px] font-semibold text-[#141413]">
              {product.public_price_hint}
            </p>
          ) : null}
        </Link>

        <div className="mt-auto flex items-center gap-3 pt-4">
          <button
            type="button"
            onClick={() => addItem(product, 1)}
            className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] transition ${
              selected
                ? "bg-[#4D49BE] text-white hover:bg-[#3e39a6]"
                : "border border-[#EEEEEE] bg-white text-[#141413] hover:border-[#141413]"
            }`}
          >
            {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {selected ? "Selected" : "Add to Request"}
          </button>

          <Link
            href={`/catalog/${product.id}`}
            className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#141413] transition hover:text-[#4D49BE]"
          >
            View Product
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
