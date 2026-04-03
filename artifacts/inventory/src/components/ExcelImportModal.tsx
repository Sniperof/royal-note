import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useQueryClient } from "@tanstack/react-query";
import { getGetInventoryQueryKey } from "@workspace/api-client-react";

interface ParsedRow {
  barcode: string;
  brand: string;
  name: string;
  main_category: "perfume" | "makeup" | "skin_care";
  description?: string;
  sub_category?: string;
  size?: string;
  concentration?: string;
  gender?: string;
  qty: number;
  cost_usd: number;
  sale_price_aed: number;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const REQUIRED_COLUMNS = ["barcode", "brand", "name", "qty", "cost_usd", "sale_price_aed"];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, "main_category", "sub_category", "description", "size", "concentration", "gender"];

const CATEGORY_ALIASES = {
  perfume: "perfume",
  parfum: "perfume",
  fragrance: "perfume",
  fragrances: "perfume",
  makeup: "makeup",
  cosmetic: "makeup",
  cosmetics: "makeup",
  skin_care: "skin_care",
  skincare: "skin_care",
  "skin care": "skin_care",
} as const;

const HEADER_ALIASES: Record<string, string[]> = {
  barcode: ["barcode", "bar_code", "code", "product_code", "sku"],
  brand: ["brand", "brand_name", "manufacturer", "make"],
  name: ["name", "product_name", "item_name", "title"],
  description: ["description", "details", "notes"],
  main_category: ["main_category", "category", "product_category"],
  sub_category: ["sub_category", "subcategory", "sub category", "product_type", "type"],
  size: ["size", "volume", "pack_size", "capacity"],
  concentration: ["concentration", "variant", "shade", "finish", "skin_type", "key_active", "active"],
  gender: ["gender", "target_gender", "for"],
  qty: ["qty", "quantity", "stock", "opening_stock"],
  cost_usd: ["cost_usd", "cost", "cost_price", "buy_price", "purchase_price"],
  sale_price_aed: ["sale_price_aed", "sale_price_usd", "price", "selling_price", "sale_price", "wholesale_price"],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, "_");
}

function getFirstValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeHeader(key)];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return "";
}

function normalizeCategory(rawValue: string): ParsedRow["main_category"] {
  const normalized = rawValue.toLowerCase().trim();
  return CATEGORY_ALIASES[normalized as keyof typeof CATEGORY_ALIASES] ?? "perfume";
}

function buildNormalizedRow(row: Record<string, unknown>) {
  const normalizedSource: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    normalizedSource[normalizeHeader(key)] = String(row[key] ?? "").trim();
  }

  const normalized: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    normalized[field] = getFirstValue(normalizedSource, aliases);
  }

  return normalized;
}

function getCategorySpecificFields(category: ParsedRow["main_category"], row: Record<string, string>) {
  if (category === "makeup") {
    return {
      sub_category: row.sub_category || undefined,
      size: row.size || undefined,
      concentration: row.concentration || undefined,
      gender: undefined,
    };
  }

  if (category === "skin_care") {
    return {
      sub_category: row.sub_category || undefined,
      size: row.size || undefined,
      concentration: row.concentration || undefined,
      gender: undefined,
    };
  }

  return {
    sub_category: row.sub_category || undefined,
    size: row.size || undefined,
    concentration: row.concentration || undefined,
    gender: row.gender || undefined,
  };
}

