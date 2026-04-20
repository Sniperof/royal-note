import { Router } from "express";
import { pool } from "@workspace/db";
import { ensureInventorySchema } from "./inventory";
import { ensureCoreSchema } from "../lib/ensureCoreSchema";
import { insertPublicCatalogEvent } from "../lib/publicCatalogAnalytics";

export const publicCatalogRouter = Router();

const PUBLIC_PRODUCT_SELECT = `
  SELECT
    i.id,
    i.brand,
    i.name,
    i.description,
    i.public_price_hint,
    i.main_category,
    i.sub_category,
    i.size,
    i.concentration,
    i.gender,
    i.discount_percent,
    thumb.object_path AS thumbnail_path,
    COALESCE(i.qty, 0) AS internal_qty,
    COALESCE(incoming.incoming_qty, 0) AS internal_incoming_qty
  FROM inventory i
  LEFT JOIN LATERAL (
    SELECT pi.object_path
    FROM product_images pi
    WHERE pi.inventory_id = i.id
    ORDER BY pi.sort_order ASC, pi.id ASC
    LIMIT 1
  ) thumb ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(poi.qty), 0)::integer AS incoming_qty
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE poi.inventory_id = i.id
      AND po.status = 'confirmed'
      AND poi.is_available_to_order = true
  ) incoming ON true
`;

function toAvailabilityLabel(qty: unknown, incomingQty: unknown) {
  const normalizedQty = Number(qty ?? 0);
  const normalizedIncomingQty = Number(incomingQty ?? 0);

  if (Number.isFinite(normalizedQty) && normalizedQty > 10) return "available";
  if (Number.isFinite(normalizedQty) && normalizedQty > 0) return "limited";
  if (Number.isFinite(normalizedIncomingQty) && normalizedIncomingQty > 0) return "coming_soon";
  return "unavailable";
}

function toPublicProduct(row: Record<string, unknown>) {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    description: row.description ?? null,
    public_price_hint: row.public_price_hint ?? null,
    main_category: row.main_category,
    sub_category: row.sub_category ?? null,
    size: row.size ?? null,
    concentration: row.concentration ?? null,
    gender: row.gender ?? null,
    thumbnail_path: row.thumbnail_path ?? null,
    discount_percent: row.discount_percent ?? null,
    availability_label: toAvailabilityLabel(row.internal_qty, row.internal_incoming_qty),
  };
}

