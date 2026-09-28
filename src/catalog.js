import { fetchAllProducts } from "./storageManager.js";

let state = {
  products: [],
  total: 0,
  pages: 0,
  syncedAt: null,
  syncing: false,
  error: null,
};

export function getCatalogState() {
  return state;
}

export async function syncCatalog() {
  if (state.syncing) return state;

  state.syncing = true;
  state.error = null;

  try {
    const result = await fetchAllProducts({
      onProgress: (page, pages, loaded, total) => {
        console.log(`[catalog] page ${page}/${pages} — ${loaded}/${total}`);
      },
    });

    state = {
      ...result,
      syncing: false,
      error: null,
    };

    console.log(`[catalog] sync complete: ${state.products.length} products`);
    return state;
  } catch (error) {
    state.syncing = false;
    state.error = error instanceof Error ? error.message : String(error);
    console.error("[catalog] sync failed:", state.error);
    throw error;
  }
}

export function findByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  return state.products.find(
    (product) => String(product.product_code || "").trim().toUpperCase() === normalized
  ) || null;
}

export function searchProducts({ q, category, letter, stockStatus, max = 20 } = {}) {
  const query = String(q || "").trim().toLowerCase();
  const cat = String(category || "").trim().toLowerCase();
  const codeLetter = String(letter || "").trim().toUpperCase();
  const status = String(stockStatus || "").trim().toLowerCase();

  return state.products
    .filter((product) => {
      const matchesQuery = !query || [
        product.product_code,
        product.description,
        product.category?.name,
        ...((product.variants || []).map(v => v.color)),
      ].some(value => String(value || "").toLowerCase().includes(query));

      const matchesCategory =
        !cat || String(product.category?.name || "").toLowerCase() === cat;

      const matchesLetter =
        !codeLetter || String(product.code_letter || "").toUpperCase() === codeLetter;

      const matchesStatus =
        !status || String(product.stock_status || "").toLowerCase() === status;

      return matchesQuery && matchesCategory && matchesLetter && matchesStatus;
    })
    .slice(0, Math.max(1, Math.min(Number(max) || 20, 100)));
}

export function checkAvailability(product, { size, color } = {}) {
  if (!product) {
    return {
      productExists: false,
      available: false,
      reason: "product_not_found",
      matches: [],
    };
  }

  const requestedSize = size == null ? null : String(size).trim();
  const requestedColor = color == null ? null : String(color).trim().toLowerCase();

  const matches = (product.variants || []).filter((variant) => {
    const sizeOk = requestedSize == null || String(variant.size ?? "").trim() === requestedSize;
    const colorOk = requestedColor == null ||
      String(variant.color ?? "").trim().toLowerCase() === requestedColor;
    return sizeOk && colorOk;
  });

  const availableMatches = matches.filter(v => Number(v.stock_quantity || 0) > 0);

  return {
    productExists: true,
    available: availableMatches.length > 0,
    product_code: product.product_code,
    selling_price: product.selling_price,
    stock_status: product.stock_status,
    total_stock: product.total_stock,
    requested: { size: requestedSize, color },
    matches: matches.map(v => ({
      id: v.id,
      color: v.color,
      size: v.size,
      stock_quantity: v.stock_quantity,
      available: Number(v.stock_quantity || 0) > 0,
    })),
  };
}
