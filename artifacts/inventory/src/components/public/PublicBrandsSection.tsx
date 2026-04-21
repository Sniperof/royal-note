import { buildPublicWhatsAppUrl } from "@/lib/publicCatalog";

type BrandSummary = {
  brand: string;
  product_count: number;
};

export default function PublicBrandsSection({
  brands,
}: {
  brands: BrandSummary[];
}) {
  if (brands.length === 0) return null;

  return (
    <section className="mt-20 rounded-[20px] border border-[#EEEEEE] bg-white px-5 py-8 sm:px-8 lg:px-10">
      <div className="max-w-[760px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#949494]">
          Wholesale Partners
        </p>
        <h2 className="rn-display mt-3 text-[32px] font-semibold tracking-[-0.03em] text-[#141413] sm:text-[38px]">
          Our Fragrance Houses
        </h2>
      </div>

      <div className="mt-8 grid border-t border-[#EEEEEE] lg:grid-cols-2">
        {brands.map((brand, index) => (
          <div
            key={brand.brand}
            className={`border-b border-[#EEEEEE] py-5 ${
              index % 2 === 0 ? "lg:pr-8" : "lg:border-l lg:pl-8"
            }`}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#949494]">
              {brand.product_count} product{brand.product_count === 1 ? "" : "s"}
            </p>
            <p className="rn-display mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#141413]">
              {brand.brand}
            </p>
            <p className="mt-1 text-[13px] text-[#6B6B6B]">
              Publicly visible selection available for wholesale review.
            </p>
          </div>
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
