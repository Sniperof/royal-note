import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, Minus, Plus, RefreshCcw } from "lucide-react";
import PublicFooter from "@/components/public/PublicFooter";
import PublicHeader from "@/components/public/PublicHeader";
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
  if (label === "coming_soon") return "border border-[#E7E4DB] bg-white text-[#141413]";
  return "bg-[#F2F2F2] text-[#7C7C7C]";
}

function availabilityText(label: PublicProductDetailResponse["availability_label"]) {
  if (label === "coming_soon") return "Coming Soon";
  if (label === "limited") return "Limited";
  if (label === "available") return "Available";
  return "Unavailable";
}

function detailRows(product: PublicProductDetailResponse) {
  return [
    { label: "Category", value: product.main_category || "-" },
    { label: "Sub-category", value: product.sub_category || "-" },
    { label: "Size", value: product.size || "-" },
    { label: "Concentration", value: product.concentration || "-" },
  ];
}

function ProductLoadingState() {
  return (
    <div className="rn-public min-h-screen bg-[#FAF9F5] px-4 py-10 pb-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        <div className="h-4 w-36 animate-pulse rounded-full bg-[#F0EEE8]" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="rounded-[18px] border border-[#EEEEEE] bg-white p-4">
            <div className="aspect-[4/5] animate-pulse rounded-[14px] bg-[#F0EEE8]" />
          </div>
          <div className="space-y-6">
            <div className="rounded-[18px] border border-[#EEEEEE] bg-white p-6">
              <div className="h-3 w-24 animate-pulse rounded-full bg-[#F0EEE8]" />
              <div className="mt-4 h-12 w-4/5 animate-pulse rounded-full bg-[#F0EEE8]" />
              <div className="mt-5 h-20 w-full animate-pulse rounded-[14px] bg-[#F0EEE8]" />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-[12px] bg-[#F8F7F3] px-4 py-4">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-[#F0EEE8]" />
                    <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-[#F0EEE8]" />
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
      if (!res.ok) {
        throw new Error(res.status === 404 ? "This product is no longer publicly available." : "Failed to load product");
      }
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
    return (
      <div className="bg-[#FAF9F5]">
        <PublicHeader homeHrefPrefix="/" requestHref="#request-product" />
        <ProductLoadingState />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rn-public min-h-screen bg-[#FAF9F5] pb-28">
        <PublicHeader homeHrefPrefix="/" requestHref="#request-product" />
        <div className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl rounded-[18px] border border-[#EEEEEE] bg-white px-6 py-16 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
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
        <PublicFooter />
      </div>
    );
  }

  const selected = hasItem(data.id);

  return (
    <div className="rn-public min-h-screen bg-[#FAF9F5] pb-28">
      <PublicHeader homeHrefPrefix="/" requestHref="#request-product" />

      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#141413] transition hover:text-[#4D49BE]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalogue
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-[18px] border border-[#EEEEEE] bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
              <div className="relative overflow-hidden rounded-[14px] bg-[#F3F1EA]">
                {data.thumbnail_path ? (
                  <img
                    src={resolveStorageUrl(data.thumbnail_path)}
                    alt={data.name}
                    className="aspect-[4/5] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-[#F5F4EF] to-[#ECE8DE]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-4 w-8 rounded-t-[4px] bg-[#A69B86]/50" />
                      <div className="h-20 w-12 rounded-[6px] bg-[#C4B8A0]/70" />
                    </div>
                  </div>
                )}

                <span
                  className={`absolute left-4 top-4 inline-flex rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] ${availabilityStyles(data.availability_label)}`}
                >
                  {availabilityText(data.availability_label)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[18px] border border-[#EEEEEE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] sm:p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949494]">
                {data.brand}
              </p>
              <h1 className="rn-display mt-2 text-[38px] font-semibold leading-[1.08] tracking-[-0.03em] text-[#141413] sm:text-[46px]">
                {data.name}
              </h1>
              <p className="mt-3 max-w-[540px] text-[14px] leading-[1.75] text-[#595959]">
                {data.description ||
                  "Request a B2B quote to receive availability confirmation and commercial details."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {data.discount_percent ? (
                  <span className="inline-flex rounded-full bg-[#4D49BE] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                    {data.discount_percent}% Offer
                  </span>
                ) : null}
                {data.public_price_hint ? (
                  <span className="inline-flex rounded-full border border-[#E5E0D1] bg-[#FAF9F5] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413]">
                    {data.public_price_hint}
                  </span>
                ) : null}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {detailRows(data).map((row) => (
                  <div key={row.label} className="rounded-[12px] bg-[#FAF9F5] px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#949494]">
                      {row.label}
                    </p>
                    <p className="mt-2 text-[13px] font-semibold text-[#141413]">{row.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section
              id="request-product"
              className="rounded-[18px] border border-[#EEEEEE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)] sm:p-7"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#949494]">
                    Request This Product
                  </p>
                  <h2 className="rn-display mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#141413]">
                    Add it to your quotation list
                  </h2>
                  <p className="mt-2 max-w-[460px] text-[13px] leading-6 text-[#6B6B6B]">
                    Build one multi-product request from anywhere in the catalogue, then continue by
                    WhatsApp or the quotation form.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => addItem(data, 1)}
                  className={`inline-flex items-center justify-center rounded-[10px] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] transition ${
                    selected
                      ? "bg-[#4D49BE] text-white hover:bg-[#3d39a8]"
                      : "bg-[#141413] text-white hover:bg-[#262626]"
                  }`}
                >
                  {selected ? "Add One More" : "Add to Request"}
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#EEEEEE] pt-5">
                {selected ? (
                  <div className="inline-flex items-center rounded-[10px] border border-[#EEEEEE] bg-[#FAF9F5] p-1">
                    <button
                      type="button"
                      onClick={() => setQty(data.id, Math.max(1, getQty(data.id) - 1))}
                      className="rounded-[8px] p-2 text-[#141413] transition hover:bg-white"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-10 text-center text-[13px] font-semibold text-[#141413]">
                      {getQty(data.id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(data.id, getQty(data.id) + 1)}
                      className="rounded-[8px] p-2 text-[#141413] transition hover:bg-white"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex rounded-full border border-[#E5E0D1] bg-[#FAF9F5] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413]">
                    Ready to add
                  </span>
                )}

                <p className="text-[12px] leading-6 text-[#6B6B6B]">
                  {selected
                    ? "Quantity updates here will sync directly with your bottom request sheet."
                    : "Once added, this product will appear in your request sheet at the bottom."}
                </p>
              </div>
            </section>
          </div>
        </div>

        <section className="mt-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#949494]">
                Similar Products
              </p>
              <h2 className="rn-display mt-2 text-[28px] font-semibold tracking-[-0.02em] text-[#141413]">
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

      <PublicFooter />
    </div>
  );
}
