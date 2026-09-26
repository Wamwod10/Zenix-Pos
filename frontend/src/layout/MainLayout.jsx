import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { ROLE_LABELS, ROLES } from "../config/roles";
import { BILLING_CONFIG } from "../config/billing";
import {
  FiActivity, FiArchive, FiBarChart2, FiBell, FiBriefcase, FiCheck, FiChevronDown, FiCommand,
  FiCreditCard, FiGrid, FiHelpCircle, FiLogOut, FiMapPin, FiMenu, FiMoon, FiPackage, FiPlus, FiRefreshCw,
  FiSearch, FiSettings, FiShield, FiShoppingCart, FiSun, FiTruck, FiUserCheck, FiX, FiClock,
  FiCalendar, FiTrendingUp, FiWifiOff, FiMaximize2, FiMinimize2, FiUser,
} from "react-icons/fi";
import { formatWorkspaceDate, workspaceTime } from "../utils/workspaceDate";
import Modal from "../components/Modal";
import { useFeedback } from "../context/FeedbackContext";
import "./mainlayout.scss";

const routeIndex = [
  ["Boshqaruv paneli","Boshqaruv, bosh sahifa","/"],["Kassa / Smena","Smena ochish, kassa","/shifts"],["Savdo","POS, kassa, sotuv","/sales"],
  ["Savdo tarixi","Cheklar, qaytarish va savdo tarixi","/history"],["Mahsulotlar","Katalog, shtrix-kod va SKU","/products"],["Ombor","Qoldiq, inventarizatsiya va transfer","/inventory"],
  ["Ta’minotchilar","Ta’minotchi, qarz va xarid","/suppliers"],["Xarajatlar","Xarajat va kategoriyalar","/expenses"],["Analitika","Hisobot, foyda, trend","/analytics"],
  ["Sotuvchi tahlili","Sotuvchi va kassir natijalari","/seller-analytics"],["Amallar tarixi","Audit va amallar tarixi","/activity-log"],["Sozlamalar","Interfeys, tashkilot, POS","/settings"],["Tarif va to‘lovlar","Tarif, muddat va to‘lov","/billing"],["Yordam Markazi","Qo‘llanma, ishni boshlash va platformadan foydalanish","/help"],
];

const GUIDE_COACH = {
  start:["Tashkilot va filial ma’lumotlarini tekshiring.","Xodim va ruxsatlarni tayyorlang.","Omborda birinchi kirimni qiling.","Smenani ochib test savdosini bajaring."],
  sale:["Smena ochiq ekanini tekshiring.","Mahsulotni qidiring yoki shtrix-kodni skaner qiling.","Miqdor va kerak bo‘lsa chegirmani belgilang.","To‘lov usulini tanlab savdoni yakunlang."],
  receive:["Kirim oynasini oching.","Mavjud mahsulotni toping yoki yangi mahsulot yarating.","Miqdor, tannarx, sotuv narxi va ta’minotchini tekshiring.","To‘langan summa va qarzni tekshirib kirimni tasdiqlang."],
  "quick-receive":["Tezkor kirimni oching.","Bir nechta mahsulot qatorini tayyorlang.","Miqdor va narxlarni tekshiring.","Barchasini bir kirimda tasdiqlang."],
  "document-import":["Hujjatdan importni oching.","PDF, jadval yoki matnli hujjatni yuklang.","Zenix POS topgan qatorlarni ko‘rib chiqing.","Noaniq joylarni tuzatib, keyin kirimni tasdiqlang."],
  products:["Kerakli mahsulotni qidiring.","Katalog ma’lumotini ko‘ring yoki tahrirlang.","Qoldiqni o‘zgartirish uchun Omborga kirimdan foydalaning."],
  return:["Qaytariladigan savdoni oching.","Mahsulot va miqdorni belgilang.","Sabab va pul qaytarish usulini tekshiring.","Tasdiqlang — qoldiq va kassa hisobi yangilanadi."],
  transfer:["Qabul qiluvchi filialni tanlang.","Mahsulot va miqdorlarni qo‘shing.","Kerak bo‘lsa tasdiqlashdan o‘tkazing.","Qabul qiluvchi filial real kelgan miqdorni qabul qiladi."],
  count:["Real qoldiqni sanang.","Tizim qoldig‘i bilan farqni tekshiring.","Tasdiqlash talab qilinsa yuboring.","Qoldiq o‘zgargan bo‘lsa Zenix POS ziddiyatni ko‘rsatadi."],
  supplier:["Ta’minotchini tanlang.","Nakladnoy va ochiq qarzlarni ko‘ring.","Qisman yoki to‘liq to‘lovni kiriting.","Naqd to‘lovni xohlasangiz joriy kassaga bog‘lang."],
  shift:["Boshlang‘ich naqd bilan smenani oching.","Kassa kirim-chiqimlarini sabab bilan yozing.","Yopishda haqiqiy naqdni sanang.","Farq bo‘lsa sababini tekshirib smenani yoping."],
  employees:["Xodimlar bo‘limini oching.","Ism, telefon, login, rol va filialni kiriting.","Kerak bo‘lsa shaxsiy ruxsatlarni sozlang.","Xodim accounti va holatini tekshiring."],
  billing:["Joriy tugash sanasini tekshiring.","Qaysi sanagacha uzaytirishni tanlang.","Filial limiti va hisoblangan summani tekshiring.","To‘lov chekini yuboring va tasdiqlanishini kuting."],
  expenses:["Xarajat qo‘shishni oching.","Kategoriya, summa va to‘lov turini kiriting.","Kerak bo‘lsa chekni biriktiring.","Naqd xarajat smenadagi kassa chiqimiga tushishini tekshiring."],
  analytics:["Davr va filialni tanlang.","Sof savdo va foyda KPI’larini ko‘ring.","Kesimlar va dinamikani tahlil qiling.","Kerak bo‘lsa eksport qiling."],
  telegram:["Joriy filial uchun “Telegram guruhini ulash”ni bosing.","Telegram ochilganda kerakli ishchi guruhni tanlang.","@zenixposbot guruhga qo‘shilgach Zenix POS ulanishni avtomatik tasdiqlaydi.","Ulangan guruh nomini tekshirib, bildirishnomalarni yoqing."],
  settings:["Kerakli sozlama bo‘limini tanlang.","Sozlama barcha filialgami yoki joriy filialgami qo‘llanishini tekshiring.","O‘zgarishni kiriting — avtomatik saqlanish holatini kuzating.","Texnik sozlamalar Kengaytirilgan bo‘limida."],
};

