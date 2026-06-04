import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { eq, inArray, sql } from "drizzle-orm";
import { db, productsTable, storesTable, pricesTable } from "@workspace/db";
import { ImportSpreadsheetResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type SheetResult = { inserted: number; updated: number; skipped: number };
type ImportError = { sheet: string; row: number; message: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSheet(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}

function sendWorkbook(
  res: Parameters<typeof router.get>[1] extends (req: unknown, res: infer R) => unknown ? R : never,
  wb: XLSX.WorkBook,
  filename: string
) {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  (res as any)
    .set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set("Content-Disposition", `attachment; filename="${filename}"`)
    .send(buf);
}

function makeSheet(headers: string[], rows: Record<string, unknown>[] = []): XLSX.WorkSheet {
  const data = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Column widths — roughly match header length
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
  // Bold header row style hint (supported by some readers)
  ws["!rows"] = [{ hpt: 18 }];
  return ws;
}

// ─── Template download ───────────────────────────────────────────────────────

router.get("/admin/template", async (_req, res): Promise<void> => {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(["ProductID", "ProductName", "Category", "Brand", "PackageSize", "UnitType", "BaseUnit"]),
    "Products"
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(["StoreID", "StoreName"]),
    "Stores"
  );
  XLSX.utils.book_append_sheet(
    wb,
    makeSheet(["ProductID", "StoreID", "Price", "UnitPrice", "LastUpdated"]),
    "Prices"
  );

  sendWorkbook(res as any, wb, "CartCompass_Template.xlsx");
});

// ─── Export current data ─────────────────────────────────────────────────────

router.get("/admin/export", async (_req, res): Promise<void> => {
  const [products, stores, prices] = await Promise.all([
    db.select().from(productsTable).orderBy(productsTable.id),
    db.select().from(storesTable).orderBy(storesTable.id),
    db.select().from(pricesTable).orderBy(pricesTable.productId, pricesTable.storeId),
  ]);

  const wb = XLSX.utils.book_new();

  // Products sheet
  const productHeaders = ["ProductID", "ProductName", "Category", "Brand", "PackageSize", "UnitType", "BaseUnit"];
  const productRows = products.map((p) => ({
    ProductID: p.id,
    ProductName: p.name,
    Category: p.category,
    Brand: p.brand ?? "",
    PackageSize: p.packageSize ?? "",
    UnitType: p.unitType ?? "",
    BaseUnit: p.baseUnit ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(productHeaders, productRows), "Products");

  // Stores sheet
  const storeHeaders = ["StoreID", "StoreName"];
  const storeRows = stores.map((s) => ({ StoreID: s.id, StoreName: s.name }));
  XLSX.utils.book_append_sheet(wb, makeSheet(storeHeaders, storeRows), "Stores");

  // Prices sheet
  const priceHeaders = ["ProductID", "StoreID", "Price", "UnitPrice", "LastUpdated"];
  const priceRows = prices.map((p) => ({
    ProductID: p.productId,
    StoreID: p.storeId,
    Price: Number(p.price),
    UnitPrice: p.unitPrice != null ? Number(p.unitPrice) : "",
    LastUpdated: p.lastUpdated ? p.lastUpdated.toISOString().slice(0, 10) : "",
  }));
  XLSX.utils.book_append_sheet(wb, makeSheet(priceHeaders, priceRows), "Prices");

  const today = new Date().toISOString().slice(0, 10);
  sendWorkbook(res as any, wb, `CartCompass_Export_${today}.xlsx`);
});

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [productCount, storeCount, priceCount, missingPrices, missingBaseUnit, lastImport] =
    await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int AS count FROM products`),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM stores`),
      db.execute(sql`SELECT COUNT(*)::int AS count FROM prices`),
      db.execute(
        sql`SELECT COUNT(*)::int AS count FROM products WHERE id NOT IN (SELECT DISTINCT product_id FROM prices)`
      ),
      db.execute(
        sql`SELECT COUNT(*)::int AS count FROM products WHERE base_unit IS NULL OR base_unit = ''`
      ),
      db.execute(sql`SELECT MAX(last_updated) AS last_updated FROM prices`),
    ]);

  res.json({
    products: productCount.rows[0]?.count ?? 0,
    stores: storeCount.rows[0]?.count ?? 0,
    priceRecords: priceCount.rows[0]?.count ?? 0,
    productsMissingPrices: missingPrices.rows[0]?.count ?? 0,
    productsMissingBaseUnit: missingBaseUnit.rows[0]?.count ?? 0,
    lastImport: (lastImport.rows[0]?.last_updated as string) ?? null,
  });
});

// ─── Import ──────────────────────────────────────────────────────────────────

