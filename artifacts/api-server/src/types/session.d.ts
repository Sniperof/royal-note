import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "super_admin" | "wholesale_trader" | "sales_representative";
  }
}
