import { embedImageUrl, embedImageBase64, cosineSimilarity } from "./gemini.js";

const IMAGE_BASE_URL = "https://storagemanageriq.site";

let imageIndex = [];
let indexState = {
  built: false,
  building: false,
  count: 0,
  builtAt: null,
  error: null,
};

function normalizeImageUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl, IMAGE_BASE_URL).toString();
}

export function getImageIndexState() {
  return indexState;
}

export async function buildImageIndex(products, { limit = 18, onProgress } = {}) {
  if (indexState.building) return indexState;

  indexState = { ...indexState, building: true, error: null };

  try {
    const selected = products.slice(0, Math.max(1, Math.min(Number(limit) || 18, products.length)));
    const next = [];

    for (let i = 0; i < selected.length; i += 1) {
      const product = selected[i];
      const imageUrl = normalizeImageUrl(product.image_url);
      if (!imageUrl) continue;

      try {
        const embedding = await embedImageUrl(imageUrl);
        next.push({
          product_code: product.product_code,
          image_url: imageUrl,
          category: product.category?.name || null,
          selling_price: product.selling_price,
          total_stock: product.total_stock,
          stock_status: product.stock_status,
          embedding,
        });
      } catch (error) {
        console.error(`[image-index] failed ${product.product_code}:`, error.message || error);
      }

      onProgress?.(i + 1, selected.length, next.length);
    }

    imageIndex = next;
    indexState = {
      built: true,
      building: false,
      count: next.length,
      builtAt: new Date().toISOString(),
      error: null,
    };
    return indexState;
  } catch (error) {
    indexState = {
      ...indexState,
      building: false,
      error: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
}

export async function matchImageBase64({ base64Image, mimeType = "image/jpeg", topK = 5 }) {
  if (!imageIndex.length) {
    throw new Error("Image index is empty. Build the image index first.");
  }

  const query = await embedImageBase64({ base64Image, mimeType });
  const k = Math.max(1, Math.min(Number(topK) || 5, imageIndex.length));

  return imageIndex
    .map(item => ({
      product_code: item.product_code,
      image_url: item.image_url,
      category: item.category,
      selling_price: item.selling_price,
      total_stock: item.total_stock,
      stock_status: item.stock_status,
      similarity: cosineSimilarity(query, item.embedding),
    }))
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, k);
}
