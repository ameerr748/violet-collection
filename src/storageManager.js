const DEFAULT_BASE_URL = "https://storagemanageriq.site";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function getConfig() {
  return {
    baseUrl: (process.env.STORAGE_MANAGER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    token: requireEnv("STORAGE_MANAGER_TOKEN"),
    perPage: Number(process.env.STORAGE_MANAGER_PER_PAGE || 18),
  };
}

async function storageRequest(path) {
  const { baseUrl, token } = getConfig();
  const url = new URL(path, baseUrl);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "Violet-AI-Backend/0.1",
    },
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    const detail = typeof body === "object" && body !== null
      ? JSON.stringify(body)
      : String(body);
    throw new Error(`Storage Manager API ${response.status}: ${detail}`);
  }

  return body;
}

export async function fetchProductsPage(page = 1, perPage = getConfig().perPage) {
  return storageRequest(`/api/products?page=${page}&per_page=${perPage}`);
}

export async function fetchAllProducts({ onProgress } = {}) {
  const first = await fetchProductsPage(1);
  const total = Number(first.total || first.data?.length || 0);
  const lastPage = Number(first.last_page || 1);

  const products = [...(Array.isArray(first.data) ? first.data : [])];
  onProgress?.(1, lastPage, products.length, total);

  for (let page = 2; page <= lastPage; page += 1) {
    const result = await fetchProductsPage(page);
    if (Array.isArray(result.data)) products.push(...result.data);
    onProgress?.(page, lastPage, products.length, total);
  }

  return {
    products,
    total,
    pages: lastPage,
    syncedAt: new Date().toISOString(),
  };
}
