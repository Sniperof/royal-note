import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  UpdateCustomerParams,
  DeleteCustomerParams,
  CreateSupplierBody,
  UpdateSupplierBody,
  UpdateSupplierParams,
  DeleteSupplierParams,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const customersRouter: IRouter = Router();
export const suppliersRouter: IRouter = Router();

customersRouter.use(requireAuth, requireAdmin);
suppliersRouter.use(requireAuth, requireAdmin);

let ensureContactsSchemaPromise: Promise<void> | null = null;

async function ensureContactsSchema() {
  if (!ensureContactsSchemaPromise) {
    ensureContactsSchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id serial PRIMARY KEY,
          name text NOT NULL,
          neighborhood text,
          address_detail text,
          phone_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id serial PRIMARY KEY,
          name text NOT NULL,
          neighborhood text,
          address_detail text,
          phone_numbers jsonb NOT NULL DEFAULT '[]'::jsonb,
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
    })().catch((error) => {
      ensureContactsSchemaPromise = null;
      throw error;
    });
  }

  await ensureContactsSchemaPromise;
}

function makeContactRoutes(
  router: IRouter,
  table: "customers" | "suppliers"
) {
  router.get("/", async (_req, res) => {
    await ensureContactsSchema();
    const result = await pool.query(
      `SELECT * FROM ${table} ORDER BY created_at DESC`
    );
    res.json(result.rows);
  });

  router.post("/", async (req, res) => {
    await ensureContactsSchema();
    const Schema = table === "customers" ? CreateCustomerBody : CreateSupplierBody;
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }
    const { name, neighborhood, address_detail, phone_numbers, notes } = parsed.data;

    if (table === "suppliers") {
      const { supplier_type } = parsed.data as { supplier_type?: string };
      const effectiveType = supplier_type ?? "regular";

      // Only one supplier can be capital_owner
      if (effectiveType === "capital_owner") {
        const existing = await pool.query(
          `SELECT id FROM suppliers WHERE supplier_type = 'capital_owner' LIMIT 1`
        );
        if (existing.rows.length > 0) {
          res.status(400).json({ error: "capital_owner_exists", message: "مورد آخر محدد بالفعل كصاحب رأس المال. قم بتغيير تصنيفه أولاً." });
          return;
        }
      }

      const result = await pool.query(
        `INSERT INTO suppliers (name, neighborhood, address_detail, phone_numbers, notes, supplier_type)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
        [name, neighborhood ?? null, address_detail ?? null, JSON.stringify(phone_numbers), notes ?? null, effectiveType]
      );
      res.status(201).json(result.rows[0]);
      return;
    }

    const result = await pool.query(
      `INSERT INTO ${table} (name, neighborhood, address_detail, phone_numbers, notes)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
      [name, neighborhood ?? null, address_detail ?? null, JSON.stringify(phone_numbers), notes ?? null]
    );
    res.status(201).json(result.rows[0]);
  });

  router.put("/:id", async (req, res) => {
    await ensureContactsSchema();
    const ParamsSchema = table === "customers" ? UpdateCustomerParams : UpdateSupplierParams;
    const BodySchema = table === "customers" ? UpdateCustomerBody : UpdateSupplierBody;

    const paramsParsed = ParamsSchema.safeParse(req.params);
    if (!paramsParsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const bodyParsed = BodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.issues });
      return;
    }

    const { id } = paramsParsed.data;
    const { name, neighborhood, address_detail, phone_numbers, notes } = bodyParsed.data;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (neighborhood !== undefined) { fields.push(`neighborhood = $${idx++}`); values.push(neighborhood); }
    if (address_detail !== undefined) { fields.push(`address_detail = $${idx++}`); values.push(address_detail); }
    if (phone_numbers !== undefined) { fields.push(`phone_numbers = $${idx++}::jsonb`); values.push(JSON.stringify(phone_numbers)); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes); }

    if (table === "suppliers") {
      const { supplier_type } = bodyParsed.data as { supplier_type?: string };
      if (supplier_type !== undefined) {
        // Only one supplier can be capital_owner
        if (supplier_type === "capital_owner") {
          const existing = await pool.query(
            `SELECT id FROM suppliers WHERE supplier_type = 'capital_owner' AND id != $1 LIMIT 1`,
            [id]
          );
          if (existing.rows.length > 0) {
            res.status(400).json({ error: "capital_owner_exists", message: "مورد آخر محدد بالفعل كصاحب رأس المال. قم بتغيير تصنيفه أولاً." });
            return;
          }
        }
        fields.push(`supplier_type = $${idx++}`);
        values.push(supplier_type);
      }
    }

    if (fields.length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE ${table} SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(result.rows[0]);
  });

  router.delete("/:id", async (req, res) => {
    await ensureContactsSchema();
    const ParamsSchema = table === "customers" ? DeleteCustomerParams : DeleteSupplierParams;
    const parsed = ParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const result = await pool.query(
      `DELETE FROM ${table} WHERE id = $1 RETURNING id`,
      [parsed.data.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  });
}

makeContactRoutes(customersRouter, "customers");
makeContactRoutes(suppliersRouter, "suppliers");
