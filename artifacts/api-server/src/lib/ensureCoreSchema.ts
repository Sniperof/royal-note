import { pool } from "@workspace/db";

let ensureCoreSchemaPromise: Promise<void> | null = null;

export async function ensureCoreSchema() {
  if (!ensureCoreSchemaPromise) {
    ensureCoreSchemaPromise = (async () => {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            CREATE TYPE user_role AS ENUM ('super_admin', 'wholesale_trader');
          END IF;
        END$$;
      `);
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
            AND NOT EXISTS (
              SELECT 1
              FROM pg_enum
              WHERE enumtypid = 'user_role'::regtype
                AND enumlabel = 'sales_representative'
            )
          THEN
            ALTER TYPE user_role ADD VALUE 'sales_representative';
          END IF;
        END$$;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id serial PRIMARY KEY,
          username text NOT NULL UNIQUE,
          password_hash text NOT NULL,
          role user_role NOT NULL DEFAULT 'wholesale_trader',
          full_name text NOT NULL,
          email text,
          phone text,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
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
        CREATE INDEX IF NOT EXISTS inventory_sales_rep_prices_inventory_id_idx
        ON inventory_sales_rep_prices (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS inventory_sales_rep_prices_sales_rep_user_id_idx
        ON inventory_sales_rep_prices (sales_rep_user_id)
      `);

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

      await pool.query(`
        CREATE TABLE IF NOT EXISTS brands (
          id serial PRIMARY KEY,
          name text NOT NULL UNIQUE,
          image_path text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id serial PRIMARY KEY,
          date date NOT NULL DEFAULT CURRENT_DATE,
          movement_type text NOT NULL DEFAULT 'expense',
          category text NOT NULL,
          description text NOT NULL,
          amount numeric NOT NULL DEFAULT 0,
          payment_method text NOT NULL DEFAULT 'Cash',
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE expenses
          ADD COLUMN IF NOT EXISTS movement_type text NOT NULL DEFAULT 'expense'
      `);
      await pool.query(`
        UPDATE expenses
        SET movement_type = CASE
          WHEN LOWER(COALESCE(movement_type, 'expense')) = 'income' THEN 'income'
          ELSE 'expense'
        END
        WHERE movement_type IS DISTINCT FROM CASE
          WHEN LOWER(COALESCE(movement_type, 'expense')) = 'income' THEN 'income'
          ELSE 'expense'
        END
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS capital_entries (
          id serial PRIMARY KEY,
          date date NOT NULL DEFAULT CURRENT_DATE,
          source_name text NOT NULL,
          description text NOT NULL,
          amount numeric NOT NULL DEFAULT 0,
          payment_method text NOT NULL DEFAULT 'Cash',
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS invoices (
          id serial PRIMARY KEY,
          invoice_number text NOT NULL UNIQUE,
          customer_id integer REFERENCES customers(id) ON DELETE SET NULL,
          customer_name text,
          date date NOT NULL DEFAULT CURRENT_DATE,
          status text NOT NULL DEFAULT 'CONFIRMED',
          subtotal numeric NOT NULL DEFAULT 0,
          discount numeric NOT NULL DEFAULT 0,
          total numeric NOT NULL DEFAULT 0,
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE invoices
        ALTER COLUMN status SET DEFAULT 'CONFIRMED'
      `);
      await pool.query(`
        UPDATE invoices
        SET status = CASE
          WHEN UPPER(status) = 'VOIDED' THEN 'VOIDED'
          ELSE 'CONFIRMED'
        END
        WHERE status IS DISTINCT FROM CASE
          WHEN UPPER(status) = 'VOIDED' THEN 'VOIDED'
          ELSE 'CONFIRMED'
        END
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS customer_payments (
          id serial PRIMARY KEY,
          invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          payment_date date NOT NULL DEFAULT CURRENT_DATE,
          amount_aed numeric NOT NULL DEFAULT 0,
          payment_method text NOT NULL DEFAULT 'Cash',
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id serial PRIMARY KEY,
          actor_user_id integer REFERENCES users(id) ON DELETE SET NULL,
          actor_role text,
          action_type text NOT NULL,
          entity_type text NOT NULL,
          entity_id integer,
          summary text NOT NULL,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public_catalog_inquiries (
          id serial PRIMARY KEY,
          product_id integer REFERENCES inventory(id) ON DELETE SET NULL,
          product_name text NOT NULL,
          brand text,
          company_name text,
          contact_name text NOT NULL,
          whatsapp text NOT NULL,
          email text,
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id serial PRIMARY KEY,
          invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          inventory_id integer REFERENCES inventory(id) ON DELETE SET NULL,
          barcode text,
          brand text NOT NULL,
          name text NOT NULL,
          size text,
          concentration text,
          gender text,
          qty integer NOT NULL DEFAULT 1,
          unit_price_aed numeric NOT NULL DEFAULT 0,
          cost_usd numeric NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id serial PRIMARY KEY,
          user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type text NOT NULL,
          title text NOT NULL,
          message text,
          quotation_id integer,
          is_read boolean NOT NULL DEFAULT false,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS quotations (
          id serial PRIMARY KEY,
          ref_number text NOT NULL UNIQUE,
          trader_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'pending',
          trader_notes text,
          admin_notes text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS quotation_items (
          id serial PRIMARY KEY,
          quotation_id integer NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
          inventory_id integer NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
          qty_requested integer NOT NULL DEFAULT 1,
          unit_price numeric,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS favorites (
          id serial PRIMARY KEY,
          user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          inventory_id integer NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
          created_at timestamp NOT NULL DEFAULT now(),
          UNIQUE (user_id, inventory_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id serial PRIMARY KEY,
          po_number text NOT NULL UNIQUE,
          supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
          supplier_name text,
          status text NOT NULL DEFAULT 'draft',
          order_date date NOT NULL DEFAULT CURRENT_DATE,
          shipping_cost numeric NOT NULL DEFAULT 0,
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id serial PRIMARY KEY,
          purchase_order_id integer NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
          inventory_id integer REFERENCES inventory(id) ON DELETE SET NULL,
          barcode text,
          brand text NOT NULL,
          name text NOT NULL,
          size text,
          concentration text,
          gender text,
          qty integer NOT NULL DEFAULT 1,
          unit_cost numeric NOT NULL DEFAULT 0,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      // Ensure all purchase_order_items columns added by routes exist at core schema time
      await pool.query(`
        ALTER TABLE purchase_order_items
          ADD COLUMN IF NOT EXISTS supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS main_category text,
          ADD COLUMN IF NOT EXISTS sub_category text,
          ADD COLUMN IF NOT EXISTS is_available_to_order boolean NOT NULL DEFAULT false
      `);

      // ── Supplier type classification ──────────────────────────────────────────
      // 'regular' | 'capital_owner' | 'consignment'
      await pool.query(`
        ALTER TABLE suppliers
          ADD COLUMN IF NOT EXISTS supplier_type text NOT NULL DEFAULT 'regular'
      `);

      // ── PO type and payment method ────────────────────────────────────────────
      // po_type is set at creation time from supplier_type (snapshot for audit stability)
      await pool.query(`
        ALTER TABLE purchase_orders
          ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
          ADD COLUMN IF NOT EXISTS po_type text NOT NULL DEFAULT 'regular'
      `);

      // ── Inventory product ownership ───────────────────────────────────────────
      // Wrapped in DO block: inventory table is created by ensureInventorySchema (inventory route),
      // so it may not exist yet on a fresh database when ensureCoreSchema runs first.
      await pool.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'inventory'
          ) THEN
            BEGIN
              ALTER TABLE inventory ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'owned';
            EXCEPTION WHEN others THEN NULL;
            END;
            BEGIN
              ALTER TABLE inventory ADD COLUMN IF NOT EXISTS consignment_supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL;
            EXCEPTION WHEN others THEN NULL;
            END;
          END IF;
        END $$
      `);

      // ── Inventory sources delivery type ───────────────────────────────────────
      // Same guard: inventory_sources is created by ensureInventorySchema.
      await pool.query(`
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'inventory_sources'
          ) THEN
            BEGIN
              ALTER TABLE inventory_sources ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'external';
            EXCEPTION WHEN others THEN NULL;
            END;
          END IF;
        END $$
      `);

      // ── Invoice items consignment tracking ────────────────────────────────────
      await pool.query(`
        ALTER TABLE invoice_items
          ADD COLUMN IF NOT EXISTS is_consignment boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS consignment_supplier_id integer REFERENCES suppliers(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS consignment_cost_usd numeric
      `);

      // ── Accounts payable ──────────────────────────────────────────────────────
      await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts_payable (
          id serial PRIMARY KEY,
          purchase_order_id integer REFERENCES purchase_orders(id) ON DELETE SET NULL,
          invoice_item_id integer REFERENCES invoice_items(id) ON DELETE SET NULL,
          supplier_id integer NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
          supplier_name text NOT NULL,
          description text NOT NULL,
          amount_usd numeric NOT NULL DEFAULT 0,
          due_date date,
          status text NOT NULL DEFAULT 'open',
          amount_paid_usd numeric NOT NULL DEFAULT 0,
          notes text,
          created_at timestamp NOT NULL DEFAULT now(),
          updated_at timestamp NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts_payable_settlements (
          id serial PRIMARY KEY,
          accounts_payable_id integer NOT NULL REFERENCES accounts_payable(id) ON DELETE CASCADE,
          payment_date date NOT NULL DEFAULT CURRENT_DATE,
          amount_usd numeric NOT NULL DEFAULT 0,
          payment_method text NOT NULL DEFAULT 'Cash',
          notes text,
          created_at timestamp NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS accounts_payable_supplier_id_idx
        ON accounts_payable (supplier_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS accounts_payable_purchase_order_id_idx
        ON accounts_payable (purchase_order_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS accounts_payable_status_idx
        ON accounts_payable (status)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS accounts_payable_settlements_accounts_payable_id_idx
        ON accounts_payable_settlements (accounts_payable_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS accounts_payable_settlements_payment_date_idx
        ON accounts_payable_settlements (payment_date)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx
        ON invoice_items (invoice_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS customer_payments_invoice_id_idx
        ON customer_payments (invoice_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS customer_payments_payment_date_idx
        ON customer_payments (payment_date)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
        ON activity_log (created_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS activity_log_action_type_idx
        ON activity_log (action_type)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS activity_log_entity_idx
        ON activity_log (entity_type, entity_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS activity_log_actor_user_id_idx
        ON activity_log (actor_user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS public_catalog_inquiries_product_id_idx
        ON public_catalog_inquiries (product_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS public_catalog_inquiries_created_at_idx
        ON public_catalog_inquiries (created_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS invoice_items_inventory_id_idx
        ON invoice_items (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS notifications_user_id_idx
        ON notifications (user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS quotations_trader_id_idx
        ON quotations (trader_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS quotation_items_quotation_id_idx
        ON quotation_items (quotation_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS quotation_items_inventory_id_idx
        ON quotation_items (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS favorites_user_id_idx
        ON favorites (user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS favorites_inventory_id_idx
        ON favorites (inventory_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS brands_name_idx
        ON brands (name)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS purchase_order_items_purchase_order_id_idx
        ON purchase_order_items (purchase_order_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS purchase_order_items_inventory_id_idx
        ON purchase_order_items (inventory_id)
      `);
    })().catch((error) => {
      ensureCoreSchemaPromise = null;
      throw error;
    });
  }

  await ensureCoreSchemaPromise;
}
