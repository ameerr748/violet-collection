import ExcelJS from "exceljs";

const token = process.env.STORAGE_MANAGER_TOKEN;
if (!token) throw new Error("Missing STORAGE_MANAGER_TOKEN.");

const base = process.env.STORAGE_MANAGER_BASE_URL || "https://storagemanageriq.site";
const perPage = 18;
let first;

async function getPage(page) {
  const url = new URL("/api/products", base);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: "Bearer " + token,
    },
  });

  const text = await response.text();
  if (!response.ok) throw new Error("Storage Manager API " + response.status + ": " + text);

  return JSON.parse(text);
}

first = await getPage(1);
const lastPage = Number(first.last_page || 1);
const all = [...(first.data || [])];

for (let page = 2; page <= lastPage; page++) {
  const result = await getPage(page);
  all.push(...(result.data || []));
  process.stdout.write("\rتحميل المنتجات: " + all.length + "/" + (first.total || all.length));
}

const out = all
  .filter(p => Number(p.total_stock || 0) <= 0)
  .map(p => ({
    product_code: p.product_code,
    category: p.category?.name || "",
    selling_price: Number(p.selling_price || 0),
    total_stock: Number(p.total_stock || 0),
    stock_status: p.stock_status || "",
    colors: [...new Set((p.variants || []).map(v => v.color).filter(Boolean))].join("، "),
    sizes: [...new Set((p.variants || []).map(v => v.size).filter(Boolean))].join("، "),
    code_letter: p.code_letter || "",
    updated_at: p.updated_at || "",
    image_url: p.image_url ? new URL(p.image_url, base).toString() : "",
  }));

const workbook = new ExcelJS.Workbook();
workbook.creator = "Violet AI";
workbook.created = new Date();

const sheet = workbook.addWorksheet("المنتجات النافدة");
sheet.views = [{ rightToLeft: true }];
sheet.columns = [
  { header: "كود المنتج", key: "product_code", width: 16 },
  { header: "القسم", key: "category", width: 20 },
  { header: "السعر", key: "selling_price", width: 15 },
  { header: "المخزون", key: "total_stock", width: 12 },
  { header: "الحالة", key: "stock_status", width: 18 },
  { header: "اللون", key: "colors", width: 24 },
  { header: "القياسات", key: "sizes", width: 26 },
  { header: "الكود الحرفي", key: "code_letter", width: 14 },
  { header: "آخر تحديث", key: "updated_at", width: 24 },
  { header: "رابط الصورة", key: "image_url", width: 55 },
];

for (const row of out) sheet.addRow(row);

sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
sheet.getColumn(3).numFmt = '#,##0" د.ع"';
sheet.autoFilter = { from: "A1", to: "J" + Math.max(1, sheet.rowCount) };
sheet.views = [{ rightToLeft: true, state: "frozen", ySplit: 1 }];

const summary = workbook.addWorksheet("ملخص");
summary.views = [{ rightToLeft: true }];
summary.mergeCells("A1:B1");
summary.getCell("A1").value = "تقرير المنتجات النافدة";
summary.getCell("A2").value = "عدد المنتجات النافدة";
summary.getCell("B2").value = out.length;
summary.getCell("A3").value = "إجمالي المنتجات المفحوصة";
summary.getCell("B3").value = all.length;
summary.getCell("A4").value = "تاريخ التقرير";
summary.getCell("B4").value = new Date();
summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D28D9" } };
summary.getColumn(1).width = 30;
summary.getColumn(2).width = 25;
summary.getCell("B4").numFmt = "yyyy-mm-dd hh:mm";

const file = "Violet_المنتجات_النافدة.xlsx";
await workbook.xlsx.writeFile(file);
console.log("\nتم إنشاء ملف Excel:", file);
console.log("المنتجات النافدة:", out.length);
