import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, storesTable, pricesTable } from "@workspace/db";
import {
  ListStoresResponse,
  ListPricesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stores", async (_req, res): Promise<void> => {
  const stores = await db.select().from(storesTable).orderBy(storesTable.id);
  res.json(ListStoresResponse.parse(stores));
});

router.get("/prices", async (_req, res): Promise<void> => {
  const prices = await db.select().from(pricesTable);
  res.json(ListPricesResponse.parse(
    prices.map((p) => ({
      productId: p.productId,
      storeId: p.storeId,
      price: Number(p.price),
      unitPrice: p.unitPrice != null ? Number(p.unitPrice) : null,
      lastUpdated: p.lastUpdated?.toISOString() ?? null,
    }))
  ));
});

export default router;