export function ExcelImportModal({ isOpen, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setParseErrors([]);
    setStep("upload");
    setImportResult(null);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    parseFile(selected);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (!dropped) return;
    setFile(dropped);
    parseFile(dropped);
  };

  const parseFile = (inputFile: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawRows.length === 0) {
          setParseErrors(["The file is empty or has no data rows."]);
          setParsedRows([]);
          setStep("preview");
          return;
        }

        const nextErrors: string[] = [];
        const nextRows: ParsedRow[] = [];

        rawRows.forEach((row, index) => {
          const normalized = buildNormalizedRow(row);

          const rowNumber = index + 2;
          const missing = REQUIRED_COLUMNS.filter((column) => !normalized[column] && normalized[column] !== "0");
          if (missing.length > 0) {
            nextErrors.push(`Row ${rowNumber}: Missing required columns: ${missing.join(", ")}`);
            return;
          }

          const qty = parseInt(normalized.qty, 10);
          const costUsd = parseFloat(normalized.cost_usd);
          const salePriceAed = parseFloat(normalized.sale_price_aed);
          const mainCategory = normalizeCategory(normalized.main_category);
          const categoryFields = getCategorySpecificFields(mainCategory, normalized);

          if (Number.isNaN(qty)) {
            nextErrors.push(`Row ${rowNumber}: qty must be a number`);
            return;
          }
          if (Number.isNaN(costUsd)) {
            nextErrors.push(`Row ${rowNumber}: cost_usd must be a number`);
            return;
          }
          if (Number.isNaN(salePriceAed)) {
            nextErrors.push(`Row ${rowNumber}: sale_price_aed must be a number`);
            return;
          }

          nextRows.push({
            barcode: normalized.barcode,
            brand: normalized.brand,
            name: normalized.name,
            main_category: mainCategory,
            description: normalized.description || undefined,
            ...categoryFields,
            qty,
            cost_usd: costUsd,
            sale_price_aed: salePriceAed,
          });
        });

        setParsedRows(nextRows);
        setParseErrors(nextErrors);
        setStep("preview");
      } catch {
        setParsedRows([]);
        setParseErrors(["Failed to parse file. Make sure it's a valid .xlsx or .xls file."]);
        setStep("preview");
      }
    };
    reader.readAsBinaryString(inputFile);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    try {
      const response = await fetch("/api/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: parsedRows.map((row) => ({
            ...row,
            gender: row.main_category === "perfume" ? row.gender : undefined,
          })),
        }),
      });

      const raw = await response.json().catch(() => ({}));
      const result: ImportResult = {
        inserted: typeof raw?.inserted === "number" ? raw.inserted : 0,
        skipped: typeof raw?.skipped === "number" ? raw.skipped : 0,
        errors: Array.isArray(raw?.errors) ? raw.errors.map((error: unknown) => String(error)) : [],
      };

      if (!response.ok && result.errors.length === 0) {
        result.errors = [typeof raw?.error === "string" ? raw.error : "Import failed"];
        result.skipped = result.skipped || parsedRows.length;
      }

      setImportResult(result);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
    } catch {
      setImportResult({
        inserted: 0,
        skipped: parsedRows.length,
        errors: ["Network error - please try again."],
      });
      setStep("result");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ALL_COLUMNS,
      ["BC001", "Dior", "Sauvage", 10, 95.0, 130.0, "perfume", "men_fragrance", "Fresh spicy scent", "100ml", "EDP", "Men"],
      ["BC002", "Huda Beauty", "Liquid Matte", 5, 18.0, 29.0, "makeup", "lipstick", "Long-wear matte lipstick", "4ml", "Bombshell", ""],
      ["BC003", "Cerave", "Foaming Cleanser", 8, 11.0, 18.0, "skin_care", "cleanser", "Foaming cleanser for oily skin", "236ml", "Oily Skin", ""],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "inventory_template.xlsx");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Import from Excel</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {step === "upload" && "Upload a .xlsx or .xls file"}
                  {step === "preview" && `${parsedRows.length} rows ready - ${parseErrors.length} errors`}
                  {step === "result" && "Import complete"}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {step === "upload" && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Need a template?</p>
                    <p className="text-xs text-blue-600 mt-0.5">Download a sample Excel file with the correct columns</p>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center space-x-1.5 text-sm font-medium text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Template</span>
                  </button>
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={(event) => event.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 hover:border-black rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors group"
                >
                  <div className="w-14 h-14 bg-gray-50 group-hover:bg-gray-100 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500 mt-1">.xlsx or .xls files only</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Expected Columns</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_COLUMNS.map((column) => (
                      <span
                        key={column}
                        className={`text-xs px-2.5 py-1 rounded-full font-mono ${
                          REQUIRED_COLUMNS.includes(column) ? "bg-black text-white" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {column}
                        {REQUIRED_COLUMNS.includes(column) ? " *" : ""}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">* Required columns</p>
                </div>
              </div>
            )}

            {step === "preview" && (
              <div className="p-6 space-y-4">
                {parseErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 mb-2 flex items-center space-x-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>{parseErrors.length} row(s) had errors and will be skipped</span>
                    </p>
                    <ul className="space-y-1">
                      {parseErrors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-xs text-red-600">- {error}</li>
                      ))}
                      {parseErrors.length > 5 && (
                        <li className="text-xs text-red-400">+ {parseErrors.length - 5} more errors...</li>
                      )}
                    </ul>
                  </div>
                )}

                {parsedRows.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-3">
                      Previewing <span className="font-semibold text-gray-900">{parsedRows.length}</span> valid rows from{" "}
                      <span className="font-medium text-gray-700">{file?.name}</span>
                    </p>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-xs min-w-[600px]">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              {["Brand", "Name", "Category", "Subcategory", "Barcode", "Size", "Qty", "Cost (USD)", "Price (AED)"].map((header) => (
                                <th key={header} className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {parsedRows.slice(0, 50).map((row, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-900 font-medium">{row.brand}</td>
                                <td className="px-3 py-2 text-gray-600 max-w-[150px] truncate">{row.name}</td>
                                <td className="px-3 py-2 text-gray-500">{row.main_category}</td>
                                <td className="px-3 py-2 text-gray-500">{row.sub_category || "-"}</td>
                                <td className="px-3 py-2 font-mono text-gray-500">{row.barcode}</td>
                                <td className="px-3 py-2 text-gray-500">{row.size || "-"}</td>
                                <td className="px-3 py-2 text-right font-medium">{row.qty}</td>
                                <td className="px-3 py-2 text-right">${row.cost_usd.toFixed(2)}</td>
                                <td className="px-3 py-2 text-right">{row.sale_price_aed.toFixed(2)} AED</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {parsedRows.length > 50 && (
                        <p className="text-xs text-center text-gray-400 py-2 bg-gray-50 border-t border-gray-100">
                          Showing first 50 of {parsedRows.length} rows
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No valid rows found. Please check your file format.</p>
                  </div>
                )}
              </div>
            )}

            {step === "result" && importResult && (
              <div className="p-6 space-y-4">
                <div className="text-center py-4">
                  <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900">Import Complete</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-700">{importResult.inserted}</p>
                    <p className="text-sm text-green-600 mt-1">Products Added</p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-700">{importResult.skipped}</p>
                    <p className="text-sm text-yellow-600 mt-1">Rows Skipped</p>
                  </div>
                </div>

                {(importResult.errors?.length ?? 0) > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-700 mb-2">Skipped rows:</p>
                    <ul className="space-y-1">
                      {(importResult.errors ?? []).map((error, index) => (
                        <li key={index} className="text-xs text-red-600">- {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100 flex items-center justify-between">
            {step === "upload" && (
              <>
                <button onClick={handleClose} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Cancel
                </button>
                <span className="text-xs text-gray-400">Select a file to continue</span>
              </>
            )}

            {step === "preview" && (
              <>
                <button
                  onClick={() => {
                    setParsedRows([]);
                    setParseErrors([]);
                    setStep("upload");
                    setFile(null);
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={parsedRows.length === 0 || isImporting}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <span>Import {parsedRows.length} Products</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            )}

            {step === "result" && (
              <>
                <button
                  onClick={reset}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-xl transition-colors"
                >
                  Import Another File
                </button>
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
