# Violet AI Backend

هذا هو الباكند الأساسي لنظام **Violet AI Sales Agent**.

## ما تم بناؤه

### 1. Storage Manager
يرتبط بالـAPI الحقيقي:

`GET https://storagemanageriq.site/api/products?page=1&per_page=18`

ويقرأ البيانات الحالية من Storage Manager، بما فيها:
- كود المنتج
- الصورة
- السعر
- المخزون
- حالة المخزون
- اللون
- القياسات والـvariants

يدعم مزامنة كل صفحات المنتجات، ثم البحث داخل الكتالوج.

### 2. فحص القياس والمخزون
مثال:

`GET /api/products/520Q/availability?size=39`

يقرأ قياس 39 من الـvariant نفسه بدل الاعتماد على إجمالي مخزون المنتج.

### 3. Gemini
يوجد أساس لتحليل صورة الزبونة وإخراج بيانات منظمة، ثم كتابة رد مبيعات مبني فقط على بيانات Storage Manager.

### 4. API داخلي جاهز للخطوات القادمة
- `GET /health`
- `GET /api/catalog/status`
- `POST /api/catalog/sync`
- `GET /api/products/:code`
- `GET /api/products/:code/availability?size=39`
- `GET /api/products/search?q=...`
- `POST /api/ai/analyze-image`
- `POST /api/ai/sales-reply`

## التشغيل على Windows

المطلوب Node.js 20 أو أحدث.

من مجلد المشروع:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-local.ps1
```

البرنامج سيطلب منك:
1. Bearer Token جديد لـ Storage Manager.
2. Gemini API Key بشكل اختياري في هذه المرحلة.

لا تحفظ هذه القيم داخل الملفات ولا تضعها في GitHub.

## أمان مهم جدًا

الـToken الذي ظهر سابقًا في المحادثة يجب إلغاؤه/استبداله قبل أي تشغيل دائم.

لا نضع التوكن داخل:
- JavaScript في المتصفح
- GitHub Pages
- README
- Git commits
- رسائل Messenger

## المرحلة التالية

بعد نجاح التشغيل المحلي سنضيف:
1. مطابقة صورة الزبونة مع منتجات Violet.
2. البحث عن بديل مشابه عند نفاد المنتج.
3. نظام خصومات مستقل لا يسمح للـAI باختراع سعر.
4. تنسيق حذاء + جنطة + ملابس حسب المخزون.
5. سجل محادثات وحجوزات.
6. Webhook لـFacebook/Messenger.
7. توليد Reels تلقائيًا.

## اختبار أول صورة مع Gemini

بعد تشغيل السيرفر، افتح PowerShell جديدة داخل المشروع وشغّل:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-gemini-image.ps1
```

الاختبار يستخدم صورة `520Q` من Storage Manager، ويرسلها إلى Gemini لتحليل:
- القسم
- اللون
- النص الظاهر
- كود المنتج إن كان ظاهرًا
- القياس الظاهر
- درجة الثقة

ولا يعتمد على Gemini لتحديد السعر أو المخزون؛ هذه المعلومات تبقى من Storage Manager.
