import express from "express";
import { syncCatalog, getCatalogState, findByCode, searchProducts, checkAvailability } from "./catalog.js";
import { analyzeProductImage, createSalesReply } from "./gemini.js";
import { buildImageIndex, getImageIndexState, loadImageIndex, matchImageBase64 } from "./imageIndex.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  const state = getCatalogState();
  res.json({
    ok: true,
    service: "violet-ai-backend",
    catalog: {
      loaded: state.products.length,
      total: state.total,
      pages: state.pages,
      syncedAt: state.syncedAt,
      syncing: state.syncing,
      error: state.error,
    },
  });
});

app.get("/api/catalog/status", (_req, res) => {
  const state = getCatalogState();
  res.json({
    total: state.total,
    loaded: state.products.length,
    pages: state.pages,
    syncedAt: state.syncedAt,
    syncing: state.syncing,
    error: state.error,
  });
});

app.post("/api/catalog/sync", async (_req, res) => {
  try {
    const result = await syncCatalog();
    res.json({
      ok: true,
      total: result.total,
      loaded: result.products.length,
      pages: result.pages,
      syncedAt: result.syncedAt,
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/products/:code", (req, res) => {
  const product = findByCode(req.params.code);

  if (!product) {
    return res.status(404).json({
      ok: false,
      error: "product_not_found",
    });
  }

  return res.json({ ok: true, product });
});

app.get("/api/products/:code/availability", (req, res) => {
  const product = findByCode(req.params.code);
  const result = checkAvailability(product, {
    size: req.query.size,
    color: req.query.color,
  });

  if (!result.productExists) {
    return res.status(404).json({ ok: false, ...result });
  }

  return res.json({ ok: true, ...result });
});

app.post("/api/ai/analyze-image", async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body || {};
    const analysis = await analyzeProductImage({ base64Image, mimeType });
    return res.json({ ok: true, analysis });
  } catch (error) {
    console.error("[ai/analyze-image] failed:", error);
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cause: error?.cause?.message || null,
    });
  }
});

app.post("/api/ai/test", async (_req, res) => {
  try {
    const { createTextTest } = await import("./gemini.js");
    const reply = await createTextTest();
    return res.json({ ok: true, reply });
  } catch (error) {
    console.error("[ai/test] failed:", error);
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      cause: error?.cause?.message || null,
    });
  }
});

app.post("/api/ai/sales-reply", async (req, res) => {
  try {
    const { customerMessage, productCode } = req.body || {};
    const product = findByCode(productCode);

    if (!product) {
      return res.status(404).json({ ok: false, error: "product_not_found" });
    }

    const reply = await createSalesReply({ customerMessage, product });
    return res.json({ ok: true, reply });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/ai/image-index/status", (_req, res) => {
  res.json({ ok: true, ...getImageIndexState() });
});

app.post("/api/ai/image-index/build", async (req, res) => {
  try {
    const state = getCatalogState();
    const limit = Number(req.body?.limit || 18);
    if (!state.products.length) {
      return res.status(409).json({ ok: false, error: "catalog_not_loaded" });
    }

    const result = await buildImageIndex(state.products, {
      limit,
      onProgress: (done, total, indexed) => console.log(`[image-index] ${done}/${total} — indexed ${indexed}`),
    });

    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/ai/match-image", async (req, res) => {
  try {
    const { base64Image, mimeType, topK } = req.body || {};
    const matches = await matchImageBase64({ base64Image, mimeType, topK });
    return res.json({ ok: true, matches });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/products/out-of-stock", (req, res) => {
  const state = getCatalogState();
  const products = state.products
    .filter(product => Number(product.total_stock || 0) <= 0)
    .map(product => ({
      id: product.id,
      product_code: product.product_code,
      code_letter: product.code_letter,
      category: product.category?.name || "",
      description: product.description || "",
      selling_price: product.selling_price,
      total_stock: Number(product.total_stock || 0),
      stock_status: product.stock_status || "",
      colors: [...new Set((product.variants || []).map(v => v.color).filter(Boolean))].join("، "),
      sizes: [...new Set((product.variants || []).map(v => v.size).filter(Boolean))].join("، "),
      image_url: product.image_url ? new URL(product.image_url, "https://storagemanageriq.site").toString() : "",
      updated_at: product.updated_at || "",
    }));

  res.json({
    ok: true,
    count: products.length,
    products,
  });
});

app.get("/api/products/search", (req, res) => {
  const products = searchProducts({
    q: req.query.q,
    category: req.query.category,
    letter: req.query.letter,
    stockStatus: req.query.stockStatus,
    max: req.query.max,
  });

  res.json({
    ok: true,
    count: products.length,
    products,
  });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, async () => {
  console.log(`[violet] backend listening on http://localhost:${port}`);

  if (String(process.env.SYNC_ON_START || "true").toLowerCase() === "true") {
    try {
      await syncCatalog();
      const state = getCatalogState();
      await loadImageIndex(state.products, { limit: Number(process.env.IMAGE_INDEX_SCOPE || state.products.length) });
      console.log("[image-index] persistent index loaded.");
    } catch (error) {
      console.error("[violet] initial catalog sync failed.");
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
});
