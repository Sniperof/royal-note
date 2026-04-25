import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, RefreshCcw, Search } from "lucide-react";
import PublicCatalogFilters from "@/components/public/PublicCatalogFilters";
import PublicBrandsSection from "@/components/public/PublicBrandsSection";
import PublicFooter from "@/components/public/PublicFooter";
import PublicHeader from "@/components/public/PublicHeader";
import PublicProductCard from "@/components/public/PublicProductCard";
import { buildPublicCatalogQuery, buildPublicWhatsAppUrl, type PublicCatalogListResponse } from "@/lib/publicCatalog";

type Filters = {
  q: string;
  brand: string[];
  main_category: string;
  gender: string;
  size: string[];
  concentration: string[];
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
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[14px] border border-[#EEEEEE] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]"
        >
          <div className="aspect-[4/5] animate-pulse bg-[#F5F5F5]" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-[#F5F5F5]" />
            <div className="h-5 w-4/5 animate-pulse rounded-full bg-[#F5F5F5]" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-[#F5F5F5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PublicCatalogPage() {
  const [filters, setFilters] = useState<Filters>({
    q: "",
    brand: [],
    main_category: "",
    gender: "",
    size: [],
    concentration: [],
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Royal Note - Wholesale Fragrance Catalogue";
    setDocumentMeta(
      "description",
      "Browse Royal Note's public B2B catalogue, explore product details, and request wholesale quotes without logging in.",
    );
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.brand, filters.main_category, filters.gender, filters.size, filters.concentration]);

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
  const hasActiveFilters =
    Boolean(filters.q) ||
    filters.brand.length > 0 ||
    Boolean(filters.main_category) ||
    Boolean(filters.gender) ||
    filters.size.length > 0 ||
    filters.concentration.length > 0;

  function handleSelectBrand(brand: string) {
    setFilters((current) => ({ ...current, q: "", brand: [brand] }));
    document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="rn-public min-h-screen bg-[#FAF9F5] pb-28">
      <PublicHeader
        searchValue={filters.q}
        onSearchChange={(value) => setFilters((current) => ({ ...current, q: value }))}
        requestHref="#catalogue"
      />

      <section id="hero" className="bg-[#141413] px-4 py-12 text-white sm:px-8 sm:py-14 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Wholesale Catalogue - Spring 2026
          </p>
          <h1 className="rn-display mx-auto mt-3 max-w-[760px] text-[42px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[48px] lg:text-[56px]">
            Fragrance for
            <br />
            <em className="font-semibold italic text-[#4D49BE]">Trade Buyers</em>
          </h1>
          <p className="mx-auto mt-4 max-w-[430px] text-[13px] leading-[1.65] text-white/55 sm:text-[14px]">
            A clean public catalogue for wholesale discovery. Browse selected fragrances, then
            request a quote directly from the Royal Note team.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a
              href="#catalogue"
              className="inline-flex items-center gap-2 rounded-[8px] bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413] transition hover:bg-[#F2F2F2]"
            >
              Browse All Products
            </a>
            <a
              href={buildPublicWhatsAppUrl("Hello Royal Note, I want to discuss a B2B quote.")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[8px] border-[1.5px] border-white/30 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/60"
            >
              WhatsApp Us
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-[8px] border-[1.5px] border-white/30 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:border-white/60"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </section>

      <div id="catalogue" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <PublicCatalogFilters
          filters={filters}
          onChange={setFilters}
          filterOptions={data?.filters ?? { brands: [], sizes: [], concentrations: [] }}
        />

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="rn-label">
            {pagination ? `${pagination.total_items} products` : "Products"}
          </p>
          {isFetching && !isLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-[#949494]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating catalogue
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <CatalogLoadingState />
        ) : isError ? (
          <div className="mt-6 rounded-2xl border border-[#EEEEEE] bg-white px-6 py-14 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF9F5] text-[#141413]">
              <RefreshCcw className="h-6 w-6" />
            </div>
            <h2 className="rn-display mt-5 text-2xl font-semibold text-[#141413]">
              Unable to load the catalogue
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#949494]">
              {error instanceof Error ? error.message : "Something went wrong while loading products."}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#141413] px-6 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626]"
            >
              <RefreshCcw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#EEEEEE] bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF9F5] text-[#949494]">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="rn-display mt-5 text-2xl font-semibold text-[#141413]">
              No matching products
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#949494]">
              {hasActiveFilters
                ? "No products match your current filters."
                : "There are no publicly visible products yet."}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    q: "",
                    brand: [],
                    main_category: "",
                    gender: "",
                    size: [],
                    concentration: [],
                  })
                }
                className="mt-5 inline-flex rounded-lg border-[1.5px] border-[#EEEEEE] px-6 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#141413] transition hover:border-[#141413]"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((product) => (
                <PublicProductCard key={product.id} product={product} />
              ))}
            </div>

            {pagination && pagination.total_pages > 1 ? (
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[#EEEEEE] bg-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#141413] transition hover:border-[#141413] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="rn-label">
                  Page {pagination.page} / {pagination.total_pages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
                  disabled={page >= pagination.total_pages}
                  className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[#EEEEEE] bg-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.1em] text-[#141413] transition hover:border-[#141413] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}

        <PublicBrandsSection
          brands={data?.brands_summary ?? []}
          onSelectBrand={handleSelectBrand}
        />
      </div>

      <PublicFooter />
    </div>
  );
}
