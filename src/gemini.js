import { GoogleGenAI } from "@google/genai";

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return new GoogleGenAI({ apiKey });
}

export async function analyzeProductImage({ base64Image, mimeType = "image/jpeg" }) {
  if (!base64Image || !String(base64Image).trim()) {
    throw new Error("base64Image is required");
  }

  const ai = getGemini();

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_VISION_MODEL || "gemini-3.8-flash",
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: String(base64Image).replace(/^data:[^;]+;base64,/, ""),
            },
          },
          {
            text: [
              "أنت محلل صور لمنتجات متجر فيوليت النسائي.",
              "حلل الصورة فقط ولا تخترع السعر أو المخزون.",
              "أجب بصيغة JSON صحيحة في سطر واحد.",
              'المفاتيح: category, dominantColor, style, visibleText, possibleProductCode, sizeText, brandText, confidence, notes.',
              "إذا لم تعرف قيمة اجعلها null، وconfidence رقم بين 0 و1."
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned no text.");

  const cleaned = text.replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { raw: text };
  }
}

export async function createTextTest() {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
    contents: "أجب بكلمة واحدة فقط: نجح",
  });
  return response.text?.trim() || "";
}

export async function createSalesReply({ customerMessage, product }) {
  const ai = getGemini();

  const productJson = JSON.stringify({
    product_code: product?.product_code,
    category: product?.category?.name,
    description: product?.description || null,
    selling_price: product?.selling_price,
    total_stock: product?.total_stock,
    stock_status: product?.stock_status,
    variants: product?.variants || [],
  });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
    contents: [
      {
        parts: [
          {
            text: [
              "أنت موظف مبيعات في متجر فيوليت.",
              "اكتب ردًا قصيرًا وجذابًا باللهجة العراقية النسائية، مناسبًا لفيسبوك ومسنجر.",
              "ممنوع اختراع السعر أو القياس أو المخزون أو وجود خصم.",
              "استخدم فقط بيانات المنتج المرفقة.",
              "إذا كان القياس المطلوب غير متوفر، قل ذلك واقترح أن نبحث عن بديل مشابه.",
              "لا تذكر أنك ذكاء اصطناعي.",
              "",
              "رسالة الزبونة:",
              customerMessage || "",
              "",
              "بيانات المنتج من Storage Manager:",
              productJson
            ].join("\n"),
          },
        ],
      },
    ],
  });

  return response.text?.trim() || "";
}


export async function embedImageBase64({ base64Image, mimeType = "image/jpeg" }) {
  if (!base64Image || !String(base64Image).trim()) {
    throw new Error("base64Image is required");
  }

  const ai = getGemini();

  const response = await ai.models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    contents: [
      {
        parts: [{
          inlineData: {
            mimeType,
            data: String(base64Image).replace(/^data:[^;]+;base64,/, ""),
          },
        }],
      },
    ],
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Gemini returned no image embedding.");
  }

  return embedding;
}

export async function embedImageUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return embedImageBase64({
    base64Image: Buffer.from(arrayBuffer).toString("base64"),
    mimeType: (response.headers.get("content-type") || "image/jpeg").split(";")[0],
  });
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error("Embedding dimensions do not match.");
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function embedImageUrlsBatch(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return [];

  const ai = getGemini();
  const contents = [];
  const mimeTypes = [];

  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image download failed: " + response.status + " for " + url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const mimeType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
    mimeTypes.push(mimeType);
    contents.push({
      parts: [{
        inlineData: {
          mimeType,
          data: bytes.toString("base64"),
        },
      }],
    });
  }

  const response = await ai.models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    contents,
  });

  const embeddings = response.embeddings || [];
  if (embeddings.length !== urls.length) {
    throw new Error("Gemini returned " + embeddings.length + " embeddings for " + urls.length + " images.");
  }

  return embeddings.map((embedding, i) => ({
    values: embedding.values,
    mimeType: mimeTypes[i],
  }));
}
