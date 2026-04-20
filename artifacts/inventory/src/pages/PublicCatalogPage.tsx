import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search, Sparkles } from "lucide-react";
import PublicCatalogFilters from "@/components/public/PublicCatalogFilters";
import PublicProductCard from "@/components/public/PublicProductCard";
import { buildPublicCatalogQuery, buildPublicWhatsAppUrl, type PublicCatalogListResponse } from "@/lib/publicCatalog";

type Filters = {
  q: string;
  brand: string;
  main_category: string;
  sub_category: string;
  gender: string;
};

function setDocumentMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function CatalogLoadingState() {
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="aspect-[4/5] animate-pulse bg-slate-100" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 w-4/5 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PublicCatalogPage() {
  const [filters, setFilters] = useState<Filters>({
    q: "",
    brand: "",
    main_category: "",
    sub_category: "",
    gender: "",
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Royal Note Public Catalog | B2B Product Selection";
    setDocumentMeta(
      "description",
      "Browse Royal Note's public B2B catalogue, explore product details, and request wholesale quotes without logging in.",
    );
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.brand, filters.main_category, filters.sub_category, filters.gender]);

  const queryUrl = useMemo(
    () =>
      buildPublicCatalogQuery({
        ...filters,
        page,
        page_size: 18,
      }),
    [filters, page],
  );

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<PublicCatalogListResponse>({
    queryKey: ["public-catalog", filters, page],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      if (!res.ok) throw new Error("Failed to load public catalog");
      return res.json();
    },
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_30%,#f8fafc_100%)] pb-28 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_40%,#eef2ff_100%)] px-6 py-10 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.18),transparent_55%)] lg:block" />
          <div className="pointer-events-none absolute -left-12 top-8 h-28 w-28 rounded-full bg-slate-100 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-12 h-32 w-32 rounded-full bg-emerald-100/60 blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                <Sparkles className="h-3.5 w-3.5" />
                Royal Note B2B Catalogue
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                A clean public catalogue for wholesale discovery.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Review a curated product selection, shortlist relevant items, and send a quote request directly to the Royal Note team.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500">
                <span className="rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">No login required</span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">B2B inquiry flow</span>
                <span className="rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">No public pricing</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={buildPublicWhatsAppUrl("Hello Royal Note, I want to discuss a B2B quote.")}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
              >
                WhatsApp Us
              </a>
              <Link
                href="/login"
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-950"
              >
                Staff Login
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-8">
          <PublicCatalogFilters filters={filters} onChange={setFilters} />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              {pagination ? `${pagination.total_items} products found` : "Products"}
            </p>
          </div>
          {isFetching && !isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating catalogue
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <CatalogLoadingState />
        ) : isError ? (
          <div className="mt-6 rounded-[28px] border border-rose-200 bg-white px-6 py-12 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <RefreshCcw className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">Unable to load the public catalogue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error instanceof Error ? error.message : "Something went wrong while loading products."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-950">No matching public products</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {hasActiveFilters
                ? "Try broadening your search or clearing a few filters."
                : "There are no publicly visible products yet."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    q: "",
                    brand: "",
                    main_category: "",
                    sub_category: "",
                    gender: "",
                  })
                }
                className="mt-5 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <PublicProductCard key={product.id} product={product} />
              ))}
            </div>

            {pagination && pagination.total_pages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-sm font-medium text-slate-500">
                  Page {pagination.page} of {pagination.total_pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
                  disabled={page >= pagination.total_pages}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
