export default function PublicFooter() {
  return (
    <footer id="footer" className="border-t border-[#EEEEEE] bg-white">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
        <div className="flex min-h-[56px] flex-col justify-center gap-2 py-3 text-center text-[10px] uppercase tracking-[0.08em] text-[#949494] sm:min-h-[44px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0 sm:text-[9px]">
          <span className="truncate">royalnote.com | trade@royalnote.com</span>
          <span className="rn-display text-[14px] font-semibold normal-case tracking-[-0.02em] text-[#141413] sm:text-[12px]">
            Royal Note
          </span>
          <span className="truncate">Wholesale Catalogue | Spring 2026 | Public Edition</span>
        </div>
      </div>
    </footer>
  );
}
