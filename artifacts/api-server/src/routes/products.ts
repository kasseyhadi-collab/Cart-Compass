import { Router, type IRouter } from "express";
import { ilike, eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  ListProductsQueryParams,
  GetProductParams,
  ListProductsResponse,
  GetProductResponse,
  ListCategoriesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, search } = parsed.data;

  let query = db.select().from(productsTable).$dynamic();

  if (category) {
    query = query.where(eq(productsTable.category, category));
  } else if (search) {
    query = query.where(ilike(productsTable.name, `%${search}%`));
  }

  const products = await query.orderBy(productsTable.name);
  res.json(ListProductsResponse.parse(products));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(GetProductResponse.parse(product));
});

router.get("/categories", async (_req, res): Promise<void> => {
  const products = await db
    .selectDistinct({ category: productsTable.category })
    .from(productsTable)
    .orderBy(productsTable.category);

  const categories = products.map((p) => ({ name: p.category }));
  res.json(ListCategoriesResponse.parse(categories));
});

export default router;
