import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, MessageCircle, Phone, User, Search, ChevronDown, Copy, Check } from "lucide-react";
import { getCustomers } from "@workspace/api-client-react";

interface Props {
  product: {
    brand: string;
    name: string;
    gender: string | null | undefined;
    sale_price_aed: string | number;
    size?: string | null;
    concentration?: string | null;
  };
  imageUrl?: string | null;
  onClose: () => void;
}

const GENDER_MAP: Record<string, string> = {
  male: "Men", female: "Women", unisex: "Unisex",
  men: "Men", women: "Women",
  "for men": "Men", "for women": "Women",
};
function genderLabel(g: string | null | undefined) {
  if (!g) return null;
  return GENDER_MAP[g.toLowerCase()] ?? g;
}

function genderEmoji(g: string | null | undefined) {
  const label = genderLabel(g);
  if (label === "Men") return "👔";
  if (label === "Women") return "👗";
  if (label === "Unisex") return "🌈";
  return "✨";
}

function formatPhone(raw: string): string {
  return raw.replace(/[\s\-().+]/g, "");
}

function buildMessage(
  brand: string,
  name: string,
  gender: string | null | undefined,
  salePrice: number,
  size?: string | null,
  concentration?: string | null,
  imageUrl?: string | null
): string {
  const g = genderLabel(gender);
  const ge = genderEmoji(gender);
  const details = [size, concentration].filter(Boolean).join(" · ");

  let msg = `🌸 *${brand} — ${name}*`;
  if (details) msg += `\n📦 ${details}`;
  if (g) msg += `\n${ge} ${g}`;
  msg += `\n💰 Price: *$${salePrice.toFixed(2)}*`;
  if (imageUrl) msg += `\n\n📸 ${imageUrl}`;

  return msg;
}

export default function WhatsAppShareModal({ product, imageUrl, onClose }: Props) {
  const [phoneMode, setPhoneMode] = useState<"customer" | "manual">("customer");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => getCustomers(),
  });

  const salePrice = Number(product.sale_price_aed ?? 0);
  const message = buildMessage(
    product.brand,
    product.name,
    product.gender,
    salePrice,
    product.size,
    product.concentration,
    imageUrl
  );

  const activePhone = phoneMode === "customer" ? selectedPhone : manualPhone;
  const cleanPhone = formatPhone(activePhone);
  const canSend = cleanPhone.length >= 7;

  const waUrl = canSend
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : null;

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q);
  });

  function selectCustomer(customerId: number, phone: string) {
    setSelectedCustomerId(customerId);
    setSelectedPhone(phone);
    setDropdownOpen(false);
    setCustomerSearch("");
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWhatsApp() {
    if (waUrl) window.open(waUrl, "_blank");
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Share on WhatsApp</h2>
              <p className="text-xs text-gray-400">{product.brand} — {product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Message Preview */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message Preview</p>
              <button
                onClick={copyMessage}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="bg-[#ECF8ED] rounded-2xl rounded-tl-sm px-4 py-3 border border-[#d4edda]">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed break-all">
                {message}
              </pre>
              {imageUrl && (
                <div className="mt-2 rounded-xl overflow-hidden border border-[#c8e6c9] max-h-24">
                  <img src={imageUrl} alt="Product" className="w-full h-24 object-cover" onError={e => { (e.target as HTMLElement).parentElement!.style.display = "none"; }} />
                </div>
              )}
            </div>
          </div>

          {/* Phone Number Section */}
          <div className="px-5 pb-5 space-y-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Send to</p>

            {/* Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              <button
                onClick={() => setPhoneMode("customer")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  phoneMode === "customer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                From Customers
              </button>
              <button
                onClick={() => setPhoneMode("manual")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  phoneMode === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                Enter Number
              </button>
            </div>

            {phoneMode === "customer" ? (
              <div className="space-y-2">
                {/* Customer Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-3 border border-gray-200 rounded-xl text-sm bg-white hover:border-gray-300 transition-colors"
                  >
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-[#25D366]" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-medium text-gray-900 text-sm truncate">{selectedCustomer.name}</p>
                          {selectedPhone && <p className="text-xs text-gray-400 font-mono">{selectedPhone}</p>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Select a customer...</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-56 overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <Search className="w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            autoFocus
                            value={customerSearch}
                            onChange={e => setCustomerSearch(e.target.value)}
                            placeholder="Search customers..."
                            className="flex-1 text-sm bg-transparent focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">No customers found</p>
                        ) : (
                          filteredCustomers.map(customer => {
                            const phones: string[] = Array.isArray(customer.phone_numbers) ? customer.phone_numbers : [];
                            if (phones.length === 0) {
                              return (
                                <div key={customer.id} className="px-3 py-2.5 flex items-center gap-2 opacity-40 cursor-not-allowed">
                                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-gray-700">{customer.name}</p>
                                    <p className="text-xs text-gray-400">No phone number</p>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={customer.id}>
                                {phones.map((phone, pi) => (
                                  <button
                                    key={pi}
                                    onClick={() => selectCustomer(customer.id!, phone)}
                                    className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2 transition-colors ${
                                      selectedPhone === phone && selectedCustomerId === customer.id ? "bg-[#25D366]/5" : ""
                                    }`}
                                  >
                                    <div className="w-7 h-7 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                                      <User className="w-3.5 h-3.5 text-[#25D366]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {customer.name}
                                        {phones.length > 1 && <span className="text-xs text-gray-400 ml-1">#{pi + 1}</span>}
                                      </p>
                                      <p className="text-xs font-mono text-gray-500">{phone}</p>
                                    </div>
                                    {selectedPhone === phone && selectedCustomerId === customer.id && (
                                      <Check className="w-4 h-4 text-[#25D366] ml-auto flex-shrink-0" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedPhone && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl">
                    <Phone className="w-4 h-4 text-[#25D366]" />
                    <span className="text-sm font-mono text-gray-700">{selectedPhone}</span>
                    <span className="text-xs text-gray-400 ml-auto">→ wa.me/{formatPhone(selectedPhone)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#25D366] focus-within:ring-2 focus-within:ring-[#25D366]/20 transition-all">
                  <span className="px-3.5 py-3 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 flex-shrink-0">+</span>
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={e => setManualPhone(e.target.value)}
                    placeholder="971501234567"
                    className="flex-1 px-3 py-3 text-sm focus:outline-none font-mono"
                  />
                </div>
                <p className="text-xs text-gray-400">Enter number with country code. Example: 971501234567 for UAE</p>
                {manualPhone && formatPhone(manualPhone).length >= 7 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl">
                    <Phone className="w-4 h-4 text-[#25D366]" />
                    <span className="text-xs text-gray-500">→ wa.me/{formatPhone(manualPhone)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={openWhatsApp}
            disabled={!canSend}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: canSend ? "#25D366" : "#9ca3af", color: "white" }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {canSend ? "Open WhatsApp" : "Enter a phone number first"}
          </button>
        </div>
      </div>
    </div>
  );
}
