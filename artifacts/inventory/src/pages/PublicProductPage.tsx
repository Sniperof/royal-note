import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, Minus, Plus, RefreshCcw } from "lucide-react";
import PublicProductCard from "@/components/public/PublicProductCard";
import { usePublicRequest } from "@/context/PublicRequestContext";
import { publicProductUrl, type PublicProductDetailResponse } from "@/lib/publicCatalog";
import { resolveStorageUrl } from "@/lib/storage";

function setDocumentMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function availabilityStyles(label: PublicProductDetailResponse["availability_label"]) {
  if (label === "available") return "bg-[#141413] text-white";
  if (label === "limited") return "bg-[#4D49BE] text-white";
  if (label === "coming_soon") return "bg-white text-[#141413] ring-1 ring-[#EEEEEE]";
  return "bg-[#F5F5F5] text-[#949494]";
}

function availabilityText(label: PublicProductDetailResponse["availability_label"]) {
  if (label === "coming_soon") return "Coming Soon";
  if (label === "limited") return "Limited";
  if (label === "available") return "Available";
  return "Unavailable";
}

function ProductLoadingState() {
  return (
    <div className="rn-public min-h-screen px-4 py-10 pb-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="h-4 w-36 animate-pulse rounded-full bg-[#F5F5F5]" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-[16px] border border-[#EEEEEE] bg-white p-4">
            <div className="aspect-[4/5] animate-pulse rounded-[12px] bg-[#F5F5F5]" />
          </div>
          <div className="space-y-6">
            <div className="rounded-[16px] border border-[#EEEEEE] bg-white p-6">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[#F5F5F5]" />
              <div className="mt-4 h-10 w-3/4 animate-pulse rounded-full bg-[#F5F5F5]" />
              <div className="mt-4 h-8 w-32 animate-pulse rounded-full bg-[#F5F5F5]" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-lg bg-[#FAF9F5] px-4 py-3">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-[#F5F5F5]" />
                    <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-[#F5F5F5]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicProductPage() {
  const [, params] = useRoute("/catalog/:id");
  const productId = params?.id ? Number(params.id) : null;
  const { addItem, hasItem, getQty, setQty } = usePublicRequest();

  const { data, isLoading, isError, error, refetch } = useQuery<PublicProductDetailResponse>({
    queryKey: ["public-product", productId],
    enabled: productId !== null && Number.isInteger(productId),
    queryFn: async () => {
      const res = await fetch(publicProductUrl(productId as number));
      if (!res.ok) throw new Error(res.status === 404 ? "This product is no longer publicly available." : "Failed to load product");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data) {
      document.title = "Royal Note Product | Public Catalog";
      setDocumentMeta(
        "description",
        "Review public product information and request a wholesale quote from Royal Note.",
      );
      return;
    }

    document.title = `${data.brand} ${data.name} | Royal Note Public Catalog`;
    setDocumentMeta(
      "description",
      data.description?.trim() || `Explore ${data.brand} ${data.name} in the Royal Note public B2B catalogue and request a quote.`,
    );
  }, [data]);

  if (isLoading) {
    return <ProductLoadingState />;
  }

  if (isError || !data) {
    return (
      <div className="rn-public min-h-screen px-4 py-20 pb-28">
        <div className="mx-auto max-w-3xl rounded-[16px] border border-[#EEEEEE] bg-white px-6 py-16 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF9F5] text-[#141413]">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="rn-display mt-5 text-[22px] font-semibold text-[#141413]">
            Product not available
          </p>
          <p className="mt-2 text-[13px] leading-6 text-[#949494]">
            {error instanceof Error ? error.message : "We couldn't load this product right now."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626]"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </button>
            <Link
              href="/"
              className="inline-flex rounded-lg border-[1.5px] border-[#EEEEEE] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#141413] transition hover:border-[#141413]"
            >
              Back to Catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rn-public min-h-screen pb-28">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#141413] transition hover:text-[#4D49BE]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalogue
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-[16px] border border-[#EEEEEE] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
            <div className="overflow-hidden rounded-[12px] bg-[#F5F5F5]">
              {data.thumbnail_path ? (
                <img
                  src={resolveStorageUrl(data.thumbnail_path)}
                  alt={data.name}
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-[#FAF9F5]">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#949494]">
                    Royal Note
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[16px] border border-[#EEEEEE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949494]">
                {data.brand}
              </p>
              <h1 className="rn-display mt-3 text-4xl font-bold text-[#141413] sm:text-[42px]">
                {data.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${availabilityStyles(data.availability_label)}`}
                >
                  {availabilityText(data.availability_label)}
                </span>
                {data.discount_percent ? (
                  <span className="inline-flex rounded-full bg-[#4D49BE] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                    {data.discount_percent}% Offer
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-[#FAF9F5] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949494]">
                    Category
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#141413]">{data.main_category}</p>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949494]">
                    Sub-category
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#141413]">
                    {data.sub_category || "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949494]">
                    Size
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#141413]">{data.size || "—"}</p>
                </div>
                <div className="rounded-lg bg-[#FAF9F5] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949494]">
                    Concentration
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#141413]">
                    {data.concentration || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[14px] leading-[1.7] text-[#141413]">
                  {data.description ||
                    "Request a B2B quote to receive availability confirmation and commercial details."}
                </p>
              </div>

              {data.public_price_hint ? (
                <div className="mt-4 rounded-[14px] border border-[#4D49BE]/20 bg-[#4D49BE]/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4D49BE]">
                    Public Price Hint
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[#141413]">
                    {data.public_price_hint}
                  </p>
                </div>
              ) : null}

              <div className="mt-6 rounded-[16px] border border-[#EEEEEE] bg-[#FAF9F5] p-5">
                <p className="rn-label">Request this product</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {hasItem(data.id) ? (
                    <div className="inline-flex items-center rounded-lg border border-[#EEEEEE] bg-white p-1">
                      <button
                        type="button"
                        onClick={() => setQty(data.id, Math.max(1, getQty(data.id) - 1))}
                        className="rounded-md p-2 text-[#141413] transition hover:bg-[#FAF9F5]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-10 text-center text-[13px] font-semibold text-[#141413]">
                        {getQty(data.id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(data.id, getQty(data.id) + 1)}
                        className="rounded-md p-2 text-[#141413] transition hover:bg-[#FAF9F5]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => addItem(data, 1)}
                    className="rounded-lg bg-[#141413] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626]"
                  >
                    {hasItem(data.id) ? "Add One More" : "Add to Request"}
                  </button>
                </div>
                <p className="mt-3 text-[12px] leading-[1.6] text-[#949494]">
                  Build a single multi-product request from anywhere in the catalogue, then send it via
                  WhatsApp or the request form.
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="rn-label">Similar Products</p>
              <h2 className="rn-display mt-2 text-[28px] font-semibold text-[#141413]">
                You may also want to review
              </h2>
            </div>
          </div>

          {data.similar_products.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#EEEEEE] bg-white px-6 py-14 text-center text-[13px] text-[#949494]">
              No similar products available right now.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.similar_products.map((product) => (
                <PublicProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
