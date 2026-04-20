import { pool } from "@workspace/db";
import { ensureCoreSchema } from "./ensureCoreSchema";

export class MasterDataError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MasterDataError";
    this.status = status;
  }
}

export function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function resolveFromMasterOrFail(options: {
  table: "brands" | "sizes" | "concentrations";
  rawValue: string | null | undefined;
  label: string;
  optional?: boolean;
}) {
  await ensureCoreSchema();

  const trimmed = typeof options.rawValue === "string" ? options.rawValue.trim() : "";
  if (!trimmed) {
    if (options.optional) return null;
    throw new MasterDataError(`${options.label} is required`);
  }

  const normalized = normalize(trimmed);
  const hasIsActive = options.table !== "brands";
  const query = hasIsActive
    ? `
      SELECT name
      FROM ${options.table}
      WHERE normalized_name = $1
        AND is_active = true
      ORDER BY name ASC
    `
    : `
      SELECT name
      FROM ${options.table}
      WHERE normalized_name = $1
      ORDER BY name ASC
    `;
  const result = await pool.query<{ name: string }>(query, [normalized]);

  if (result.rows.length === 0) {
    throw new MasterDataError(`${options.label} "${trimmed}" is not in master data`);
  }

  if (result.rows.length > 1) {
    throw new MasterDataError(`${options.label} "${trimmed}" has duplicate master data entries`);
  }

  return result.rows[0].name;
}

export async function resolveBrandOrFail(value: string | null | undefined) {
  return resolveFromMasterOrFail({
    table: "brands",
    rawValue: value,
    label: "Brand",
  });
}

export async function resolveSizeOrFail(value: string | null | undefined) {
  return resolveFromMasterOrFail({
    table: "sizes",
    rawValue: value,
    label: "Size",
    optional: true,
  });
}

export async function resolveConcentrationOrFail(value: string | null | undefined) {
  return resolveFromMasterOrFail({
    table: "concentrations",
    rawValue: value,
    label: "Concentration",
    optional: true,
  });
}

export async function canonicalizeMasterValues<T extends {
  brand: string;
  size?: string | null;
  concentration?: string | null;
}>(input: T) {
  return {
    ...input,
    brand: await resolveBrandOrFail(input.brand),
    size: await resolveSizeOrFail(input.size),
    concentration: await resolveConcentrationOrFail(input.concentration),
  };
}
