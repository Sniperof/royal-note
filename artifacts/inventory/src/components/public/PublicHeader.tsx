import { Link } from "wouter";
import { Search } from "lucide-react";
import type { MouseEvent } from "react";
import { usePublicRequest } from "@/context/PublicRequestContext";

type PublicHeaderProps = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  requestHref?: string;
  homeHrefPrefix?: string;
};

function SparkleMark({ className = "h-5 w-5 text-[#141413]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function PublicHeader({
  searchValue = "",
  onSearchChange,
  requestHref = "#catalogue",
  homeHrefPrefix = "",
}: PublicHeaderProps) {
  const { items, openRequestPanel } = usePublicRequest();
  const hasRequestItems = items.length > 0;

  function handleRequestClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!hasRequestItems) return;
    event.preventDefault();
    openRequestPanel();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#EEEEEE] bg-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="hidden h-16 items-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <nav className="flex items-center gap-6">
            <a
              href={`${homeHrefPrefix}#catalogue`}
              className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-[#141413] transition hover:text-[#4D49BE]"
            >
              Catalogue
            </a>
            <a
              href={`${homeHrefPrefix}#brands`}
              className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-[#141413] transition hover:text-[#4D49BE]"
            >
              Brands
            </a>
            <a
              href={`${homeHrefPrefix}#footer`}
              className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.08em] text-[#141413] transition hover:text-[#4D49BE]"
            >
              About
            </a>
          </nav>

          <Link href="/" className="inline-flex items-center justify-center gap-2 text-[#141413]">
            <SparkleMark className="h-[20px] w-[20px] text-[#141413]" />
            <span className="rn-display text-[22px] font-semibold tracking-[-0.02em]">Royal Note</span>
          </Link>

          <div className="flex items-center justify-end gap-3">
            {onSearchChange ? (
              <label className="flex w-[220px] items-center gap-2 rounded-md border-[1.5px] border-[#EEEEEE] bg-[#FAF9F5] px-3 py-2 text-[#949494] transition focus-within:border-[#141413]">
                <Search className="h-[14px] w-[14px]" />
                <input
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search fragrances"
                  className="w-full border-none bg-transparent text-[13px] text-[#141413] outline-none placeholder:text-[#949494]"
                />
              </label>
            ) : null}

            <Link
              href="/login"
              className="inline-flex rounded-lg border-[1.5px] border-[#EEEEEE] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#141413] transition hover:border-[#141413]"
            >
              Staff Login
            </Link>

            <a
              href={requestHref}
              onClick={handleRequestClick}
              className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626]"
            >
              <span>Request Quote</span>
              {hasRequestItems ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-white/12 px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-white">
                  {items.length}
                </span>
              ) : null}
            </a>
          </div>
        </div>

        <div className="py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-[#141413]">
              <SparkleMark className="h-[18px] w-[18px] text-[#141413]" />
              <span className="rn-display text-[21px] font-semibold tracking-[-0.02em]">Royal Note</span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex rounded-lg border border-[#EEEEEE] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#141413]"
              >
                Login
              </Link>
              <a
                href={requestHref}
                onClick={handleRequestClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#141413] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white"
              >
                <span>Request</span>
                {hasRequestItems ? (
                  <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-white/15 px-1 py-0.5 text-[9px] font-bold tracking-normal text-white">
                    {items.length}
                  </span>
                ) : null}
              </a>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 overflow-x-auto pb-1">
            <a
              href={`${homeHrefPrefix}#catalogue`}
              className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] text-[#141413]"
            >
              Catalogue
            </a>
            <a
              href={`${homeHrefPrefix}#brands`}
              className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] text-[#141413]"
            >
              Brands
            </a>
            <a
              href={`${homeHrefPrefix}#footer`}
              className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] text-[#141413]"
            >
              About
            </a>
          </div>

          {onSearchChange ? (
            <label className="mt-3 flex items-center gap-2 rounded-md border-[1.5px] border-[#EEEEEE] bg-[#FAF9F5] px-3 py-3 text-[#949494]">
              <Search className="h-[14px] w-[14px]" />
              <input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search fragrances"
                className="w-full border-none bg-transparent text-[13px] text-[#141413] outline-none placeholder:text-[#949494]"
              />
            </label>
          ) : null}
        </div>
      </div>
    </header>
  );
}
