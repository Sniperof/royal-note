import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import PublicInquiryForm from "@/components/public/PublicInquiryForm";
import PublicProductCard from "@/components/public/PublicProductCard";
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

function availabilityClasses(label: PublicProductDetailResponse["availability_label"]) {
  if (label === "available") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (label === "limited") return "border-amber-200 bg-amber-50 text-amber-700";
  if (label === "coming_soon") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function availabilityText(label: PublicProductDetailResponse["availability_label"]) {
  if (label === "coming_soon") return "Coming Soon";
  if (label === "limited") return "Limited";
  if (label === "available") return "Available";
  return "Unavailable";
}

function ProductLoadingState() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-5 w-36 animate-pulse rounded-full bg-slate-100" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
            <div className="aspect-[4/5] animate-pulse rounded-[24px] bg-slate-100" />
          </div>
          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.04)]">
              <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-4 h-10 w-3/4 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-4 h-8 w-32 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
                    <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-11/12 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
              <div className="h-5 w-36 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              </div>
              <div className="mt-3 h-28 animate-pulse rounded-2xl bg-slate-100" />
              <div className="mt-3 h-12 animate-pulse rounded-2xl bg-slate-100" />
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
      <div className="min-h-screen bg-slate-50 px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-rose-200 bg-white px-6 py-16 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="mt-5 text-lg font-semibold text-slate-900">Product not available</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error instanceof Error ? error.message : "We couldn't load this product right now."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </button>
            <Link
              href="/"
              className="inline-flex rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Back to catalogue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f8fafc_100%)] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Back to catalogue
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
            <div className="overflow-hidden rounded-[24px] bg-slate-100">
              {data.thumbnail_path ? (
                <img
                  src={resolveStorageUrl(data.thumbnail_path)}
                  alt={data.name}
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-[radial-gradient(circle_at_top,_#e2e8f0,_#f8fafc_65%)]">
                  <span className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Royal Note</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">{data.brand}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{data.name}</h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${availabilityClasses(data.availability_label)}`}>
                  {availabilityText(data.availability_label)}
                </span>
                {data.discount_percent ? (
                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    {data.discount_percent}% Offer
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Category</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{data.main_category}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Sub-category</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{data.sub_category || "-"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Size</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{data.size || "-"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-400">Concentration</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{data.concentration || "-"}</p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm leading-7 text-slate-600">
                  {data.description || "Request a B2B quote to receive availability confirmation and commercial details."}
                </p>
              </div>
            </div>

            <PublicInquiryForm product={data} />
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Similar Products</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">You may also want to review</h2>
            </div>
          </div>

          {data.similar_products.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center text-slate-500">
              No similar products available right now.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
