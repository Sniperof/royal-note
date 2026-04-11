import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  CreateInventoryItemBody,
  BulkCreateInventoryItemsBody,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  DeleteInventoryItemParams,
  SearchInventoryQueryParams,
  GetInventoryItemParams,
  GetInventoryItemTradersParams,
  ReplaceInventoryItemTradersBody,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../middleware/auth";

const router: IRouter = Router();

type TraderAssignmentRow = {
  id: number;
  username: string;
  full_name: string;
};

type SourceAssignmentRow = {
  id: number;
  name: string;
  availability_location: string | null;
  is_preferred: boolean;
  last_known_cost: string | null;
  notes: string | null;
};

type InventoryQueryContext = {
  userId?: number;
  role?: string;
};

let ensureInventorySchemaPromise: Promise<void> | null = null;

async function ensureInventorySchema() {
  if (!ensureInventorySchemaPromise) {
    ensureInventorySchemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id serial PRIMARY KEY,
          barcode text NOT NULL UNIQUE,
          brand text NOT NULL,
          name text NOT NULL,
          description text,
          main_category text DEFAULT 'perfume',
          sub_category text,
          size text,
          concentration text,
          gender text,
          qty integer NOT NULL DEFAULT 0,
          cost_usd numeric NOT NULL DEFAULT 0,
          sale_price_aed numeric NOT NULL DEFAULT 0,
          discount_percent numeric,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE inventory
          ADD COLUMN IF NOT EXISTS description text,
          ADD COLUMN IF NOT EXISTS main_category text,
          ADD COLUMN IF NOT EXISTS sub_category text,
          ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'owned',
          ADD COLUMN IF NOT EXISTS consignment_supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL
      `);
      await pool.query(`
        UPDATE inventory
        SET main_category = 'perfume'
        WHERE main_category IS NULL OR btrim(main_category) = ''
      `);
      await pool.query(`
        ALTER TABLE inventory
          ALTER COLUMN main_category SET DEFAULT 'perfume'
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'inventory_barcode_key'
          ) THEN
            ALTER TABLE inventory
              ADD CONSTRAINT inventory_barcode_key UNIQUE (barcode);
          END IF;
        END $$;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_traders (
          id serial PRIMARY KEY,
          inventory_id integer NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
          trader_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamp NOT NULL DEFAULT now(),
          CONSTRAINT inventory_traders_inventory_id_trader_user_id_key UNIQUE (inventory_id, trader_user_id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_sources (
          id serial PRIMARY KEY,
          inventory_id integer NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
          supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          availability_location text,
          is_preferred boolean NOT NULL DEFAULT false,
          last_known_cost numeric,
          delivery_type text NOT NULL DEFAULT 'external',
          notes text,
          created_at timestamp NOT NULL DEFAULT now(),
          CONSTRAINT inventory_sources_inventory_id_supplier_id_location_key
            UNIQUE (inventory_id, supplier_id, availability_location)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS product_images (
          id serial PRIMARY KEY,
          inventory_id integer NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
          object_path text NOT NULL,
          caption text,
          sort_order integer NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_sales_rep_prices (
          id serial PRIMARY KEY,
          inventory_id integer NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
          sales_rep_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sale_price_aed numeric NOT NULL,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now(),
          CONSTRAINT inventory_sales_rep_prices_inventory_id_sales_rep_user_id_key
            UNIQUE (inventory_id, sales_rep_user_id)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_traders_inventory_id_idx
        ON inventory_traders (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_traders_trader_user_id_idx
        ON inventory_traders (trader_user_id)
      `);
      // ── Price list items ──────────────────────────────────────────────────────
      // Supplier price lists: products offered by a supplier with qty/cost/sale price.
      // Does NOT affect owned inventory value. Inventory record is created with
      // product_type='price_list_only' for new products (no warehouse footprint).
      await pool.query(`
        CREATE TABLE IF NOT EXISTS price_list_items (
          id serial PRIMARY KEY,
          inventory_id integer REFERENCES inventory(id) ON DELETE SET NULL,
          supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
          supplier_name text NOT NULL,
          barcode text,
          brand text NOT NULL,
          name text NOT NULL,
          main_category text,
          sub_category text,
          size text,
          concentration text,
          gender text,
          offered_qty integer NOT NULL DEFAULT 0,
          cost_usd numeric NOT NULL DEFAULT 0,
          suggested_sale_price_aed numeric NOT NULL DEFAULT 0,
          availability_location text,
          notes text,
          show_in_catalog boolean NOT NULL DEFAULT true,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE price_list_items
        ADD COLUMN IF NOT EXISTS show_in_catalog boolean NOT NULL DEFAULT true
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_sources_inventory_id_idx
        ON inventory_sources (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_sources_supplier_id_idx
        ON inventory_sources (supplier_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS price_list_items_inventory_id_idx
        ON price_list_items (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS price_list_items_supplier_id_idx
        ON price_list_items (supplier_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS product_images_inventory_id_idx
        ON product_images (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_sales_rep_prices_inventory_id_idx
        ON inventory_sales_rep_prices (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_sales_rep_prices_sales_rep_user_id_idx
        ON inventory_sales_rep_prices (sales_rep_user_id)
      `);
    })().catch((error) => {
      ensureInventorySchemaPromise = null;
      throw error;
    });
  }

  await ensureInventorySchemaPromise;
}

const WITH_THUMBNAIL = `
  SELECT
    i.*,
    pi.object_path AS thumbnail_path,
    COALESCE(
      (
        SELECT array_agg(it.trader_user_id ORDER BY it.trader_user_id)
        FROM inventory_traders it
        WHERE it.inventory_id = i.id
      ),
      '{}'::int[]
    ) AS assigned_trader_ids,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', u.id,
            'username', u.username,
            'full_name', u.full_name
          )
          ORDER BY u.full_name, u.username
        )
        FROM inventory_traders it
        JOIN users u ON u.id = it.trader_user_id
        WHERE it.inventory_id = i.id
      ),
      '[]'::json
    ) AS assigned_traders
    ,
    COALESCE(
      (
        SELECT array_agg(DISTINCT isrc.supplier_id ORDER BY isrc.supplier_id)
        FROM inventory_sources isrc
        WHERE isrc.inventory_id = i.id
      ),
      '{}'::int[]
    ) AS assigned_source_ids,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', s.id,
            'name', s.name,
            'availability_location', isrc.availability_location,
            'is_preferred', isrc.is_preferred,
            'last_known_cost', isrc.last_known_cost,
            'notes', isrc.notes
          )
          ORDER BY isrc.is_preferred DESC, s.name ASC, isrc.availability_location ASC
        )
        FROM inventory_sources isrc
        JOIN suppliers s ON s.id = isrc.supplier_id
        WHERE isrc.inventory_id = i.id
      ),
      '[]'::json
    ) AS assigned_sources,
    COALESCE(
      (
        SELECT array_agg(DISTINCT isrc.availability_location ORDER BY isrc.availability_location)
        FROM inventory_sources isrc
        WHERE isrc.inventory_id = i.id
          AND isrc.availability_location IS NOT NULL
          AND btrim(isrc.availability_location) <> ''
      ),
      '{}'::text[]
    ) AS available_locations,
    COALESCE(
      (
        SELECT SUM(poi.qty)::integer
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE poi.inventory_id = i.id
          AND po.status = 'confirmed'
          AND poi.is_available_to_order = true
      ),
      0
    ) AS incoming_qty,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', pli.id,
            'supplier_id', pli.supplier_id,
            'supplier_name', pli.supplier_name,
            'offered_qty', pli.offered_qty,
            'cost_usd', pli.cost_usd,
            'suggested_sale_price_aed', pli.suggested_sale_price_aed,
            'availability_location', pli.availability_location,
            'notes', pli.notes
          )
          ORDER BY pli.supplier_name ASC, pli.id ASC
        )
        FROM price_list_items pli
        WHERE pli.inventory_id = i.id AND pli.show_in_catalog = true
      ),
      '[]'::json
    ) AS price_list_offers,
    COALESCE(
      (SELECT SUM(pli.offered_qty) FROM price_list_items pli WHERE pli.inventory_id = i.id AND pli.show_in_catalog = true),
      0
    )::integer AS total_offered_qty,
    CASE
      WHEN COALESCE(i.qty, 0) > 0 AND (
        EXISTS (
          SELECT 1 FROM inventory_sources isrc
          JOIN suppliers s ON s.id = isrc.supplier_id
          WHERE isrc.inventory_id = i.id AND s.supplier_type != 'capital_owner'
        )
        OR EXISTS (SELECT 1 FROM price_list_items pli WHERE pli.inventory_id = i.id AND pli.offered_qty > 0 AND pli.show_in_catalog = true)
      ) THEN 'stock_and_source'
      WHEN COALESCE(i.qty, 0) > 0 THEN 'stock_only'
      WHEN EXISTS (
        SELECT 1 FROM inventory_sources isrc
        JOIN suppliers s ON s.id = isrc.supplier_id
        WHERE isrc.inventory_id = i.id AND s.supplier_type != 'capital_owner'
      ) THEN 'source_only'
      WHEN EXISTS (
        SELECT 1 FROM price_list_items pli WHERE pli.inventory_id = i.id AND pli.offered_qty > 0 AND pli.show_in_catalog = true
      ) THEN 'source_only'
      WHEN EXISTS (
        SELECT 1 FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE poi.inventory_id = i.id
          AND po.status = 'confirmed'
          AND poi.is_available_to_order = true
      ) THEN 'incoming'
      ELSE 'unavailable'
    END AS availability_mode
  FROM inventory i
  LEFT JOIN LATERAL (
    SELECT object_path FROM product_images
    WHERE inventory_id = i.id
    ORDER BY sort_order ASC, id ASC
    LIMIT 1
  ) pi ON true
`;

function buildInventorySelect(context?: InventoryQueryContext) {
  const isSalesRep = context?.role === "sales_representative" && Number.isInteger(context.userId);

  if (isSalesRep) {
    return {
      query: `
        SELECT
          base.*,
          srp.sale_price_aed AS sales_rep_sale_price_aed,
          COALESCE(srp.sale_price_aed, base.sale_price_aed) AS effective_sale_price_aed,
          true AS can_edit_sale_price
        FROM (${WITH_THUMBNAIL}) base
        LEFT JOIN inventory_sales_rep_prices srp
          ON srp.inventory_id = base.id
         AND srp.sales_rep_user_id = $1
      `,
      params: [context.userId as number],
      whereOffset: 1,
    };
  }

  return {
    query: `
      SELECT
        base.*,
        NULL::numeric AS sales_rep_sale_price_aed,
        base.sale_price_aed AS effective_sale_price_aed,
        false AS can_edit_sale_price
      FROM (${WITH_THUMBNAIL}) base
    `,
    params: [] as unknown[],
    whereOffset: 0,
  };
}

async function ensureItemExists(id: number) {
  const result = await pool.query("SELECT id FROM inventory WHERE id = $1", [id]);
  return result.rows.length > 0;
}

async function listAssignedTraders(inventoryId: number) {
  const result = await pool.query<TraderAssignmentRow>(
    `
      SELECT u.id, u.username, u.full_name
      FROM inventory_traders it
      JOIN users u ON u.id = it.trader_user_id
      WHERE it.inventory_id = $1
      ORDER BY u.full_name ASC, u.username ASC
    `,
    [inventoryId],
  );
  return result.rows;
}

async function listAssignedSources(inventoryId: number) {
  const result = await pool.query<SourceAssignmentRow>(
    `
      SELECT
        s.id,
        s.name,
        isrc.availability_location,
        isrc.is_preferred,
        isrc.last_known_cost,
        isrc.notes
      FROM inventory_sources isrc
      JOIN suppliers s ON s.id = isrc.supplier_id
      WHERE isrc.inventory_id = $1
      ORDER BY isrc.is_preferred DESC, s.name ASC, isrc.availability_location ASC
    `,
    [inventoryId],
  );
  return result.rows;
}

async function replaceAssignedTraders(inventoryId: number, traderUserIds: number[]) {
  const normalizedIds = [...new Set(traderUserIds)].sort((a, b) => a - b);

  if (normalizedIds.length > 0) {
    const tradersRes = await pool.query<{ id: number }>(
      `
        SELECT id
        FROM users
        WHERE role IN ('wholesale_trader', 'sales_representative')
          AND id = ANY($1::int[])
      `,
      [normalizedIds],
    );

    if (tradersRes.rows.length !== normalizedIds.length) {
      return { ok: false as const, error: "One or more trader_user_ids are invalid" };
    }
  }

  await pool.query("DELETE FROM inventory_traders WHERE inventory_id = $1", [inventoryId]);

  for (const traderUserId of normalizedIds) {
    await pool.query(
      `
        INSERT INTO inventory_traders (inventory_id, trader_user_id)
        VALUES ($1, $2)
        ON CONFLICT (inventory_id, trader_user_id) DO NOTHING
      `,
      [inventoryId, traderUserId],
    );
  }

  return { ok: true as const, traderUserIds: normalizedIds };
}

async function replaceAssignedSources(
  inventoryId: number,
  sources: Array<{
    supplier_id: number;
    availability_location?: string | null;
    is_preferred?: boolean;
    last_known_cost?: number | null;
    notes?: string | null;
  }>,
) {
  const normalizedSources = sources.map((source) => ({
    supplier_id: source.supplier_id,
    availability_location: source.availability_location?.trim() || null,
    is_preferred: Boolean(source.is_preferred),
    last_known_cost: source.last_known_cost ?? null,
    notes: source.notes?.trim() || null,
  }));

  const supplierIds = [...new Set(normalizedSources.map((source) => source.supplier_id))];
  if (supplierIds.length > 0) {
    const suppliersRes = await pool.query<{ id: number }>(
      `
        SELECT id
        FROM suppliers
        WHERE id = ANY($1::int[])
      `,
      [supplierIds],
    );

    if (suppliersRes.rows.length !== supplierIds.length) {
      return { ok: false as const, error: "One or more supplier_ids are invalid" };
    }
  }

  await pool.query("DELETE FROM inventory_sources WHERE inventory_id = $1", [inventoryId]);

  let preferredAssigned = false;
  for (const source of normalizedSources) {
    const isPreferred = source.is_preferred && !preferredAssigned;
    if (isPreferred) preferredAssigned = true;

    await pool.query(
      `
        INSERT INTO inventory_sources (
          inventory_id,
          supplier_id,
          availability_location,
          is_preferred,
          last_known_cost,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (inventory_id, supplier_id, availability_location)
        DO UPDATE SET
          is_preferred = EXCLUDED.is_preferred,
          last_known_cost = EXCLUDED.last_known_cost,
          notes = EXCLUDED.notes
      `,
      [
        inventoryId,
        source.supplier_id,
        source.availability_location,
        isPreferred,
        source.last_known_cost,
        source.notes,
      ],
    );
  }

  return { ok: true as const };
}

router.get("/", async (req, res) => {
  await ensureInventorySchema();
  const inventorySelect = buildInventorySelect({
    userId: req.session?.userId,
    role: req.session?.role,
  });
  const result = await pool.query(
    `${inventorySelect.query} ORDER BY base.created_at DESC`,
    inventorySelect.params,
  );
  res.json(result.rows);
});

router.get("/search", async (req, res) => {
  await ensureInventorySchema();
  const parsed = SearchInventoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing search query" });
    return;
  }
  const q = `%${parsed.data.q}%`;
  const inventorySelect = buildInventorySelect({
    userId: req.session?.userId,
    role: req.session?.role,
  });
  const result = await pool.query(
    `
      ${inventorySelect.query}
      WHERE base.barcode ILIKE $${inventorySelect.whereOffset + 1}
         OR base.name ILIKE $${inventorySelect.whereOffset + 1}
         OR base.brand ILIKE $${inventorySelect.whereOffset + 1}
      ORDER BY base.created_at DESC
    `,
    [...inventorySelect.params, q],
  );
  res.json(result.rows);
});

router.post("/bulk", async (req, res) => {
  await ensureInventorySchema();
  const parsed = BulkCreateInventoryItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const requestedTraderAssignments = parsed.data.items.some(
    (item) => item.trader_user_ids && item.trader_user_ids.length > 0,
  );
  if (requestedTraderAssignments && (!req.session?.userId || req.session.role !== "super_admin")) {
    res.status(403).json({ error: "Admin access required for trader assignments" });
    return;
  }

  const { items } = parsed.data;
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const item of items) {
    const {
      barcode,
      brand,
      name,
      description,
      main_category,
      sub_category,
      size,
      concentration,
      gender,
      qty,
      cost_usd,
      sale_price_aed,
      trader_user_ids,
    } = item;

    try {
      const insertResult = await pool.query<{ id: number }>(
        `
          INSERT INTO inventory (
            barcode, brand, name, description, main_category, sub_category,
            size, concentration, gender, qty, cost_usd, sale_price_aed
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (barcode) DO NOTHING
          RETURNING id
        `,
        [
          barcode,
          brand,
          name,
          description ?? null,
          main_category,
          sub_category ?? null,
          size ?? null,
          concentration ?? null,
          gender ?? null,
          qty,
          cost_usd,
          sale_price_aed,
        ],
      );

      const insertedItem = insertResult.rows[0];
      if (!insertedItem) {
        skipped++;
        errors.push(`Barcode "${barcode}" already exists - skipped`);
        continue;
      }

      if (trader_user_ids && trader_user_ids.length > 0) {
        const assignment = await replaceAssignedTraders(insertedItem.id, trader_user_ids);
        if (!assignment.ok) {
          skipped++;
          errors.push(`Row "${barcode}": ${assignment.error}`);
          await pool.query("DELETE FROM inventory WHERE id = $1", [insertedItem.id]);
          continue;
        }
      }

      inserted++;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      skipped++;
      if (error.code === "23505") {
        errors.push(`Barcode "${barcode}" already exists - skipped`);
      } else {
        errors.push(`Row "${barcode}": ${error.message ?? "Unknown error"}`);
      }
    }
  }

  res.json({ inserted, skipped, errors });
});

router.post("/", async (req, res) => {
  await ensureInventorySchema();
  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const {
    barcode,
    brand,
    name,
    description,
    main_category,
    sub_category,
    size,
    concentration,
    gender,
    qty,
    cost_usd,
    sale_price_aed,
    trader_user_ids,
  } = parsed.data;

  if (trader_user_ids && trader_user_ids.length > 0 && (!req.session?.userId || req.session.role !== "super_admin")) {
    res.status(403).json({ error: "Admin access required for trader assignments" });
    return;
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO inventory (
          barcode, brand, name, description, main_category, sub_category,
          size, concentration, gender, qty, cost_usd, sale_price_aed
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        barcode,
        brand,
        name,
        description ?? null,
        main_category,
        sub_category ?? null,
        size ?? null,
        concentration ?? null,
        gender ?? null,
        qty,
        cost_usd,
        sale_price_aed,
      ],
    );

    const createdId = result.rows[0]?.id as number | undefined;
    if (!createdId) {
      res.status(500).json({ error: "Failed to create item" });
      return;
    }

    if (trader_user_ids && trader_user_ids.length > 0) {
      const assignment = await replaceAssignedTraders(createdId, trader_user_ids);
      if (!assignment.ok) {
        await pool.query("DELETE FROM inventory WHERE id = $1", [createdId]);
        res.status(400).json({ error: assignment.error });
        return;
      }
    }

    const full = await pool.query(`${WITH_THUMBNAIL} WHERE i.id = $1`, [createdId]);
    res.status(201).json(full.rows[0]);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "23505") {
      res.status(409).json({ error: "Barcode already exists" });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req, res) => {
  await ensureInventorySchema();
  const parsed = GetInventoryItemParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const inventorySelect = buildInventorySelect({
    userId: req.session?.userId,
    role: req.session?.role,
  });
  const result = await pool.query(
    `${inventorySelect.query} WHERE base.id = $${inventorySelect.whereOffset + 1}`,
    [...inventorySelect.params, parsed.data.id],
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
  await ensureInventorySchema();
  const paramsParsed = UpdateInventoryItemParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { id } = paramsParsed.data;
  const {
    barcode,
    brand,
    name,
    description,
    main_category,
    sub_category,
    size,
    concentration,
    gender,
    qty,
    cost_usd,
    sale_price_aed,
    trader_user_ids,
  } = parsed.data;

  if (trader_user_ids !== undefined && (!req.session?.userId || req.session.role !== "super_admin")) {
    res.status(403).json({ error: "Admin access required for trader assignments" });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (barcode !== undefined) { fields.push(`barcode = $${idx++}`); values.push(barcode); }
  if (brand !== undefined) { fields.push(`brand = $${idx++}`); values.push(brand); }
  if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description ?? null); }
  if (main_category !== undefined) { fields.push(`main_category = $${idx++}`); values.push(main_category); }
  if (sub_category !== undefined) { fields.push(`sub_category = $${idx++}`); values.push(sub_category ?? null); }
  if (size !== undefined) { fields.push(`size = $${idx++}`); values.push(size ?? null); }
  if (concentration !== undefined) { fields.push(`concentration = $${idx++}`); values.push(concentration ?? null); }
  if (gender !== undefined) { fields.push(`gender = $${idx++}`); values.push(gender ?? null); }
  if (qty !== undefined) { fields.push(`qty = $${idx++}`); values.push(qty); }
  if (cost_usd !== undefined) { fields.push(`cost_usd = $${idx++}`); values.push(cost_usd); }
  if (sale_price_aed !== undefined) { fields.push(`sale_price_aed = $${idx++}`); values.push(sale_price_aed); }

  if (fields.length > 0) {
    values.push(id);
    const updateResult = await pool.query(
      `UPDATE inventory SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id`,
      values,
    );

    if (updateResult.rows.length === 0) {
      res.status(404).json({ error: "Item not found" });
      return;
    }
  } else if (!(trader_user_ids !== undefined)) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  if (trader_user_ids !== undefined) {
    const exists = await ensureItemExists(id);
    if (!exists) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const assignment = await replaceAssignedTraders(id, trader_user_ids);
    if (!assignment.ok) {
      res.status(400).json({ error: assignment.error });
      return;
    }
  }

  const result = await pool.query(`${WITH_THUMBNAIL} WHERE i.id = $1`, [id]);
  res.json(result.rows[0]);
});

router.put("/:id/sales-rep-price", requireAuth, async (req: any, res) => {
  await ensureInventorySchema();
  if (req.session.role !== "sales_representative") {
    return res.status(403).json({ error: "Sales representative access required" });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const rawPrice = req.body?.sale_price_aed;
  const resetPrice = rawPrice === null || rawPrice === undefined || rawPrice === "";
  const normalizedPrice = resetPrice ? null : Number(rawPrice);

  if (!resetPrice && (!Number.isFinite(normalizedPrice) || normalizedPrice < 0)) {
    return res.status(400).json({ error: "sale_price_aed must be a valid number" });
  }

  const exists = await ensureItemExists(id);
  if (!exists) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (resetPrice) {
    await pool.query(
      "DELETE FROM inventory_sales_rep_prices WHERE inventory_id = $1 AND sales_rep_user_id = $2",
      [id, req.session.userId],
    );
  } else {
    await pool.query(
      `
        INSERT INTO inventory_sales_rep_prices (inventory_id, sales_rep_user_id, sale_price_aed, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (inventory_id, sales_rep_user_id)
        DO UPDATE SET sale_price_aed = EXCLUDED.sale_price_aed, updated_at = NOW()
      `,
      [id, req.session.userId, normalizedPrice],
    );
  }

  const inventorySelect = buildInventorySelect({
    userId: req.session.userId,
    role: req.session.role,
  });
  const result = await pool.query(
    `${inventorySelect.query} WHERE base.id = $${inventorySelect.whereOffset + 1}`,
    [...inventorySelect.params, id],
  );

  return res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
  await ensureInventorySchema();
  const parsed = DeleteInventoryItemParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const result = await pool.query("DELETE FROM inventory WHERE id = $1 RETURNING id", [parsed.data.id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json({ success: true });
});

router.get("/:id/traders", requireAuth, requireAdmin, async (req, res) => {
  await ensureInventorySchema();
  const parsed = GetInventoryItemTradersParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const exists = await ensureItemExists(parsed.data.id);
  if (!exists) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const traders = await listAssignedTraders(parsed.data.id);
  res.json({
    inventory_id: parsed.data.id,
    trader_user_ids: traders.map((trader) => trader.id),
    traders,
  });
});

router.put("/:id/traders", requireAuth, requireAdmin, async (req, res) => {
  await ensureInventorySchema();
  const paramsParsed = GetInventoryItemTradersParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const bodyParsed = ReplaceInventoryItemTradersBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body", details: bodyParsed.error.issues });
    return;
  }

  const exists = await ensureItemExists(paramsParsed.data.id);
  if (!exists) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const assignment = await replaceAssignedTraders(paramsParsed.data.id, bodyParsed.data.trader_user_ids);
  if (!assignment.ok) {
    res.status(400).json({ error: assignment.error });
    return;
  }

  const traders = await listAssignedTraders(paramsParsed.data.id);
  res.json({
    inventory_id: paramsParsed.data.id,
    trader_user_ids: traders.map((trader) => trader.id),
    traders,
  });
});

router.get("/:id/sources", requireAuth, requireAdmin, async (req, res) => {
  await ensureInventorySchema();
  const parsed = GetInventoryItemTradersParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const exists = await ensureItemExists(parsed.data.id);
  if (!exists) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const sources = await listAssignedSources(parsed.data.id);
  res.json({
    inventory_id: parsed.data.id,
    supplier_ids: [...new Set(sources.map((source) => source.id))],
    sources,
  });
});

// GET /api/inventory/:id/sources-detail — full source history (POs + price lists + inventory_sources)
router.get("/:id/sources-detail", requireAuth, requireAdmin, async (req, res) => {
  await ensureInventorySchema();
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const exists = await ensureItemExists(id);
  if (!exists) { res.status(404).json({ error: "Item not found" }); return; }

  // 1) PO sources: items that have been received or are in confirmed/received POs
  const poRes = await pool.query(`
    SELECT
      COALESCE(s.name, po.supplier_name)            AS supplier_name,
      COALESCE(poi.supplier_id, po.supplier_id)     AS supplier_id,
      po.id                                          AS po_id,
      po.po_number,
      po.po_type,
      po.payment_method,
      po.status                                      AS po_status,
      poi.qty,
      poi.unit_cost,
      ROUND(po.shipping_cost::numeric
            * (poi.qty * poi.unit_cost)
            / NULLIF((SELECT SUM(p2.qty * p2.unit_cost)
                      FROM purchase_order_items p2
                      WHERE p2.purchase_order_id = po.id), 0), 4)
                                                     AS shipping_share,
      poi.is_received,
      po.order_date,
      po.created_at
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    LEFT JOIN suppliers s ON s.id = COALESCE(poi.supplier_id, po.supplier_id)
    WHERE poi.inventory_id = $1
    ORDER BY po.created_at DESC
  `, [id]);

  // 2) Price list sources
  const plRes = await pool.query(`
    SELECT pli.*, s.supplier_type
    FROM price_list_items pli
    LEFT JOIN suppliers s ON s.id = pli.supplier_id
    WHERE pli.inventory_id = $1
    ORDER BY pli.supplier_name ASC, pli.created_at DESC
  `, [id]);

  // 3) Inventory source network (existing)
  const sources = await listAssignedSources(id);

  res.json({
    po_sources: poRes.rows,
    price_list_sources: plRes.rows,
    inventory_sources: sources,
  });
});

router.put("/:id/sources", requireAuth, requireAdmin, async (req, res) => {
  await ensureInventorySchema();
  const paramsParsed = GetInventoryItemTradersParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const exists = await ensureItemExists(paramsParsed.data.id);
  if (!exists) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const sources = Array.isArray(req.body?.sources) ? req.body.sources : null;
  if (!sources) {
    res.status(400).json({ error: "sources array is required" });
    return;
  }

  const normalizedSources = sources
    .filter((source): source is Record<string, unknown> => typeof source === "object" && source !== null)
    .map((source) => ({
      supplier_id: Number(source.supplier_id),
      availability_location:
        typeof source.availability_location === "string" ? source.availability_location : null,
      is_preferred: Boolean(source.is_preferred),
      last_known_cost:
        source.last_known_cost === null || source.last_known_cost === undefined || source.last_known_cost === ""
          ? null
          : Number(source.last_known_cost),
      notes: typeof source.notes === "string" ? source.notes : null,
    }));

  if (normalizedSources.some((source) => Number.isNaN(source.supplier_id) || source.supplier_id <= 0)) {
    res.status(400).json({ error: "Invalid supplier_id in sources" });
    return;
  }

  if (
    normalizedSources.some(
      (source) => source.last_known_cost !== null && Number.isNaN(source.last_known_cost),
    )
  ) {
    res.status(400).json({ error: "Invalid last_known_cost in sources" });
    return;
  }

  const assignment = await replaceAssignedSources(paramsParsed.data.id, normalizedSources);
  if (!assignment.ok) {
    res.status(400).json({ error: assignment.error });
    return;
  }

  const assignedSources = await listAssignedSources(paramsParsed.data.id);
  res.json({
    inventory_id: paramsParsed.data.id,
    supplier_ids: [...new Set(assignedSources.map((source) => source.id))],
    sources: assignedSources,
  });
});

// PUT /api/inventory/:id/discount - admin sets or clears discount, notifies all trader accounts
router.put("/:id/discount", async (req: any, res): Promise<void> => {
  await ensureInventorySchema();
  if (!req.session?.userId || req.session.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { discount_percent } = req.body as { discount_percent: number | null };

  const itemRes = await pool.query("SELECT * FROM inventory WHERE id = $1", [id]);
  if (itemRes.rows.length === 0) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  const item = itemRes.rows[0];

  const val = discount_percent == null || discount_percent === 0 ? null : Number(discount_percent);
  await pool.query("UPDATE inventory SET discount_percent = $1 WHERE id = $2", [val, id]);

  if (val !== null && val > 0) {
    const tradersRes = await pool.query(
      "SELECT id FROM users WHERE role IN ('wholesale_trader', 'sales_representative')",
    );
    for (const trader of tradersRes.rows) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, type, title, message)
          VALUES ($1, 'product_discount', $2, $3)
        `,
        [
          trader.id,
          `${val}% discount on ${item.brand} ${item.name}`,
          `A special discount of ${val}% has been applied to ${item.brand} ${item.name}${item.size ? ` (${item.size})` : ""}. Check the catalog now!`,
        ],
      );
    }
  }

  res.json({ success: true, discount_percent: val });
  return;
});

export default router;
