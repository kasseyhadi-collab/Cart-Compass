import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db, productsTable, storesTable, pricesTable } from "@workspace/db";
import { ImportSpreadsheetResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

type SheetResult = { inserted: number; updated: number; skipped: number };
type ImportError = { sheet: string; row: number; message: string };

function getSheet(workbook: XLSX.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return null;
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}

async function importProducts(
  rows: Record<string, unknown>[],
  errors: ImportError[]
): Promise<SheetResult> {
  const result: SheetResult = { inserted: 0, updated: 0, skipped: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

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

    // If numeric ProductID provided, upsert by id; otherwise upsert by name
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
      unitPriceRaw !== null && !isNaN(Number(unitPriceRaw)) ? String(Number(unitPriceRaw)) : null;

    const values = {
      productId: Number(productId),
      storeId: Number(storeId),
      price: String(Number(price)),
      unitPrice,
      lastUpdated: new Date(),
    };

    // Check existence with both keys
    const [existingPrice] = await db
      .select()
      .from(pricesTable)
      .where(eq(pricesTable.productId, values.productId));

    // Use a proper upsert (insert or update on conflict)
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
      req.file.mimetype !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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

    const productsResult: SheetResult = productsRows
      ? await importProducts(productsRows, errors)
      : { inserted: 0, updated: 0, skipped: 0 };

    const storesResult: SheetResult = storesRows
      ? await importStores(storesRows, errors)
      : { inserted: 0, updated: 0, skipped: 0 };

    const pricesResult: SheetResult = pricesRows
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
