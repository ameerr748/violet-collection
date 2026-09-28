import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { embedImageUrlsBatch, embedImageBase64, cosineSimilarity } from "./gemini.js";

const IMAGE_BASE_URL = "https://storagemanageriq.site";
const DATA_DIR = path.resolve(process.cwd(), "data");
const META_FILE = path.join(DATA_DIR, "violet-image-index.meta.json");
const EMBED_FILE = path.join(DATA_DIR, "violet-image-index.bin");
const BATCH_SIZE = Number(process.env.IMAGE_INDEX_BATCH_SIZE || 6);

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

function productKey(product) {
  return String(product.product_code || "") + "|" + normalizeImageUrl(product.image_url);
}

function signatureForProducts(products) {
  const input = products.map(productKey).join("\n");
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readMeta() {
  try {
    return JSON.parse(await fs.readFile(META_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function writeMeta(meta) {
  await fs.writeFile(META_FILE, JSON.stringify(meta), "utf8");
}

async function resetPersistentIndex(signature, scope) {
  await ensureDataDir();
  await fs.writeFile(EMBED_FILE, Buffer.alloc(0));
  const meta = {
    version: 1,
    dimension: null,
    signature,
    scope,
    records: [],
    builtAt: null,
  };
  await writeMeta(meta);
  return meta;
}

async function loadPersistentIndex(products, limit) {
  const scope = Math.min(Number(limit) || products.length, products.length);
  const selected = products.slice(0, scope);
  const signature = signatureForProducts(selected);
  const meta = await readMeta();

  if (!meta || meta.version !== 1 || meta.signature !== signature || meta.scope !== scope) {
    return null;
  }

  const file = await fs.readFile(EMBED_FILE).catch(() => Buffer.alloc(0));
  if (!meta.dimension || !meta.records.length || file.length === 0) {
    return null;
  }

  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const all = new Float32Array(bytes);
  const expected = meta.records.length * meta.dimension;
  if (all.length < expected) return null;

  const productMap = new Map(selected.map(product => [productKey(product), product]));
  const next = [];

  for (let i = 0; i < meta.records.length; i += 1) {
    const record = meta.records[i];
    const product = productMap.get(record.key);
    if (!product) continue;

    const start = i * meta.dimension;
    const embedding = all.slice(start, start + meta.dimension);
    next.push({
      product_code: product.product_code,
      image_url: record.image_url,
      category: product.category?.name || null,
      selling_price: product.selling_price,
      total_stock: product.total_stock,
      stock_status: product.stock_status,
      embedding,
    });
  }

  if (next.length !== meta.records.length) return null;

  imageIndex = next;
  indexState = {
    built: true,
    building: false,
    count: next.length,
    builtAt: meta.builtAt || null,
    error: null,
  };
  return indexState;
}

export async function loadImageIndex(products, { limit = products.length } = {}) {
  const result = await loadPersistentIndex(products, limit);
  return result || getImageIndexState();
}

export function getImageIndexState() {
  return indexState;
}

export async function buildImageIndex(products, { limit = products.length, onProgress } = {}) {
  if (indexState.building) return indexState;

  const scope = Math.min(Number(limit) || products.length, products.length);
  const selected = products.slice(0, scope);
  const signature = signatureForProducts(selected);

  const loaded = await loadPersistentIndex(products, { limit: scope });
  if (loaded && loaded.count === selected.length) return loaded;

  indexState = { ...indexState, building: true, error: null };

  try {
    let meta = await readMeta();
    if (!meta || meta.signature !== signature || meta.scope !== scope) {
      meta = await resetPersistentIndex(signature, scope);
      imageIndex = [];
    }

    const existing = new Set((meta.records || []).map(record => record.key));
    const pending = selected.filter(product => {
      const url = normalizeImageUrl(product.image_url);
      return url && !existing.has(productKey(product));
    });

    for (let start = 0; start < pending.length; start += BATCH_SIZE) {
      const batchProducts = pending.slice(start, start + BATCH_SIZE);
      const urls = batchProducts.map(product => normalizeImageUrl(product.image_url));

      let embeddings;
      try {
        embeddings = await embedImageUrlsBatch(urls);
      } catch (batchError) {
        console.error("[image-index] batch failed; retrying individually:", batchError.message || batchError);
        embeddings = [];
        for (const url of urls) {
          try {
            const single = await embedImageUrlsBatch([url]);
            embeddings.push(single[0]);
          } catch (singleError) {
            console.error("[image-index] image failed:", singleError.message || singleError);
            embeddings.push(null);
          }
        }
      }

      const good = batchProducts
        .map((product, i) => ({ product, embedding: embeddings[i] }))
        .filter(item => item.embedding && Array.isArray(item.embedding.values));

      if (good.length) {
        if (!meta.dimension) meta.dimension = good[0].embedding.values.length;

        const buffers = [];
        for (const item of good) {
          const values = Float32Array.from(item.embedding.values);
          if (values.length !== meta.dimension) continue;

          buffers.push(Buffer.from(values.buffer));
          const record = {
            key: productKey(item.product),
            product_code: item.product.product_code,
            image_url: normalizeImageUrl(item.product.image_url),
          };
          meta.records.push(record);
          existing.add(record.key);

          imageIndex.push({
            product_code: item.product.product_code,
            image_url: record.image_url,
            category: item.product.category?.name || null,
            selling_price: item.product.selling_price,
            total_stock: item.product.total_stock,
            stock_status: item.product.stock_status,
            embedding: values,
          });
        }

        if (buffers.length) {
          await fs.appendFile(EMBED_FILE, Buffer.concat(buffers));
        }
      }

      meta.builtAt = new Date().toISOString();
      await writeMeta(meta);

      const done = start + batchProducts.length;
      onProgress?.(done, pending.length, meta.records.length);
    }

    const refreshed = await loadPersistentIndex(products, { limit: scope });
    if (refreshed) return refreshed;

    indexState = {
      built: meta.records.length === selected.length,
      building: false,
      count: meta.records.length,
      builtAt: meta.builtAt,
      error: meta.records.length === selected.length ? null : "Some images could not be indexed.",
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
