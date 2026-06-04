import { Router, type IRouter } from "express";
import { inArray } from "drizzle-orm";
import { db, productsTable, storesTable, pricesTable } from "@workspace/db";
import { CompareBasketBody, CompareBasketResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/compare", async (req, res): Promise<void> => {
  const parsed = CompareBasketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { items } = parsed.data;

  if (!items || items.length === 0) {
    res.status(400).json({ error: "Basket is empty" });
    return;
  }

  const productIds = items.map((i) => i.productId);

  // Fetch products, stores, and all relevant prices in parallel
  const [products, stores, prices] = await Promise.all([
    db.select().from(productsTable).where(inArray(productsTable.id, productIds)),
    db.select().from(storesTable),
    db.select().from(pricesTable).where(inArray(pricesTable.productId, productIds)),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Build store totals
  const storeTotals = stores.map((store) => {
    let total = 0;
    for (const item of items) {
      const price = prices.find(
        (p) => p.productId === item.productId && p.storeId === store.id
      );
      if (price) {
        total += Number(price.price) * item.quantity;
      }
    }
    return {
      storeId: store.id,
      storeName: store.name,
      total: Math.round(total * 100) / 100,
    };
  });

  // Find winner (lowest total)
  const winner = storeTotals.reduce((a, b) => (a.total <= b.total ? a : b));
  const runnerUp = storeTotals.reduce((a, b) =>
    a.storeId === winner.storeId ? b : a.total <= b.total ? a : b
  );

  const savings = Math.round((runnerUp.total - winner.total) * 100) / 100;

  // Per-item savings breakdown (winner store vs most expensive store per item)
  const itemSavings = items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;

      const itemPrices = prices
        .filter((p) => p.productId === item.productId)
        .map((p) => ({ storeId: p.storeId, price: Number(p.price) }));

      if (itemPrices.length < 2) return null;

      const winnerPrice = itemPrices.find((p) => p.storeId === winner.storeId);
      const maxPrice = Math.max(...itemPrices.map((p) => p.price));

      if (!winnerPrice) return null;

      const itemSaving =
        Math.round((maxPrice - winnerPrice.price) * item.quantity * 100) / 100;

      if (itemSaving <= 0) return null;

      return {
        productId: item.productId,
        productName: product.name,
        savings: itemSaving,
      };
    })
    .filter(Boolean) as { productId: number; productName: string; savings: number }[];

  res.json(
    CompareBasketResponse.parse({
      storeTotals,
      winnerId: winner.storeId,
      winnerName: winner.storeName,
      winnerTotal: winner.total,
      savings,
      itemSavings,
    })
  );
});

export default router;