const formatRate=(value)=>new Intl.NumberFormat("uz-UZ",{maximumFractionDigits:2}).format(Number(value||0));

const normalizeHex = (value, fallback = "#647687") => {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) return `#${raw.slice(1).split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  return fallback;
};
const mixHex = (hex, target, ratio = 0.16) => {
  const value = normalizeHex(hex);
  const targetHex = normalizeHex(target, "#000000");
  const channel = (source, dest) => Math.round(source + (dest - source) * ratio);
  const parts = [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
  const targetParts = [1, 3, 5].map((start) => parseInt(targetHex.slice(start, start + 2), 16));
  return `#${parts.map((part, index) => channel(part, targetParts[index]).toString(16).padStart(2, "0")).join("")}`;
};
const contrastForHex = (hex) => {
  const value = normalizeHex(hex);
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(value.slice(start, start + 2), 16));
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#17191a" : "#ffffff";
};

function MainLayout(){
  const { currentUser, logout } = useAuth();
  const {
    inventory, suppliers, stores, currentStore, currentStoreId, setSelectedStoreId, addStore,
    dailySales, salesHistory, employees, activeShift, payments, organizations, uiPreferences, setUiPreferences, effectiveWorkspaceSettings:workspaceSettings, hasPermission,
    inventoryTransfers, inventoryCounts, businessFeatures, persistenceError,
  } = useStore();
  const navigate = useNavigate();
  const location=useLocation();
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [notificationView,setNotificationView]=useState("all");
  const [storeOpen,setStoreOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [shortcutOpen,setShortcutOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const [branchModal,setBranchModal]=useState(false);
  const [branchName,setBranchName]=useState("");
  const [branchError,setBranchError]=useState("");
  const [clock,setClock]=useState(()=>new Date());
  const [fx,setFx]=useState(null);
  const [fxStatus,setFxStatus]=useState("idle");
  const [readNotifications,setReadNotifications]=useState(()=>new Set());
  const searchRef=useRef(null);
  const commandRef=useRef(null);
  const headerRef=useRef(null);
  const previousFocusRef=useRef(null);
  const { notify, dismiss, guardNavigation } = useFeedback();
  const [isOnline,setIsOnline]=useState(()=>typeof navigator === "undefined" ? true : navigator.onLine);
  const [isFullscreen,setIsFullscreen]=useState(()=>Boolean(document.fullscreenElement));
  const [guideStep,setGuideStep]=useState(0);
  const wasOfflineRef=useRef(!isOnline);
  const guideParams=new URLSearchParams(location.search);
  const guideId=guideParams.get("guide")||"";
  const guideSteps=GUIDE_COACH[guideId]||[];

  const isPlatform=currentUser?.appRole===ROLES.PLATFORM_ADMIN;
  const management=[ROLES.OWNER,ROLES.ADMIN,ROLES.MANAGER];
  const ownerAdmin=[ROLES.OWNER,ROLES.ADMIN];
  const canApproveInventoryCount=!isPlatform&&hasPermission("inventoryCountApprove",currentUser?.appRole);
  const canApproveTransfer=!isPlatform&&hasPermission("transferApprove",currentUser?.appRole);
  const canOpenSettings=!isPlatform&&hasPermission("moduleSettings",currentUser?.appRole);
  const canAddStore=!isPlatform&&hasPermission("settingsWrite",currentUser?.appRole);
  const activeStores=stores.filter(store=>store.active!==false);
  const hasStoreSelector=!isPlatform&&management.includes(currentUser?.appRole)&&activeStores.length>0;
  const currentOrg=organizations.find(item=>item.id===currentUser?.organizationId);
  const includedStores=Number(currentOrg?.includedStores||BILLING_CONFIG.annual.includedStores);
  const storeLimit=Math.max(includedStores,Number(currentOrg?.storeLimit||includedStores));
  const branchNeedsBilling=activeStores.length>=storeLimit;

  const menuItems=isPlatform?[{title:"Platforma administratori",path:"/platform",icon:FiShield}]:[
    {title:"Boshqaruv paneli",path:"/",icon:FiGrid,permission:"moduleDashboard",group:"Asosiy"},{title:"Kassa / Smena",path:"/shifts",icon:FiBriefcase,permission:"moduleShifts",group:"Savdo"},
    {title:"Savdo",path:"/sales",icon:FiShoppingCart,permission:"moduleSales",group:"Savdo"},{title:"Savdo tarixi",path:"/history",icon:FiClock,permission:"moduleHistory",group:"Savdo"},
    {title:"Mahsulotlar",path:"/products",icon:FiPackage,permission:"moduleProducts",group:"Ombor"},{title:"Ombor",path:"/inventory",icon:FiArchive,permission:"moduleInventory",group:"Ombor"},
    {title:"Ta’minotchilar",path:"/suppliers",icon:FiTruck,permission:"moduleSuppliers",group:"Ombor"},{title:"Xarajatlar",path:"/expenses",icon:FiCreditCard,permission:"moduleExpenses",group:"Tahlil"},
    {title:"Analitika",path:"/analytics",icon:FiBarChart2,permission:"moduleAnalytics",group:"Tahlil"},{title:"Sotuvchi tahlili",path:"/seller-analytics",icon:FiUserCheck,permission:"moduleSellerAnalytics",group:"Tahlil"},
    {title:"Amallar tarixi",path:"/activity-log",icon:FiActivity,permission:"moduleActivityLog",group:"Boshqaruv"},{title:"Sozlamalar",path:"/settings",icon:FiSettings,permission:"moduleSettings",group:"Boshqaruv"},{title:"Tarif va to‘lovlar",path:"/billing",icon:FiCreditCard,permission:"moduleBilling",group:"Boshqaruv"},{title:"Yordam Markazi",path:"/help",icon:FiHelpCircle,group:"Boshqaruv"},
  ];
  const visibleMenu=isPlatform?menuItems:menuItems.filter(item=>{
    if(item.path==="/suppliers"&&businessFeatures?.supplierTracking===false)return false;
    return !item.permission||hasPermission(item.permission,currentUser?.appRole);
  });
  const groupedMenu=visibleMenu.reduce((groups,item)=>{const key=item.group||"Platform";(groups[key]||(groups[key]=[])).push(item);return groups},{});
  const currentMenuItem=visibleMenu.find((item)=>item.path==="/"?location.pathname==="/":location.pathname===item.path||location.pathname.startsWith(`${item.path}/`));
  const mobilePriority=["/","/sales","/inventory","/analytics","/products","/shifts","/history","/platform"];
  const mobileNavItems=mobilePriority.map((path)=>visibleMenu.find((item)=>item.path===path)).filter(Boolean).slice(0,4);
  const mobileMoreActive=!mobileNavItems.some((item)=>item.path==="/"?location.pathname==="/":location.pathname===item.path||location.pathname.startsWith(`${item.path}/`));

  useEffect(()=>{
    const root=document.documentElement;
    const pref=uiPreferences;
    const accent=normalizeHex(pref.accent,"#647687");
    root.style.setProperty("--accent",accent);
    root.style.setProperty("--primary",accent);
    root.style.setProperty("--primary-dark",mixHex(accent,"#000000",0.17));
    root.style.setProperty("--primary-contrast",contrastForHex(accent));
    root.style.setProperty("--sidebar-width",`${pref.sidebarWidth||277}px`);
    root.dataset.currency=workspaceSettings.organization.currency||"UZS";
    document.body.dataset.density=pref.density||"comfortable";
    document.body.dataset.sidebarMode=pref.sidebarMode||"comfortable";
    document.body.dataset.fontScale=pref.fontScale||"default";
    document.body.dataset.radius=pref.radius||"medium";
    document.body.dataset.tableDensity=pref.tableDensity||"comfortable";
    document.body.dataset.navbarCompact=String(Boolean(pref.navbarCompact));
    document.body.classList.toggle("no-card-shadow",!pref.cardShadow);
    document.body.classList.toggle("reduce-motion",Boolean(pref.reducedMotion));
    const dark=pref.theme==="dark"||(pref.theme==="system"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark-mode",dark);
    const themeMeta=document.querySelector('meta[name="theme-color"]');
    if(themeMeta)themeMeta.setAttribute("content",dark?"#111315":"#f3f4f4");
  },[uiPreferences,workspaceSettings.organization.currency]);

  useEffect(()=>{
    let interval=null;
    const sync=()=>{setClock(new Date());interval=window.setInterval(()=>setClock(new Date()),60_000)};
    const timeout=window.setTimeout(sync,60_000-(Date.now()%60_000)+25);
    return()=>{window.clearTimeout(timeout);if(interval)window.clearInterval(interval)};
  },[]);
  useEffect(()=>setGuideStep(0),[guideId]);
  useEffect(()=>{
    const update=()=>{
      const next=navigator.onLine;
      setIsOnline(next);
      if(!next){
        wasOfflineRef.current=true;
        notify({id:"zenix-offline",tone:"warning",title:"Internet uzildi",message:"Server bilan aloqa uzildi. Yangi operatsiyalarni bajarishdan oldin internet qayta ulanishini kuting.",duration:0});
      }else if(wasOfflineRef.current){
        wasOfflineRef.current=false;
        dismiss("zenix-offline");
        notify({tone:"success",title:"Internet qayta ulandi",message:"Ulanish tiklandi."});
      }
    };
    window.addEventListener("online",update);window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)};
  },[notify,dismiss]);
  useEffect(()=>{
    if(persistenceError)notify({id:"zenix-persistence-error",tone:"danger",title:"Ma’lumot saqlanmadi",message:persistenceError,duration:0});
    else dismiss("zenix-persistence-error");
  },[persistenceError,notify,dismiss]);
  useEffect(()=>{const onChange=()=>setIsFullscreen(Boolean(document.fullscreenElement));document.addEventListener("fullscreenchange",onChange);return()=>document.removeEventListener("fullscreenchange",onChange)},[]);
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{notify({tone:"warning",title:"To‘liq ekran ochilmadi",message:"Brauzer fullscreen rejimini blokladi."})}};
  useEffect(()=>{
    const ids=Array.isArray(uiPreferences?.readNotificationIds)?uiPreferences.readNotificationIds:[];
    setReadNotifications(new Set(ids));
  },[uiPreferences?.readNotificationIds,currentUser?.id]);
  useEffect(()=>{setSidebarOpen(false);setSearch("");setSearchOpen(false);setQuickOpen(false);setToolsOpen(false);setShortcutOpen(false);setProfileOpen(false)},[location.pathname]);
  useEffect(()=>{const fn=e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearchOpen(true);setTimeout(()=>searchRef.current?.focus(),0)}
    if((e.ctrlKey||e.metaKey)&&e.key==="/"){e.preventDefault();setShortcutOpen(v=>!v)}
    if(e.key==="Escape"){setSearchOpen(false);setNotificationsOpen(false);setStoreOpen(false);setQuickOpen(false);setToolsOpen(false);setShortcutOpen(false);setProfileOpen(false);setSidebarOpen(false)}
  };window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn)},[]);
  useEffect(()=>{document.body.style.overflow=(sidebarOpen||searchOpen)?"hidden":"";return()=>{document.body.style.overflow=""}},[sidebarOpen,searchOpen]);
  useEffect(()=>{
    if(!searchOpen){previousFocusRef.current?.focus?.();return undefined}
    previousFocusRef.current=document.activeElement;
    const node=commandRef.current;
    const onKey=(event)=>{
      if(event.key!=="Tab"||!node)return;
      const focusables=[...node.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')];
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[searchOpen]);
  useEffect(()=>{
    const close=(event)=>{
      if(headerRef.current&&!headerRef.current.contains(event.target)){
        setStoreOpen(false);setQuickOpen(false);setToolsOpen(false);setShortcutOpen(false);setNotificationsOpen(false);setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);
  },[]);

  const refreshFx=async()=>{
    if(fxStatus==="loading")return;
    setFxStatus("loading");
    try{
      const response=await fetch("https://cbu.uz/uz/arkhiv-kursov-valyut/json/",{headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("FX unavailable");
      const data=await response.json();
      const wanted=new Set(["USD","EUR","RUB"]);
      const rates=data.filter(item=>wanted.has(item.Ccy)).map(item=>({code:item.Ccy,rate:Number(item.Rate),diff:Number(item.Diff||0),date:item.Date}));
      const payload={rates,updatedAt:new Date().toISOString()};
      setFx(payload);setFxStatus("ready");
    }catch{setFxStatus("error")}
  };
  useEffect(()=>{
    if(!toolsOpen)return;
    const age=fx?.updatedAt?Date.now()-new Date(fx.updatedAt).getTime():Infinity;
    if(age>30*60*1000)refreshFx();
  },[toolsOpen]);

  const notifications=useMemo(()=>{
    const items=[];
    if(isPlatform){
      const review=payments?.filter(p=>p.status==="REVIEW").length||0;
      if(review)items.unshift({id:"pay",tone:"info",title:`${review} ta to‘lov tekshiruvda`,text:"To‘lovlar navbatini tekshiring",path:"/platform"});
      return items;
    }
    const notify=workspaceSettings.notifications||{};
    if(hasPermission("moduleInventory",currentUser?.appRole)){
      if(notify.outOfStock!==false)inventory.filter(p=>Number(p.quantity)<=0).slice(0,2).forEach(p=>items.push({id:`out-${p.id}`,tone:"danger",title:"Mahsulot tugagan",text:p.name,path:"/inventory"}));
      if(notify.lowStock!==false)inventory.filter(p=>Number(p.quantity)>0&&Number(p.quantity)<=Number(p.minStock??workspaceSettings.inventory.defaultLowStock??5)).slice(0,2).forEach(p=>items.push({id:`low-${p.id}`,tone:"warning",title:"Kam qoldiq",text:`${p.name} · ${p.quantity} ${p.unit||"dona"}`,path:"/inventory"}));
    }
    if(notify.shift!==false&&!activeShift&&hasPermission("moduleShifts",currentUser?.appRole))items.unshift({id:"shift",tone:"info",title:"Smena ochilmagan",text:"Savdo boshlashdan oldin kassani oching",path:"/shifts"});
    if(notify.approvals!==false&&(canApproveInventoryCount||canApproveTransfer)){
      if(canApproveInventoryCount){
        const pendingCounts=(inventoryCounts||[]).filter(item=>item.status==="PENDING"&&(!currentStoreId||item.storeId===currentStoreId));
        if(pendingCounts.length)items.unshift({id:"inventory-count-approval",tone:"warning",title:`${pendingCounts.length} ta inventarizatsiya tasdiq kutmoqda`,text:"Sanov natijalarini tekshiring",path:"/inventory"});
      }
      if(canApproveTransfer){
        const pendingTransfers=(inventoryTransfers||[]).filter(item=>item.status==="PENDING"&&(!currentStoreId||item.fromStoreId===currentStoreId));
        if(pendingTransfers.length)items.unshift({id:"transfer-approval",tone:"warning",title:`${pendingTransfers.length} ta transfer tasdiq kutmoqda`,text:"Filiallararo transferlarni tekshiring",path:"/inventory"});
      }
    }
    if(notify.supplierDebt!==false&&hasPermission("moduleSuppliers",currentUser?.appRole)){
      const today=new Date(clock);today.setHours(0,0,0,0);
      const overdue=(suppliers||[]).flatMap(supplier=>(supplier.purchaseHistory||[]).filter(row=>Number(row.balance||0)>0&&row.dueDate&&new Date(`${String(row.dueDate).slice(0,10)}T00:00:00`).getTime()<today.getTime()).map(row=>({supplier,row})));
      if(overdue.length)items.unshift({id:"supplier-debt-overdue",tone:"warning",title:`${overdue.length} ta qarz muddati o‘tgan`,text:"Ta’minotchi qarzlarini tekshiring",path:"/suppliers"});
    }
    if(notify.billing!==false){
      const org=(organizations||[]).find(item=>item.id===currentUser?.organizationId);
      const rawExpiry=org?.expiryDate;
      const expiryMs=rawExpiry?new Date(String(rawExpiry).includes("T")?rawExpiry:`${rawExpiry}T23:59:59`).getTime():NaN;
      if(Number.isFinite(expiryMs)){
        const days=Math.ceil((expiryMs-clock.getTime())/86400000);
        if(days<0)items.unshift({id:"billing-expired",tone:"danger",title:"Tarif muddati tugagan",text:"Platformadan to‘liq foydalanish uchun tarifni uzaytiring",path:"/billing"});
        else if(days<=14)items.unshift({id:"billing-expiring",tone:days<=3?"danger":"warning",title:"Tarif muddati yaqinlashmoqda",text:`${Math.max(0,days)} kun qoldi`,path:"/billing"});
      }
      const orgReview=(payments||[]).filter(p=>p.organizationId===currentUser?.organizationId&&p.status==="REVIEW").length;
      if(orgReview)items.unshift({id:"billing-review",tone:"info",title:"To‘lov tekshiruvda",text:"Chekingiz administrator tomonidan ko‘rib chiqilmoqda",path:"/billing"});
    }
    return items.slice(0,9);
  },[inventory,suppliers,activeShift,isPlatform,payments,workspaceSettings.inventory.defaultLowStock,workspaceSettings.notifications,inventoryCounts,inventoryTransfers,organizations,currentUser?.appRole,currentUser?.organizationId,currentStoreId,clock,hasPermission,canApproveInventoryCount,canApproveTransfer]);
  const unreadNotifications=notifications.filter(item=>!readNotifications.has(item.id));
  const visibleNotifications=notificationView==="unread"?unreadNotifications:notifications;
  const persistReadNotifications=(next)=>{
    setReadNotifications(next);
    setUiPreferences({readNotificationIds:[...next]});
  };
  const markNotificationRead=(id)=>{const next=new Set(readNotifications);next.add(id);persistReadNotifications(next)};
  const markAllNotificationsRead=()=>persistReadNotifications(new Set(notifications.map(item=>item.id)));
  useEffect(()=>{
    const activeIds=new Set(notifications.map((item)=>item.id));
    const pruned=new Set([...readNotifications].filter((id)=>activeIds.has(id)));
    if(pruned.size===readNotifications.size)return;
    setReadNotifications(pruned);
    setUiPreferences({readNotificationIds:[...pruned]});
  },[notifications,readNotifications,setUiPreferences]);

  const results=useMemo(()=>{
    const q=search.trim().toLowerCase();if(!q)return [];
    const allowed=(path)=>visibleMenu.some(item=>item.path===path);
    const routes=routeIndex.filter(([a,b,path])=>allowed(path)&&`${a} ${b}`.toLowerCase().includes(q)).map(([title,meta,path])=>({type:"Bo‘lim",title,meta,path}));
    const products=allowed("/products")?inventory.filter(p=>`${p.name} ${p.sku||""} ${p.barcode||""} ${p.brand||""}`.toLowerCase().includes(q)).slice(0,5).map(p=>({type:"Mahsulot",title:p.name,meta:`${p.sku||"SKU yo‘q"} · ${p.quantity} ${p.unit||"dona"}`,path:"/products"})):[];
    const supplierResults=allowed("/suppliers")?suppliers.filter(s=>`${s.name} ${s.phone||""} ${s.contact||""}`.toLowerCase().includes(q)).slice(0,3).map(s=>({type:"Ta’minotchi",title:s.name,meta:s.phone||s.contact||"Aloqa yo‘q",path:"/suppliers"})):[];
    const invoices=allowed("/suppliers")?suppliers.flatMap(supplier=>(supplier.purchaseHistory||[]).map(row=>({supplier,row}))).filter(({supplier,row})=>`${row.invoiceNo||""} ${supplier.name} ${(row.items||[]).map(item=>item.name||item.productName||"").join(" ")}`.toLowerCase().includes(q)).slice(0,3).map(({supplier,row})=>({type:"Nakladnoy",title:row.invoiceNo||"Raqamsiz nakladnoy",meta:`${supplier.name} · ${row.date||row.dateISO||""}`,path:"/suppliers"})):[];
    const allSales=[...(dailySales||[]),...(salesHistory||[]).flatMap(day=>day.sales||[])];
    const sales=allowed("/history")?allSales.filter(sale=>`${sale.id||""} ${sale.customer||""} ${sale.sellerName||sale.seller||""} ${(sale.items||[]).map(item=>item.name||"").join(" ")}`.toLowerCase().includes(q)).slice(0,4).map(sale=>({type:"Savdo",title:sale.id||"Savdo",meta:`${sale.customer||sale.sellerName||sale.seller||"Mijoz"} · ${sale.date||sale.dateISO||""}`,path:`/history?search=${encodeURIComponent(sale.id||q)}`})):[];
    const employeeResults=allowed("/settings")?(employees||[]).filter(employee=>`${employee.name||""} ${employee.phone||""} ${employee.login||""}`.toLowerCase().includes(q)).slice(0,3).map(employee=>({type:"Xodim",title:employee.name,meta:`${employee.phone||"Telefon yo‘q"} · ${ROLE_LABELS[employee.role]||employee.role||"Xodim"}`,path:"/settings?tab=Xodimlar"})):[];
    return [...routes,...products,...sales,...supplierResults,...invoices,...employeeResults].slice(0,12);
  },[search,inventory,suppliers,dailySales,salesHistory,employees,visibleMenu]);

  const quickActions=isPlatform?[{label:"To‘lovlarni tekshirish",path:"/platform",icon:FiShield}]:[
    hasPermission("moduleSales")&&{label:"Yangi savdo",path:"/sales",icon:FiShoppingCart},
    hasPermission("moduleInventory")&&hasPermission("inventoryAdjust")&&{label:"Omborga kirim",path:"/inventory?receive=1",icon:FiArchive},
    hasPermission("moduleExpenses")&&hasPermission("expensesWrite")&&{label:"Xarajat qo‘shish",path:"/expenses?new=1",icon:FiCreditCard},
    hasPermission("moduleShifts")&&{label:activeShift?"Smenani ko‘rish":"Smena ochish",path:"/shifts",icon:FiBriefcase},
  ].filter(Boolean);
  const themeIsDark=uiPreferences.theme==="dark"||(uiPreferences.theme==="system"&&window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const headerDate=formatWorkspaceDate(clock,workspaceSettings.organization);
  const headerTime=workspaceTime(clock,workspaceSettings.organization);
  const closeTransientUi=()=>{setSearchOpen(false);setSearch("");setQuickOpen(false);setToolsOpen(false);setShortcutOpen(false);setNotificationsOpen(false);setProfileOpen(false);setStoreOpen(false);setSidebarOpen(false)};
  const go=(path,options)=>guardNavigation(()=>{navigate(path,options);closeTransientUi()});

  const beginAddBranch=()=>{
    setStoreOpen(false);
    if(!canAddStore){notify({tone:"warning",title:"Ruxsat yetarli emas",message:"Filial yaratish uchun Sozlamalarni boshqarish ruxsati kerak."});return}
    if(branchNeedsBilling){go("/billing?extraStore=1");return}
    setBranchName("");setBranchError("");setBranchModal(true);
  };
  const submitBranch=()=>{
    const result=addStore({name:branchName});
    if(!result?.success){setBranchError(result?.message||"Filial yaratilmadi");return}
    setBranchModal(false);setBranchName("");setBranchError("");
  };

  const closeGuide=()=>{const params=new URLSearchParams(location.search);params.delete("guide");navigate(`${location.pathname}${params.toString()?`?${params.toString()}`:""}`,{replace:true})};

  return <div className={`layout ${sidebarOpen?"sidebar-open":""}`}>
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="pos-logo-mark"><span>Z</span></div>
        <div className="brand-copy"><strong>ZENIX POS</strong><small>SAVDO TIZIMI</small></div>
        <button className="sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Menyuni yopish"><FiX/></button>
      </div>
      <nav className="menu">{Object.entries(groupedMenu).map(([group,items])=><div className="menu-group" key={group}>{!isPlatform&&<div className="menu-group-label">{group}</div>}{items.map(item=>{const Icon=item.icon;return <NavLink key={item.path} to={item.path} end={item.path==="/"} onClick={(event)=>{event.preventDefault();go(item.path)}} className={({isActive})=>isActive?"menu-item active":"menu-item"}><span className="menu-icon"><Icon/></span><span>{item.title}</span></NavLink>})}</div>)}</nav>
      <div className="sidebar-foot"><span>{currentStore?.name||"Zenix POS"}</span><small>{ROLE_LABELS[currentUser?.appRole]}</small></div>
    </aside>
    <button className="sidebar-backdrop" aria-label="Menyuni yopish" onClick={()=>setSidebarOpen(false)}/>

    <div className="main">
      <header className="header" ref={headerRef}>
        <button className="menu-toggle" onClick={()=>setSidebarOpen(true)} aria-label="Menyuni ochish"><FiMenu/></button>
        <div className="mobile-header-context"><strong>{currentMenuItem?.title||"Zenix POS"}</strong><small>{isPlatform?"Platform boshqaruvi":currentStore?.name||"Zenix POS"}</small></div>
        <button className="global-search-trigger" type="button" onClick={()=>{setSearchOpen(true);setTimeout(()=>searchRef.current?.focus(),0)}}><FiSearch/><span>Qidirish...</span><kbd><FiCommand/> K</kbd></button>
        <div className="header-right">
          <button className="header-icon mobile-search-trigger" type="button" onClick={()=>{setSearchOpen(true);setTimeout(()=>searchRef.current?.focus(),0)}} aria-label="Qidirish"><FiSearch/></button>
          {!isOnline&&<div className="offline-status" role="status"><FiWifiOff/><span>Internet yo‘q</span></div>}
          {hasStoreSelector&&<div className="head-pop store-pop">
            <button className="header-store" onClick={()=>{setStoreOpen(v=>!v);setQuickOpen(false);setToolsOpen(false);setNotificationsOpen(false);setProfileOpen(false)}}><FiMapPin/><span><small>Filial</small><strong>{currentStore?.name}</strong></span><FiChevronDown/></button>
            {storeOpen&&<div className="head-menu store-menu"><div className="head-menu-title">Faol filiallar</div>{activeStores.map(s=><button key={s.id} onClick={()=>{setSelectedStoreId(s.id);setStoreOpen(false)}} className={s.id===currentStoreId?"active":""}><span><strong>{s.name}</strong><small>{s.id===currentStoreId?"Hozirgi filial":"Filialga o‘tish"}</small></span>{s.id===currentStoreId&&<FiCheck/>}</button>)}{canAddStore&&<><div className="store-menu-divider"/><button className="store-add-action" onClick={beginAddBranch}><FiPlus/><span><strong>Yangi filial qo‘shish</strong><small>{branchNeedsBilling?`Qo‘shimcha filial · ${new Intl.NumberFormat("uz-UZ").format(BILLING_CONFIG.extraStore.monthlyAmount)} so‘m/oy`: `${activeStores.length} / ${storeLimit} limit ishlatilgan`}</small></span></button></>}</div>}
          </div>}

          <div className="head-pop quick-pop"><button className="quick-action" onClick={()=>{setQuickOpen(v=>!v);setStoreOpen(false);setToolsOpen(false);setNotificationsOpen(false);setProfileOpen(false)}} aria-label="Tezkor amallar"><FiPlus/><span>Tezkor</span></button>{quickOpen&&<div className="head-menu quick-menu"><div className="head-menu-title">Tezkor amallar</div>{quickActions.map(a=>{const Icon=a.icon;return <button key={a.label} onClick={()=>go(a.path)}><Icon/><span>{a.label}</span></button>})}</div>}</div>

          <div className="head-pop tools-pop"><button className="header-tool" onClick={()=>{setToolsOpen(v=>!v);setShortcutOpen(false);setStoreOpen(false);setQuickOpen(false);setNotificationsOpen(false);setProfileOpen(false)}}><FiTrendingUp/><span>Kurslar</span></button>{toolsOpen&&<div className="head-menu tools-menu"><div className="tools-menu-head"><div><strong>Valyuta kursi</strong><small>{fx?.updatedAt?`CBU · yangilangan ${workspaceTime(new Date(fx.updatedAt),workspaceSettings.organization)}`:"O‘zbekiston Markaziy banki"}</small></div><button onClick={refreshFx} aria-label="Kurslarni yangilash"><FiRefreshCw className={fxStatus==="loading"?"spin":""}/></button></div><div className="fx-list">{fx?.rates?.length?fx.rates.map(rate=><div key={rate.code}><span><b>{rate.code}</b><small>1 {rate.code}</small></span><strong>{formatRate(rate.rate)} so‘m</strong><em className={rate.diff>0?"up":rate.diff<0?"down":""}>{rate.diff>0?"+":""}{formatRate(rate.diff)}</em></div>):<div className="tool-empty">{fxStatus==="loading"?"Kurslar yuklanmoqda...":fxStatus==="error"?"Kurslarni olish imkoni bo‘lmadi.":"Kurslarni yangilang."}</div>}</div></div>}</div>

          <div className="head-pop shortcut-pop"><button className="header-icon shortcut-trigger" onClick={()=>{setShortcutOpen(v=>!v);setToolsOpen(false);setStoreOpen(false);setQuickOpen(false);setNotificationsOpen(false);setProfileOpen(false)}} aria-label="Tezkor klaviatura"><FiCommand/></button>{shortcutOpen&&<div className="head-menu shortcuts-menu"><div className="head-menu-title">Tezkor klaviatura</div><div className="shortcut-row"><span>Global qidiruv</span><kbd>⌘ K</kbd></div><div className="shortcut-row"><span>POS qidiruv</span><kbd>F2</kbd></div><div className="shortcut-row"><span>To‘lov</span><kbd>F4</kbd></div><div className="shortcut-row"><span>Yopish</span><kbd>Esc</kbd></div></div>}</div>

          <div className="header-date" title={formatWorkspaceDate(clock,workspaceSettings.organization,{withTime:true})}><FiCalendar/><span>{headerDate}</span><i>·</i><strong>{headerTime}</strong></div>
          <button className="header-icon" onClick={toggleFullscreen} aria-label={isFullscreen?"To‘liq ekrandan chiqish":"To‘liq ekran"}>{isFullscreen?<FiMinimize2/>:<FiMaximize2/>}</button>
          <button className="header-icon" onClick={()=>go(`/help?from=${encodeURIComponent(location.pathname)}`)} aria-label="Yordam"><FiHelpCircle/></button>
          <button className="header-icon" onClick={()=>setUiPreferences({theme:themeIsDark?"light":"dark"})} aria-label="Mavzu">{themeIsDark?<FiSun/>:<FiMoon/>}</button>
          <div className="head-pop notification-pop"><button className="header-icon notification-btn" onClick={()=>{setNotificationsOpen(v=>!v);setStoreOpen(false);setQuickOpen(false);setToolsOpen(false);setShortcutOpen(false);setProfileOpen(false)}} aria-label="Bildirishnomalar"><FiBell/>{unreadNotifications.length>0&&<b>{unreadNotifications.length}</b>}</button>{notificationsOpen&&<div className="head-menu notification-panel"><div className="notification-title"><div><strong>Bildirishnomalar</strong><small>{notifications.length?`${unreadNotifications.length} ta yangi · ${notifications.length} ta signal`:"Yangi bildirishnoma yo‘q"}</small></div>{unreadNotifications.length>0&&<button className="notice-read-all" onClick={markAllNotificationsRead}>Barchasini o‘qildi</button>}</div><div className="notification-view-tabs"><button type="button" className={notificationView==="all"?"active":""} onClick={()=>setNotificationView("all")}>Barchasi <span>{notifications.length}</span></button><button type="button" className={notificationView==="unread"?"active":""} onClick={()=>setNotificationView("unread")}>Yangi <span>{unreadNotifications.length}</span></button></div>{notifications.length===0?<div className="head-empty">Hammasi joyida</div>:visibleNotifications.length===0?<div className="head-empty">Yangi bildirishnoma yo‘q</div>:visibleNotifications.map(n=>{const read=readNotifications.has(n.id);return <button key={n.id} className={`notice ${n.tone} ${read?"read":"unread"}`} onClick={()=>{markNotificationRead(n.id);go(n.path)}}><span className="notice-dot"/><span><strong>{n.title}</strong><small>{n.text}</small></span>{!read&&<i className="notice-unread"/>}</button>})}</div>}</div>
          <div className="head-pop profile-pop"><button className="profile-trigger" onClick={()=>{setProfileOpen(v=>!v);setStoreOpen(false);setQuickOpen(false);setToolsOpen(false);setNotificationsOpen(false)}} aria-label="Foydalanuvchi menyusi"><span className="avatar">{currentUser?.name?.charAt(0)||"U"}</span><span className="profile-copy"><strong>{currentUser?.name}</strong><small>{ROLE_LABELS[currentUser?.appRole]}</small></span><FiChevronDown/></button>{profileOpen&&<div className="head-menu profile-menu"><div className="profile-menu-head"><span className="avatar">{currentUser?.name?.charAt(0)||"U"}</span><div><strong>{currentUser?.name}</strong><small>{currentUser?.organizationName||"Zenix POS"}</small></div></div><button onClick={()=>go("/profile")}><FiUser/> Mening profilim</button>{canOpenSettings&&<button onClick={()=>go("/settings")}><FiSettings/> Sozlamalar</button>}<button onClick={()=>guardNavigation(logout,{title:"Hisobdan chiqasizmi?",confirmLabel:"Chiqish"})} className="danger"><FiLogOut/> Chiqish</button></div>}</div>
        </div>
      </header>
      {!isOnline&&<div className="mobile-offline-banner" role="status"><FiWifiOff/><span>Internet yo‘q · lokal rejim</span></div>}
      <main className="content"><Outlet/></main>
    </div>

    <nav className="mobile-bottom-nav" aria-label="Mobil navigatsiya">
      {mobileNavItems.map((item)=>{const Icon=item.icon;return <NavLink key={item.path} to={item.path} end={item.path==="/"} onClick={(event)=>{event.preventDefault();go(item.path)}} className={({isActive})=>isActive?"active":""}><Icon/><span>{item.title==="Boshqaruv paneli"?"Boshqaruv":item.title==="Kassa / Smena"?"Smena":item.title}</span></NavLink>})}
      <button type="button" className={mobileMoreActive||sidebarOpen?"active":""} onClick={()=>setSidebarOpen(true)}><FiMenu/><span>Yana</span></button>
    </nav>

    {searchOpen&&<div className="command-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false)}}><div className="command-palette" ref={commandRef} role="dialog" aria-modal="true" aria-label="Global qidiruv"><div className="command-input"><FiSearch/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mahsulot, bo‘lim, ta’minotchi qidiring..."/><kbd>ESC</kbd></div><div className="command-results">{!search?<><div className="command-hint">Tezkor o‘tish</div>{(isPlatform?[["Platforma administratori","Mijozlar va to‘lovlar","/platform"]]:routeIndex.filter(([, ,path])=>visibleMenu.some(item=>item.path===path)).slice(0,6)).map(([title,meta,path])=><button key={path} onClick={()=>go(path)}><span><strong>{title}</strong><small>{meta}</small></span><em>Bo‘lim</em></button>)}</>:results.length?results.map((r,i)=><button key={`${r.type}-${r.title}-${i}`} onClick={()=>go(r.path)}><span><strong>{r.title}</strong><small>{r.meta}</small></span><em>{r.type}</em></button>):<div className="command-empty">Natija topilmadi</div>}</div></div></div>}

    {guideSteps.length>0&&<aside className="zenix-guide-coach" role="dialog" aria-label="Bosqichma-bosqich yordam"><div className="guide-coach-head"><span><small>Menga ko‘rsat</small><strong>{guideStep+1} / {guideSteps.length}</strong></span><button type="button" onClick={closeGuide} aria-label="Yordamni yopish"><FiX/></button></div><p>{guideSteps[guideStep]}</p><div className="guide-coach-actions"><button type="button" className="pro-btn secondary" disabled={guideStep===0} onClick={()=>setGuideStep(step=>Math.max(0,step-1))}>Oldingi</button>{guideStep<guideSteps.length-1?<button type="button" className="pro-btn primary" onClick={()=>setGuideStep(step=>Math.min(guideSteps.length-1,step+1))}>Keyingi</button>:<button type="button" className="pro-btn primary" onClick={closeGuide}>Tayyor</button>}</div></aside>}

    <Modal open={branchModal} onClose={()=>setBranchModal(false)} title="Yangi filial" subtitle="Yangi filial alohida qoldiq, savdo va kassa ma’lumotlari bilan bo‘sh holatda yaratiladi." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setBranchModal(false)}>Bekor qilish</button><button className="pro-btn primary" onClick={submitBranch}>Filial yaratish</button></>}><label className="pro-field"><span>Filial nomi</span><input autoFocus value={branchName} onChange={event=>{setBranchName(event.target.value);setBranchError("")}} onKeyDown={event=>event.key==="Enter"&&submitBranch()} placeholder="Masalan, Sergeli filial"/></label>{branchError&&<div className="pro-alert danger branch-error">{branchError}</div>}<div className="branch-info-card"><FiMapPin/><span><strong>{activeStores.length+1}-filial</strong><small>Mahsulot qoldiqlari 0 dan boshlanadi. Boshqa filial savdolari bu filialda ko‘rinmaydi.</small></span></div></Modal>
  </div>;
}
export default MainLayout;
