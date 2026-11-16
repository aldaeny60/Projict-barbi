# PROJECT_STATUS — اللوحة الحية
| الوحدة | الحالة | الدليل |
|---|---|---|
| المتجر PWA | VERIFIED | build ✓ + sw.js + دعوة تثبيت (QA 23) |
| تتبع الطلب `/track` | VERIFIED | QA 21 — برقم الهاتف بدون تسجيل دخول |
| عمل بدون اتصال | VERIFIED | sw + `/offline` (QA 22,23) |
| الكاشير POS | VERIFIED | QA 17/18 |
| لوحة التحكم | VERIFIED | QA 15/16 + حظر 13/14 |
| API التجاري | VERIFIED | QA 4-12 |
| الأمن | VERIFIED | QA 1,2,13,14,15,20 |
| قاعدة البيانات | VERIFIED | معاملات + 409 |
| رصد السوق | VERIFIED | devCode Serper |
| الدفع الحي المباشر | BLOCKED | يتطلب اعتمادات إنتاج (لا تزوير — LAW 011/012) |
| SMS/FCM الحي | BLOCKED | مزود خارجي (مهيأ بالكود) |
| إنكليزي LTR | NOT STARTED | قرار تسويقي موثق |
| RBAC للكاشير + audit log | NOT STARTED | موثق في SECURITY_REPORT قبل الإنتاج |
الاختبارات: 24/24 PASS (scripts/api-tests.mjs). البناء: ناجح. النوع: 0 أخطاء.
