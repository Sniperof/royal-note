import { buildPublicWhatsAppUrl } from "@/lib/publicCatalog";
import { ArrowRight } from "lucide-react";

type BrandSummary = {
  brand: string;
  product_count: number;
};

export default function PublicBrandsSection({
  brands,
  onSelectBrand,
}: {
  brands: BrandSummary[];
  onSelectBrand: (brand: string) => void;
}) {
  if (brands.length === 0) return null;

  return (
    <section className="mt-20 rounded-[20px] border border-[#EEEEEE] bg-white px-5 py-8 sm:px-8 lg:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[760px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#949494]">
            Wholesale Partners
          </p>
          <h2 className="rn-display mt-3 text-[32px] font-semibold tracking-[-0.03em] text-[#141413] sm:text-[38px]">
            Our Fragrance Houses
          </h2>
        </div>
        <p className="max-w-[360px] text-[13px] leading-6 text-[#6B6B6B]">
          Choose a house to browse the publicly available perfumes from that brand.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {brands.map((brand) => (
          <button
            key={brand.brand}
            type="button"
            onClick={() => onSelectBrand(brand.brand)}
            className="group flex min-h-[150px] flex-col justify-between rounded-[14px] border border-[#EEEEEE] bg-[#FAF9F5] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#141413] hover:bg-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#141413]/15"
          >
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#949494]">
                {brand.product_count} product{brand.product_count === 1 ? "" : "s"}
              </p>
              <p className="rn-display mt-2 text-[24px] font-semibold tracking-[-0.02em] text-[#141413]">
                {brand.brand}
              </p>
              <p className="mt-2 text-[13px] leading-5 text-[#6B6B6B]">
                View the perfume selection available for wholesale review.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#141413]">
              Browse Perfumes
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#141413] transition group-hover:bg-[#141413] group-hover:text-white">
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-[16px] border border-[#EEEEEE] bg-[#FAF9F5] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#949494]">
            Ready to Order?
          </p>
          <p className="rn-display mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[#141413]">
            Request a quote or speak to our team directly.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="#catalogue"
            className="inline-flex items-center justify-center rounded-[8px] bg-[#141413] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#262626]"
          >
            Request a Quote
          </a>
          <a
            href={buildPublicWhatsAppUrl("Hello Royal Note, I want to discuss wholesale brands and quotations.")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-[8px] bg-[#25D366] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition hover:brightness-95"
          >
            WhatsApp Us
          </a>
        </div>
      </div>
    </section>
  );
}
