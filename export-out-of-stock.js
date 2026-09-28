import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const API_URL = "http://localhost:3000/api/products/out-of-stock";
const output = "Violet_المنتجات_النافدة.xlsx";

const response = await fetch(API_URL);
if (!response.ok) {
  throw new Error("Local backend returned " + response.status);
}

const payload = await response.json();
const products = payload.products || [];

const workbook = new ExcelJS.Workbook();
workbook.creator = "Violet AI";
workbook.created = new Date();

const sheet = workbook.addWorksheet("المنتجات النافدة", {
  views: [{ rightToLeft: true }],
});

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

for (const product of products) {
  sheet.addRow(product);
}

sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
sheet.getRow(1).fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF6D28D9" },
};
sheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

for (let row = 2; row <= sheet.rowCount; row++) {
  sheet.getRow(row).alignment = { vertical: "top", wrapText: true };
  sheet.getCell(row, 3).numFmt = '#,##0" د.ع"';
  sheet.getCell(row, 4).numFmt = "0";
}

sheet.autoFilter = {
  from: "A1",
  to: "J" + sheet.rowCount,
};

sheet.views = [{ state: "frozen", ySplit: 1, rightToLeft: true }];

const summary = workbook.addWorksheet("ملخص");
summary.views = [{ rightToLeft: true }];
summary.getRange;
summary.getCell("A1").value = "تقرير المنتجات النافدة";
summary.getCell("A2").value = "عدد المنتجات النافدة";
summary.getCell("B2").value = products.length;
summary.getCell("A3").value = "وقت استخراج التقرير";
summary.getCell("B3").value = new Date();

summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
summary.getCell("A1").fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF6D28D9" },
};
summary.mergeCells("A1:B1");
summary.getColumn(1).width = 30;
summary.getColumn(2).width = 28;
summary.getCell("B3").numFmt = "yyyy-mm-dd hh:mm";

await workbook.xlsx.writeFile(output);
console.log("تم إنشاء:", output);
console.log("عدد المنتجات النافدة:", products.length);
