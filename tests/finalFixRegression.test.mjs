import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("camera barcode scanner has camera, manual fallback and stream cleanup",async()=>{
  const src=await read("../src/components/BarcodeScannerModal.jsx");
  assert.match(src,/getUserMedia/);assert.match(src,/BarcodeDetector/);assert.match(src,/getTracks/);assert.match(src,/Qo‘lda kiritish/);
});

test("sales and receiving expose the shared camera scanner",async()=>{
  const [sales,inventory]=await Promise.all([read("../src/pages/sales/Sales.jsx"),read("../src/pages/inventory/Inventory.jsx")]);
  assert.match(sales,/BarcodeScannerModal/);assert.match(sales,/Skanerlash/);assert.match(inventory,/BarcodeScannerModal/);assert.match(inventory,/mahsulot topilmadi/);
});

test("mobile shell reserves iOS safe areas",async()=>{
  const css=await read("../src/layout/mainlayout.scss");
  assert.match(css,/padding-top:calc\(64px \+ env\(safe-area-inset-top/);assert.match(css,/safe-area-inset-bottom/);
});

test("platform admin exposes real users, stores and API errors",async()=>{
  const [page,route]=await Promise.all([read("../src/pages/platformAdmin/PlatformAdmin.jsx"),read("../../backend/src/routes/platform.js")]);
  assert.match(page,/Platforma ma’lumotlari yuklanmadi/);assert.match(page,/Foydalanuvchilar/);assert.match(page,/Filiallar/);assert.match(route,/usersByOrg/);assert.match(route,/storesByOrg/);
});

test("telegram settings support scheduled daily reports without mixing payment bot",async()=>{
  const [settings,route,worker]=await Promise.all([read("../src/pages/settings/Settings.jsx"),read("../../backend/src/routes/telegram.js"),read("../../backend/src/services/notificationWorker.js")]);
  assert.match(settings,/dailyReportTime/);assert.match(route,/dailyReportTime/);assert.match(worker,/enqueueScheduledDailyReports/);assert.doesNotMatch(worker,/paymentBotToken/);
});
