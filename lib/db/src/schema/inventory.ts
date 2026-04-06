import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const inventoryTable = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    barcode: text("barcode").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    mainCategory: text("main_category").notNull().default("perfume"),
    subCategory: text("sub_category"),
    size: text("size"),
    concentration: text("concentration"),
    gender: text("gender"),
    qty: integer("qty").notNull().default(0),
    costUsd: numeric("cost_usd").notNull(),
    salePriceAed: numeric("sale_price_aed").notNull(),
    discountPercent: numeric("discount_percent"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    inventoryBarcodeUnique: unique("inventory_barcode_key").on(table.barcode),
  }),
);

export const inventoryTradersTable = pgTable(
  "inventory_traders",
  {
    id: serial("id").primaryKey(),
    inventoryId: integer("inventory_id")
      .notNull()
      .references(() => inventoryTable.id, { onDelete: "cascade" }),
    traderUserId: integer("trader_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    inventoryTraderUnique: unique("inventory_traders_inventory_id_trader_user_id_key").on(
      table.inventoryId,
      table.traderUserId,
    ),
  }),
);

export type Inventory = typeof inventoryTable.$inferSelect;
export type InsertInventory = typeof inventoryTable.$inferInsert;
export type InventoryTrader = typeof inventoryTradersTable.$inferSelect;
export type InsertInventoryTrader = typeof inventoryTradersTable.$inferInsert;
