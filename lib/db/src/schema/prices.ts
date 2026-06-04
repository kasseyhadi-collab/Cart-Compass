import { pgTable, integer, numeric, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";
import { storesTable } from "./stores";

export const pricesTable = pgTable("prices", {
  productId: integer("product_id").notNull().references(() => productsTable.id),
  storeId: integer("store_id").notNull().references(() => storesTable.id),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (t) => [primaryKey({ columns: [t.productId, t.storeId] })]);

export const insertPriceSchema = createInsertSchema(pricesTable);
export type InsertPrice = z.infer<typeof insertPriceSchema>;
export type Price = typeof pricesTable.$inferSelect;