publicCatalogRouter.get("/catalog", async (req, res) => {
  await ensureInventorySchema();

  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(48, Math.max(1, Number.parseInt(String(req.query.page_size ?? "24"), 10) || 24));
  const offset = (page - 1) * pageSize;
  const params: unknown[] = [];
  const whereParts = ["i.is_active = true", "i.is_public = true"];

  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;
  const brand = typeof req.query.brand === "string" && req.query.brand.trim() ? req.query.brand.trim() : null;
  const mainCategory =
    typeof req.query.main_category === "string" && req.query.main_category.trim()
      ? req.query.main_category.trim()
      : null;
  const subCategory =
    typeof req.query.sub_category === "string" && req.query.sub_category.trim()
      ? req.query.sub_category.trim()
      : null;
  const gender = typeof req.query.gender === "string" && req.query.gender.trim() ? req.query.gender.trim() : null;

  if (q) {
    params.push(`%${q}%`);
    const idx = params.length;
    whereParts.push(`(
      i.brand ILIKE $${idx}
      OR i.name ILIKE $${idx}
      OR COALESCE(i.description, '') ILIKE $${idx}
    )`);
  }

  if (brand) {
    params.push(brand);
    whereParts.push(`i.brand = $${params.length}`);
  }

  if (mainCategory) {
    params.push(mainCategory);
    whereParts.push(`i.main_category = $${params.length}`);
  }

  if (subCategory) {
    params.push(subCategory);
    whereParts.push(`i.sub_category = $${params.length}`);
  }

  if (gender) {
    params.push(gender);
    whereParts.push(`i.gender = $${params.length}`);
  }

  const whereClause = whereParts.join("\n            AND ");

  try {
    const [itemsResult, countResult] = await Promise.all([
      pool.query(
        `
          ${PUBLIC_PRODUCT_SELECT}
          WHERE ${whereClause}
          ORDER BY i.created_at DESC, i.id DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `,
        [...params, pageSize, offset],
      ),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM inventory i
          WHERE ${whereClause}
        `,
        params,
      ),
    ]);

    const total = countResult.rows[0]?.total ?? 0;

    return res.json({
      items: itemsResult.rows.map(toPublicProduct),
      pagination: {
        page,
        page_size: pageSize,
        total_items: total,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

publicCatalogRouter.get("/catalog/:id", async (req, res) => {
  await ensureInventorySchema();
  await ensureCoreSchema();

  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const productResult = await pool.query(
      `
        ${PUBLIC_PRODUCT_SELECT}
        WHERE i.is_active = true
          AND i.is_public = true
          AND i.id = $1
      `,
      [id],
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const product = productResult.rows[0];
    try {
      await insertPublicCatalogEvent({
        eventType: "product_view",
        productId: Number(product.id),
        productName: String(product.name),
        brand: product.brand ? String(product.brand) : null,
      });
    } catch (eventError) {
      console.error(eventError);
    }

    const similarResult = await pool.query(
      `
        ${PUBLIC_PRODUCT_SELECT}
        WHERE i.is_active = true
          AND i.is_public = true
          AND i.id <> $1
          AND (
            i.brand = $2
            OR i.main_category = $3
          )
        ORDER BY
          CASE WHEN i.brand = $2 THEN 0 ELSE 1 END,
          i.created_at DESC,
          i.id DESC
        LIMIT 6
      `,
      [id, product.brand, product.main_category],
    );

    return res.json({
      ...toPublicProduct(product),
      similar_products: similarResult.rows.map(toPublicProduct),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

publicCatalogRouter.post("/catalog/:id/whatsapp-click", async (req, res) => {
  await ensureInventorySchema();
  await ensureCoreSchema();

  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const productResult = await pool.query(
      `
        SELECT id, brand, name
        FROM inventory
        WHERE id = $1
          AND is_active = true
          AND is_public = true
      `,
      [id],
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productResult.rows[0];
    await insertPublicCatalogEvent({
      eventType: "whatsapp_click",
      productId: Number(product.id),
      productName: String(product.name),
      brand: product.brand ? String(product.brand) : null,
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

publicCatalogRouter.post("/inquiries", async (req, res) => {
  await ensureInventorySchema();
  await ensureCoreSchema();

  const {
    product_id,
    items,
    company_name,
    contact_name,
    whatsapp,
    email,
    notes,
  } = (req.body ?? {}) as Record<string, unknown>;

  const contactName = typeof contact_name === "string" ? contact_name.trim() : "";
  const companyName = typeof company_name === "string" ? company_name.trim() : "";
  const whatsappValue = typeof whatsapp === "string" ? whatsapp.trim() : "";
  const emailValue = typeof email === "string" ? email.trim() : "";
  const notesValue = typeof notes === "string" ? notes.trim() : "";

  const parsedItems = Array.isArray(items)
    ? items
        .map((entry) => {
          const record = entry as Record<string, unknown>;
          const parsedProductId = Number(record?.product_id);
          const parsedQty = Number(record?.qty);
          if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) return null;
          if (!Number.isInteger(parsedQty) || parsedQty <= 0) return null;
          return { product_id: parsedProductId, qty: parsedQty };
        })
        .filter((entry): entry is { product_id: number; qty: number } => entry !== null)
    : [];

  const normalizedItems =
    parsedItems.length > 0
      ? parsedItems
      : (() => {
          const fallbackProductId = Number(product_id);
          if (!Number.isInteger(fallbackProductId) || fallbackProductId <= 0) return [];
          return [{ product_id: fallbackProductId, qty: 1 }];
        })();

  if (normalizedItems.length === 0) {
    return res.status(400).json({ error: "At least one valid item is required" });
  }

  if (!contactName) {
    return res.status(400).json({ error: "contact_name is required" });
  }
  if (!whatsappValue) {
    return res.status(400).json({ error: "whatsapp is required" });
  }

  try {
    const requestedIds = Array.from(new Set(normalizedItems.map((item) => item.product_id)));
    const productResult = await pool.query(
      `
        SELECT id, brand, name
        FROM inventory
        WHERE id = ANY($1::int[])
          AND is_active = true
          AND is_public = true
      `,
      [requestedIds],
    );

    if (productResult.rows.length !== requestedIds.length) {
      return res.status(404).json({ error: "One or more products were not found" });
    }

    const productsById = new Map<number, { id: number; brand: string | null; name: string }>();
    for (const row of productResult.rows) {
      productsById.set(Number(row.id), {
        id: Number(row.id),
        brand: row.brand ? String(row.brand) : null,
        name: String(row.name),
      });
    }

    const inquiryItems = normalizedItems.map((item) => {
      const product = productsById.get(item.product_id)!;
      return {
        product_id: product.id,
        product_name: product.name,
        brand: product.brand,
        qty: item.qty,
      };
    });

    const primaryItem = inquiryItems[0];
    const insertResult = await pool.query(
      `
        INSERT INTO public_catalog_inquiries (
          product_id,
          product_name,
          brand,
          company_name,
          contact_name,
          whatsapp,
          email,
          notes,
          items
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        RETURNING id, created_at
      `,
      [
        primaryItem.product_id,
        primaryItem.product_name,
        primaryItem.brand,
        companyName || null,
        contactName,
        whatsappValue,
        emailValue || null,
        notesValue || null,
        JSON.stringify(inquiryItems),
      ],
    );

    const adminUsers = await pool.query<{ id: number }>(
      `
        SELECT id
        FROM users
        WHERE role = 'super_admin'
          AND is_active = true
      `,
    );

    for (const admin of adminUsers.rows) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, type, title, message)
          VALUES ($1, 'public_catalog_inquiry', $2, $3)
        `,
        [
          admin.id,
          "New public catalog inquiry",
          `${contactName} requested ${inquiryItems.length} product${inquiryItems.length === 1 ? "" : "s"}${companyName ? ` for ${companyName}` : ""}.`,
        ],
      );
    }

    try {
      await Promise.all(
        inquiryItems.map((item) =>
          insertPublicCatalogEvent({
            eventType: "inquiry_submitted",
            productId: item.product_id,
            inquiryId: Number(insertResult.rows[0].id),
            productName: item.product_name,
            brand: item.brand ?? null,
          }),
        ),
      );
    } catch (eventError) {
      console.error(eventError);
    }

    return res.status(201).json({
      success: true,
      inquiry_id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});
