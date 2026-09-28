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
