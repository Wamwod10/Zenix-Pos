import { useEffect, useMemo, useState } from "react";
import {
  FiActivity, FiArchive, FiCheckCircle, FiClipboard, FiCreditCard, FiDatabase, FiDownload,
  FiFileText, FiHardDrive, FiMonitor, FiPackage, FiPrinter, FiRefreshCw,
  FiShoppingCart, FiTruck, FiWifi, FiWifiOff,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { PremiumSelect, StatusBadge } from "../../components/Ui";
import { useFeedback } from "../../context/FeedbackContext";
import { createXlsxBlob } from "../../utils/simpleXlsx";
import { supplierOpenDebt } from "../../utils/supplierLedger";
import { workspaceDateISO } from "../../utils/workspaceDate";
import { api } from "../../services/apiClient";

const humanCell=(value)=>{if(value==null)return"";if(Array.isArray(value))return value.map(humanCell).filter(Boolean).join(", ");if(typeof value==="object")return Object.entries(value).map(([key,item])=>`${key.replace(/[_-]+/g," ")}: ${humanCell(item)}`).join(" · ");return String(value)};
const csvCell = (value) => {
  const text = humanCell(value);
  return `"${text.replace(/"/g, '""')}"`;
};
const toCsv = (headers, rows) => [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const openPrintableReport = (title, headers, rows) => {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) return false;
  const tableHead = headers.map((cell)=>`<th>${escapeHtml(cell)}</th>`).join("");
  const tableRows = rows.map((row)=>`<tr>${row.map((cell)=>`<td>${escapeHtml(humanCell(cell))}</td>`).join("")}</tr>`).join("");
  popup.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#16181b}h1{font-size:20px;margin:0 0 6px}.meta{font-size:11px;color:#6b7280;margin-bottom:18px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #d7dbe0;padding:7px 8px;text-align:left;vertical-align:top}th{background:#f3f4f6;font-weight:700}@page{size:auto;margin:12mm}@media print{body{margin:0}}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">Zenix POS · ${new Intl.DateTimeFormat("uz-UZ",{dateStyle:"medium",timeStyle:"short"}).format(new Date())}</div><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table><script>window.onload=()=>{window.print()}<\/script></body></html>`);
  popup.document.close();
  return true;
};
const safeFilePart = (value) => String(value || "zenix").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "zenix";
const downloadBlob = (content, type, name) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
};
const flattenSales = (dailySales, salesHistory) => {
  const rows = [...(dailySales || [])];
  (salesHistory || []).forEach((item) => {
    if (Array.isArray(item?.sales)) rows.push(...item.sales);
    else if (item?.items || item?.total != null) rows.push(item);
  });
  const seen = new Set();
  return rows.filter((item) => {
    const key = item?.id || `${item?.dateISO || item?.date}-${item?.time || ""}-${item?.total || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
const formatBytes = (bytes) => {
  const value = Math.max(0, Number(bytes || 0));
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
};

export function ExportCenter() {
  const { currentUser } = useAuth();
  const {
    inventoryState, stores, currentStoreId, dailySales, salesHistory, suppliers, expenses,
    activityLogs, returns, inventoryTransfers, stockMovements, shiftHistory, organizations, payments,
    workspaceSettings, employees, addActivityLog, hasPermission, uiPreferences, setUiPreferences,
  } = useStore();
  const { notify } = useFeedback();
  const canExport=hasPermission("dataExport",currentUser?.appRole);
  const [exportFormat,setExportFormat]=useState("csv");
  const history = Array.isArray(uiPreferences?.exportHistory) ? uiPreferences.exportHistory : [];
  const sales = useMemo(() => flattenSales(dailySales, salesHistory), [dailySales, salesHistory]);
  const organization = organizations.find((item) => item.id === currentUser?.organizationId);

  const remember = (label, fileName, count, mode = "download") => {
    const entry = { id: crypto.randomUUID(), label, fileName, count, createdAt: new Date().toISOString() };
    const next = [entry, ...history].slice(0, 12);
    setUiPreferences({exportHistory:next});
    addActivityLog({ type: "export", title: "Ma’lumot eksport qilindi", description: `${label} · ${count} ta yozuv` });
    notify({ tone: "success", title: mode === "print" ? "PDF / chop oynasi ochildi" : "Eksport tayyor", message: fileName });
  };
  const today = workspaceDateISO(new Date(), workspaceSettings?.organization?.timezone || "Asia/Tashkent");
  const base = safeFilePart(organization?.name || currentUser?.organizationName || "zenix");
  const exportTabular = (label, slug, headers, rows, format = "csv") => {
    if(!canExport){notify({tone:"warning",title:"Eksportga ruxsat yo‘q",message:"Egasi bu amal uchun alohida ruxsat berishi kerak."});return;}
    if (format === "xlsx") {
      const file = `${base}-${slug}-${today}.xlsx`;
      downloadBlob(createXlsxBlob(label, headers, rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", file);
      remember(label, file, rows.length);
      return;
    }
    if (format === "pdf") {
      const opened = openPrintableReport(label, headers, rows);
      if (!opened) { notify({ tone:"warning", title:"PDF oynasi ochilmadi", message:"Brauzer yangi oynani bloklagan bo‘lishi mumkin." }); return; }
      remember(label, `${base}-${slug}-${today}.pdf`, rows.length, "print");
      return;
    }
    const file = `${base}-${slug}-${today}.csv`;
    downloadBlob(`\uFEFF${toCsv(headers, rows)}`, "text/csv;charset=utf-8", file);
    remember(label, file, rows.length);
  };

  const actions = [
    {
      id: "products", icon: FiPackage, title: "Mahsulotlar", description: "Katalog, shtrix-kod, narx va filiallar bo‘yicha qoldiq.", count: inventoryState.length,
      run: (format) => {
        const storeNames = Object.fromEntries(stores.map((store) => [store.id, store.name]));
        const rows = inventoryState.map((item) => [
          item.name, item.sku, item.barcode, item.category, item.brand, item.unit,
          item.sellPrice ?? item.price ?? 0, item.costPrice ?? 0,
          Object.values(item.stockByStore || {}).reduce((sum, qty) => sum + Number(qty || 0), 0),
          item.stockByStore?.[currentStoreId] ?? 0,
          Object.entries(item.stockByStore || {}).map(([id, qty]) => `${storeNames[id] || id}: ${qty}`).join(" | "),
          item.archived ? "Arxivda" : "Faol",
        ]);
        exportTabular("Mahsulotlar", "mahsulotlar", ["Mahsulot", "SKU", "Shtrix-kod", "Kategoriya", "Brend", "Birlik", "Sotuv narxi", "Tannarx", "Jami qoldiq", "Joriy filial qoldig‘i", "Filiallar bo‘yicha", "Holat"], rows, format);
      },
    },
    {
      id: "sales", icon: FiShoppingCart, title: "Savdolar", description: "Tranzaksiyalar, to‘lov turi, kassir va qaytarish summalari.", count: sales.length,
      run: (format) => {
        const rows = sales.map((sale) => [sale.id, sale.dateISO || sale.date, sale.time, sale.store || sale.storeName, sale.sellerName || sale.seller, sale.total, sale.returnedTotal || 0, sale.paymentMethod, sale.customer || "", sale.items?.length || 0]);
        exportTabular("Savdolar", "savdolar", ["ID", "Sana", "Vaqt", "Filial", "Kassir", "Jami", "Qaytarilgan", "To‘lov", "Mijoz", "Mahsulot turi"], rows, format);
      },
    },
    {
      id: "suppliers", icon: FiTruck, title: "Ta’minotchilar", description: "Ta’minotchilar, qarz va aloqa ma’lumotlari.", count: suppliers.length,
      run: (format) => {
        const rows = suppliers.map((item) => [item.name, item.phone, item.contact, (item.purchaseHistory || []).reduce((sum, row) => sum + Number(row.total || 0), 0), supplierOpenDebt(item), item.archived ? "Arxivda" : "Faol"]);
        exportTabular("Ta’minotchilar", "taminotchilar", ["Ta’minotchi", "Telefon", "Kontakt", "Xaridlar", "Qarz", "Holat"], rows, format);
      },
    },
    {
      id: "expenses", icon: FiArchive, title: "Xarajatlar", description: "Sana, kategoriya, summa va filial kesimida.", count: expenses.length,
      run: (format) => {
        const rows = expenses.map((item) => [item.id, item.dateISO || item.date, item.title || item.name || "Xarajat", item.category, item.note || "", item.amount, item.storeName || item.store, item.paymentMethod || ""]);
        exportTabular("Xarajatlar", "xarajatlar", ["ID", "Sana", "Xarajat", "Kategoriya", "Izoh", "Summa", "Filial", "To‘lov"], rows, format);
      },
    },
    {
      id: "activity", icon: FiActivity, title: "Amallar tarixi", description: "Kim, qachon va qaysi filialda nima qilgani.", count: activityLogs.length,
      run: (format) => {
        const rows = activityLogs.map((item) => [item.dateISO || item.date, item.time, item.userName, item.userRole, item.storeName, item.type, item.title, item.description]);
        exportTabular("Amallar tarixi", "amallar-tarixi", ["Sana", "Vaqt", "Xodim", "Rol", "Filial", "Tur", "Amal", "Tafsilot"], rows, format);
      },
    },
    {
      id: "stock", icon: FiHardDrive, title: "Ombor harakatlari", description: "Kirim, tuzatish, transfer va inventarizatsiya harakatlari.", count: stockMovements.length,
      run: (format) => {
        const rows = stockMovements.map((item) => [item.id, item.dateISO || item.date, item.storeName || stores.find((store)=>String(store.id)===String(item.storeId))?.name || "", item.product, item.type, item.qty, item.before, item.after, item.reason, item.user]);
        exportTabular("Ombor harakatlari", "ombor-harakatlari", ["ID", "Sana", "Filial", "Mahsulot", "Amal", "Miqdor", "Oldingi", "Keyingi", "Sabab", "Xodim"], rows, format);
      },
    },
    {
      id: "transfers", icon: FiTruck, title: "Transferlar", description: "Filiallararo jo‘natma, qabul va farq ma’lumotlari.", count: inventoryTransfers.length,
      run: (format) => {
        const rows = inventoryTransfers.map((item) => [item.id, item.createdAt || item.date, item.from, item.to, item.status, (item.items || []).length, (item.items || []).reduce((sum,row)=>sum+Number(row.qty||0),0), item.differenceReason || "", item.createdBy || ""]);
        exportTabular("Transferlar", "transferlar", ["ID", "Sana", "Qayerdan", "Qayerga", "Holat", "Mahsulot turi", "Jami birlik", "Farq sababi", "Yaratgan"], rows, format);
      },
    },
    {
      id: "returns", icon: FiRefreshCw, title: "Qaytarishlar", description: "Qaytarilgan mahsulot, summa, sabab va to‘lov usuli.", count: returns.length,
      run: (format) => {
        const rows = returns.map((item) => [item.id, item.saleId, item.dateISO || item.date, item.storeName || stores.find((store)=>String(store.id)===String(item.storeId))?.name || "", item.productName, item.quantity, item.amount, item.reason, item.refundMethod || item.paymentMethod, item.sellerName || ""]);
        exportTabular("Qaytarishlar", "qaytarishlar", ["ID", "Savdo ID", "Sana", "Filial", "Mahsulot", "Miqdor", "Summa", "Sabab", "Qaytarish usuli", "Xodim"], rows, format);
      },
    },
    {
      id: "shifts", icon: FiClipboard, title: "Smenalar", description: "Kassir, ochilish/yopilish va kassa farqlari.", count: shiftHistory.length,
      run: (format) => {
        const rows = shiftHistory.map((item) => [item.id, item.storeName, item.cashierName, item.openedAt, item.closedAt, item.openingCash, item.expectedCash, item.actualCash, item.difference, item.note || item.closeNote || ""]);
        exportTabular("Smenalar", "smenalar", ["ID", "Filial", "Kassir", "Ochilgan", "Yopilgan", "Boshlang‘ich naqd", "Kutilgan naqd", "Haqiqiy naqd", "Farq", "Izoh"], rows, format);
      },
    },
    {
      id: "employees", icon: FiClipboard, title: "Xodimlar", description: "Xodim, telefon, rol, filial va hisob holati.", count: employees.length,
      run: (format) => {
        const rows = employees.map((item) => [item.name, item.phone, item.username || "", item.role, stores.find((store)=>String(store.id)===String(item.storeId))?.name || item.storeName || "", item.active === false ? "Faol emas" : "Faol"]);
        exportTabular("Xodimlar", "xodimlar", ["Xodim", "Telefon", "Kirish nomi", "Rol", "Filial", "Holat"], rows, format);
      },
    },
    {
      id: "billing", icon: FiCreditCard, title: "Tarif to‘lovlari", description: "Tarif, filial limiti va tekshiruv holatlari.", count: payments.filter((item)=>!currentUser?.organizationId||item.organizationId===currentUser.organizationId).length,
      run: (format) => {
        const rows = payments.filter((item)=>!currentUser?.organizationId||item.organizationId===currentUser.organizationId).map((item) => [item.orderId || item.id, item.submittedAt, item.purpose, item.servicePeriodFrom || "", item.servicePeriodTo || "", item.amount, item.status, item.receiptName || ""]);
        exportTabular("Tarif to‘lovlari", "tarif-tolovlari", ["Buyurtma", "Yuborilgan", "Maqsad", "Davr boshi", "Davr oxiri", "Summa", "Holat", "Chek"], rows, format);
      },
    },
    {
      id: "backup", icon: FiDatabase, title: "Ish maydoni nusxasi", description: "Ish maydonidagi server ma’lumotlarining to‘liq JSON nusxasi.", count: inventoryState.length + sales.length + suppliers.length + expenses.length,
      run: (format) => {
        if(!canExport){notify({tone:"warning",title:"Eksportga ruxsat yo‘q",message:"Egasi bu amal uchun alohida ruxsat berishi kerak."});return;}
        const payload = {
          exportedAt: new Date().toISOString(), organization, stores, inventory: inventoryState, sales,
          suppliers, expenses, returns, inventoryTransfers, stockMovements, shiftHistory,
          activityLogs, workspaceSettings, employees,
        };
        const file = `${base}-workspace-${today}.json`;
        downloadBlob(JSON.stringify(payload, null, 2), "application/json;charset=utf-8", file);
        remember("Ish maydoni nusxasi", file, Object.keys(payload).length);
      },
    },
  ];

  return <>
    <div className="pro-card-head"><div><h2>Eksport markazi</h2><p>Asosiy ma’lumotlarni xavfsiz faylga chiqarib oling. Eksport ma’lumotni o‘zgartirmaydi.</p></div><div className="export-format-control"><small>Jadval formati</small><PremiumSelect value={exportFormat} onChange={(event)=>setExportFormat(event.target.value)}><option value="csv">CSV</option><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF / chop</option></PremiumSelect></div></div>
    {!canExport&&<div className="pro-alert warning">Ma’lumotlarni yuklab olish uchun “Ma’lumot eksport qilish” ruxsati kerak.</div>}
    <div className="export-center-grid">
      {actions.map((item) => { const Icon = item.icon; return <article key={item.id} className="export-card"><span className="export-card-icon"><Icon/></span><span><strong>{item.title}</strong><small>{item.description}</small><em>{item.count} ta yozuv</em></span><button type="button" className="pro-btn secondary" disabled={!canExport} onClick={()=>item.run(item.id==="backup"?"json":exportFormat)}>{item.id==="backup"?<FiDatabase/>:exportFormat==="pdf"?<FiPrinter/>:<FiDownload/>} {item.id==="backup"?"JSON yuklash":exportFormat==="pdf"?"PDF / chop":exportFormat==="xlsx"?"Excel yuklash":"CSV yuklash"}</button></article>; })}
    </div>
    <div className="export-history-block"><div className="pro-card-head"><div><h2>Oxirgi eksportlar</h2><p>Akkauntingizda saqlangan so‘nggi eksportlar tarixi.</p></div></div>{history.length ? <div className="export-history-list">{history.map((item) => <div key={item.id}><FiFileText/><span><strong>{item.label}</strong><small>{item.fileName} · {item.count} ta yozuv</small></span><time>{new Intl.DateTimeFormat("uz-UZ", { dateStyle:"short", timeStyle:"short" }).format(new Date(item.createdAt))}</time></div>)}</div> : <div className="pro-empty"><FiDownload/><strong>Hali eksport qilinmagan</strong><span>Yuqoridagi bo‘limlardan birini yuklab oling.</span></div>}</div>
  </>;
}

export function SystemDiagnostics() {
  const { currentUser } = useAuth();
  const { telegramSettings, loading, stores, inventoryState } = useStore();
  const { notify } = useFeedback();
  const [version, setVersion] = useState(0);
  const [apiHealth,setApiHealth]=useState({status:"checking",message:"Server tekshirilmoqda."});
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const manifest = typeof document !== "undefined" ? Boolean(document.querySelector('link[rel="manifest"]')) : false;
  const serviceWorkerSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const serviceWorkerActive = serviceWorkerSupported && Boolean(navigator.serviceWorker.controller);
  useEffect(()=>{
    let cancelled=false;
    setApiHealth({status:"checking",message:"Server tekshirilmoqda."});
    api.get("/health").then((payload)=>{
      if(!cancelled)setApiHealth({status:"ready",message:`${payload?.service||"Zenix POS API"} javob bermoqda.`});
    }).catch((error)=>{
      if(!cancelled)setApiHealth({status:"error",message:error?.message||"Backend bilan aloqa yo‘q."});
    });
    return()=>{cancelled=true};
  },[version]);
  const telegramConnections=Object.values(telegramSettings?.connections||{});
  const connectedTelegram=telegramConnections.find((item)=>item?.connected) || (telegramSettings?.connected ? telegramSettings : null);
  const checks = [
    { id:"internet", icon: online ? FiWifi : FiWifiOff, label:"Internet", value:online ? "Ulangan" : "Ulanmagan", tone:online ? "success" : "warning", note:online ? "Tarmoq mavjud." : "Server operatsiyalari internet tiklanguncha bajarilmaydi." },
    { id:"api", icon:FiDatabase, label:"Backend API", value:apiHealth.status==="ready"?"Ulangan":apiHealth.status==="checking"?"Tekshirilmoqda":"Ulanmagan", tone:apiHealth.status==="ready"?"success":apiHealth.status==="checking"?"warning":"danger", note:apiHealth.message },
    { id:"files", icon:FiFileText, label:"Fayl yuklash", value:typeof File !== "undefined" && typeof FileReader !== "undefined" ? "Tayyor" : "Cheklangan", tone:typeof File !== "undefined" ? "success" : "warning", note:"PDF, jadval, matn va rasm importi uchun brauzer imkoniyati." },
    { id:"print", icon:FiPrinter, label:"Chop etish", value:typeof window !== "undefined" && typeof window.print === "function" ? "Tayyor" : "Cheklangan", tone:typeof window !== "undefined" && typeof window.print === "function" ? "success" : "warning", note:"Haqiqiy printer tanlovi brauzer/OS printer oynasida bajariladi." },
    { id:"fullscreen", icon:FiMonitor, label:"To‘liq ekran", value:typeof document !== "undefined" && document.fullscreenEnabled ? "Qo‘llanadi" : "Qo‘llanmaydi", tone:typeof document !== "undefined" && document.fullscreenEnabled ? "success" : "neutral", note:"POS va ish joyi uchun fullscreen rejimi." },
    { id:"telegram", icon:FiActivity, label:"Telegram", value:connectedTelegram ? "Ulangan" : "Ulanmagan", tone:connectedTelegram ? "success" : "neutral", note:connectedTelegram ? `${telegramConnections.filter((item)=>item?.connected).length || 1} ta filial guruhi ulangan` : "Bot serverga ulanganda real bildirishnomalar ishlaydi." },
    { id:"pwa", icon:FiMonitor, label:"Ilova rejimi (PWA)", value:manifest && serviceWorkerActive ? "Faol" : manifest || serviceWorkerSupported ? "Tayyorlanmoqda" : "Qo‘llanmaydi", tone:manifest && serviceWorkerActive ? "success" : "warning", note:`Manifest: ${manifest ? "bor" : "yo‘q"} · Service Worker: ${serviceWorkerActive ? "faol" : serviceWorkerSupported ? "qo‘llanadi" : "yo‘q"}` },
    { id:"workspace", icon:FiDatabase, label:"Ish muhiti", value:loading ? "Yuklanmoqda" : "Tayyor", tone:loading ? "warning" : "success", note:`${stores.filter((item)=>item.active!==false).length} ta faol filial · ${inventoryState.length} ta katalog yozuvi` },
  ];
  const copySummary = async () => {
    const summary = [
      `Zenix POS diagnostika`,
      `Foydalanuvchi: ${currentUser?.username || currentUser?.name || "—"}`,
      `Brauzer: ${navigator.userAgent}`,
      ...checks.map((item) => `${item.label}: ${item.value}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(summary); notify({ tone:"success", title:"Diagnostika nusxalandi" }); }
    catch { notify({ tone:"warning", title:"Nusxalab bo‘lmadi", message:"Brauzer clipboard ruxsatini bermadi." }); }
  };
  return <>
    <div className="pro-card-head"><div><h2>Tizim diagnostikasi</h2><p>Zenix POS ishlashi uchun muhim brauzer va integratsiya holatlarini tekshiring.</p></div><div className="diagnostics-actions"><button type="button" className="pro-btn secondary" onClick={()=>setVersion((value)=>value+1)}><FiRefreshCw/> Qayta tekshirish</button><button type="button" className="pro-btn secondary" onClick={copySummary}><FiClipboard/> Nusxalash</button></div></div>
    <div className="diagnostics-grid">{checks.map((item) => { const Icon = item.icon; return <article key={item.id} className="diagnostic-card"><span className={`diagnostic-icon ${item.tone}`}><Icon/></span><span><small>{item.label}</small><strong>{item.value}</strong><p>{item.note}</p></span><StatusBadge tone={item.tone}>{item.tone === "success" ? "Yaxshi" : item.tone === "danger" ? "Xato" : item.tone === "warning" ? "E’tibor" : "Holat"}</StatusBadge></article>; })}</div>
    <div className="diagnostics-note"><FiCheckCircle/><span><strong>Tizim diagnostikasi</strong><small>API, ma’lumotlar bazasi, Telegram, fayl yuklash va brauzer xizmatlari holatini shu markazdan tekshiring.</small></span></div>
  </>;
}
