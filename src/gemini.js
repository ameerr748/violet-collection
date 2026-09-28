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
              "حلل صورة المنتج فقط ولا تخترع معلومات غير ظاهرة.",
              "أخرج JSON منظم يحتوي على:",
              "category: shoes أو clothes أو bags أو wallets أو other",
              "dominantColor: اللون الغالب بالعربية إن أمكن",
              "style: وصف قصير للستايل والشكل",
              "visibleText: أي كود أو نص ظاهر على الصورة",
              "possibleProductCode: كود المنتج إذا كان ظاهرًا أو null",
              "sizeText: أي قياس ظاهر أو null",
              "brandText: العلامة إن كانت ظاهرة أو null",
              "confidence: رقم من 0 إلى 1",
              "notes: ملاحظات بصرية قصيرة.",
              "لا تحدد السعر أو المخزون؛ هذه المعلومات يجب أن تأتي من Storage Manager."
            ].join("\n"),
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          category: { type: "string" },
          dominantColor: { type: "string" },
          style: { type: "string" },
          visibleText: { type: "string" },
          possibleProductCode: { type: ["string", "null"] },
          sizeText: { type: ["string", "null"] },
          brandText: { type: ["string", "null"] },
          confidence: { type: "number" },
          notes: { type: "string" }
        },
        required: [
          "category",
          "dominantColor",
          "style",
          "visibleText",
          "possibleProductCode",
          "sizeText",
          "brandText",
          "confidence",
          "notes"
        ]
      }
    }
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned no text.");

  return JSON.parse(text);
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
