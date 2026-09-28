import express from "express";
import { syncCatalog, getCatalogState, findByCode, searchProducts, checkAvailability } from "./catalog.js";

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
    } catch (error) {
      console.error("[violet] initial catalog sync failed.");
      console.error(error instanceof Error ? error.message : String(error));
    }
  }
});