async function importProducts(
  rows: Record<string, unknown>[],
  errors: ImportError[]
): Promise<SheetResult> {
  const result: SheetResult = { inserted: 0, updated: 0, skipped: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const name = row["ProductName"] ?? row["Name"] ?? row["name"];
    const category = row["Category"] ?? row["category"];

    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({ sheet: "Products", row: rowNum, message: "Missing ProductName" });
      result.skipped++;
      continue;
    }
    if (!category || typeof category !== "string" || !category.trim()) {
      errors.push({ sheet: "Products", row: rowNum, message: "Missing Category" });
      result.skipped++;
      continue;
    }

    const productId = row["ProductID"] ?? row["Id"] ?? row["id"];
    const brand = row["Brand"] ?? row["brand"] ?? null;
    const packageSize = row["PackageSize"] ?? row["Package Size"] ?? null;
    const unitType = row["UnitType"] ?? row["Unit Type"] ?? null;
    const baseUnit = row["BaseUnit"] ?? row["Base Unit"] ?? null;

    const values = {
      name: String(name).trim(),
      category: String(category).trim(),
      brand: brand ? String(brand).trim() : null,
      packageSize: packageSize ? String(packageSize).trim() : null,
      unitType: unitType ? String(unitType).trim() : null,
      baseUnit: baseUnit ? String(baseUnit).trim() : null,
    };

    if (productId && !isNaN(Number(productId))) {
      const existing = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.id, Number(productId)));

      if (existing.length > 0) {
        await db.update(productsTable).set(values).where(eq(productsTable.id, Number(productId)));
        result.updated++;
      } else {
        await db.insert(productsTable).values(values);
        result.inserted++;
      }
    } else {
      const existing = await db
        .select({ id: productsTable.id })
        .from(productsTable)
        .where(eq(productsTable.name, values.name));

      if (existing.length > 0) {
        await db.update(productsTable).set(values).where(eq(productsTable.name, values.name));
        result.updated++;
      } else {
        await db.insert(productsTable).values(values);
        result.inserted++;
      }
    }
  }

  return result;
}

async function importStores(
  rows: Record<string, unknown>[],
  errors: ImportError[]
): Promise<SheetResult> {
  const result: SheetResult = { inserted: 0, updated: 0, skipped: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const name = row["StoreName"] ?? row["Name"] ?? row["name"];
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({ sheet: "Stores", row: rowNum, message: "Missing StoreName" });
      result.skipped++;
      continue;
    }

    const storeId = row["StoreID"] ?? row["Id"] ?? row["id"];
    const values = { name: String(name).trim() };

    if (storeId && !isNaN(Number(storeId))) {
      const existing = await db
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(eq(storesTable.id, Number(storeId)));

      if (existing.length > 0) {
        await db.update(storesTable).set(values).where(eq(storesTable.id, Number(storeId)));
        result.updated++;
      } else {
        await db.insert(storesTable).values(values);
        result.inserted++;
      }
    } else {
      const existing = await db
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(eq(storesTable.name, values.name));

      if (existing.length > 0) {
        result.skipped++;
      } else {
        await db.insert(storesTable).values(values);
        result.inserted++;
      }
    }
  }

  return result;
}

async function importPrices(
  rows: Record<string, unknown>[],
  errors: ImportError[]
): Promise<SheetResult> {
  const result: SheetResult = { inserted: 0, updated: 0, skipped: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const productId = row["ProductID"] ?? row["product_id"];
    const storeId = row["StoreID"] ?? row["store_id"];
    const price = row["Price"] ?? row["price"];

    if (!productId || isNaN(Number(productId))) {
      errors.push({ sheet: "Prices", row: rowNum, message: "Missing or invalid ProductID" });
      result.skipped++;
      continue;
    }
    if (!storeId || isNaN(Number(storeId))) {
      errors.push({ sheet: "Prices", row: rowNum, message: "Missing or invalid StoreID" });
      result.skipped++;
      continue;
    }
    if (price === null || price === undefined || isNaN(Number(price))) {
      errors.push({ sheet: "Prices", row: rowNum, message: "Missing or invalid Price" });
      result.skipped++;
      continue;
    }

    const unitPriceRaw = row["UnitPrice"] ?? row["unit_price"] ?? null;
    const unitPrice =
      unitPriceRaw !== null && unitPriceRaw !== "" && !isNaN(Number(unitPriceRaw))
        ? String(Number(unitPriceRaw))
        : null;

    const values = {
      productId: Number(productId),
      storeId: Number(storeId),
      price: String(Number(price)),
      unitPrice,
      lastUpdated: new Date(),
    };

    const [existingPrice] = await db
      .select()
      .from(pricesTable)
      .where(eq(pricesTable.productId, values.productId));

    await db
      .insert(pricesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [pricesTable.productId, pricesTable.storeId],
        set: {
          price: values.price,
          unitPrice: values.unitPrice,
          lastUpdated: values.lastUpdated,
        },
      });

    if (existingPrice) {
      result.updated++;
    } else {
      result.inserted++;
    }
  }

  return result;
}

router.post(
  "/admin/import",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (
      !req.file.originalname.endsWith(".xlsx") &&
      req.file.mimetype !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      res.status(400).json({ error: "File must be an .xlsx spreadsheet" });
      return;
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      res.status(400).json({ error: "Could not parse XLSX file" });
      return;
    }

    const errors: ImportError[] = [];

    const productsRows = getSheet(workbook, "Products");
    const storesRows = getSheet(workbook, "Stores");
    const pricesRows = getSheet(workbook, "Prices");

    const productsResult = productsRows
      ? await importProducts(productsRows, errors)
      : { inserted: 0, updated: 0, skipped: 0 };

    const storesResult = storesRows
      ? await importStores(storesRows, errors)
      : { inserted: 0, updated: 0, skipped: 0 };

    const pricesResult = pricesRows
      ? await importPrices(pricesRows, errors)
      : { inserted: 0, updated: 0, skipped: 0 };

    res.json(
      ImportSpreadsheetResponse.parse({
        products: productsResult,
        stores: storesResult,
        prices: pricesResult,
        errors,
      })
    );
  }
);

export default router;
