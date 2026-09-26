import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiBell, FiCheck, FiChevronLeft, FiClock, FiCreditCard, FiDatabase, FiDownload, FiGrid, FiLayers, FiMapPin, FiMonitor, FiPrinter, FiRotateCcw, FiSearch, FiSettings, FiShield, FiSliders, FiSmartphone, FiUsers } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { DEFAULT_BUSINESS_FEATURES } from "../../config/uiDefaults";
import { BILLING_CONFIG } from "../../config/billing";
import { ROLE_LABELS, ROLES, legacyRoleForAppRole } from "../../config/roles";
import { createTelegramConnection, waitForTelegramConnection, disconnectTelegramGroup, updateTelegramConnectionSettings, sendTelegramTestMessage } from "../../services/telegramService";
import { PageHeader, StatusBadge, PremiumSelect, PremiumTimeInput, ColumnPicker, PremiumCheckbox } from "../../components/Ui";
import { formatUzPhone, isValidUzPhone, sameUzPhone } from "../../utils/phone";
import Modal from "../../components/Modal";
import { ExportCenter, SystemDiagnostics } from "./SettingsTools";
import { useFeedback } from "../../context/FeedbackContext";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";

const tabs=[
  ["Tashkilot",FiSettings],["Filiallar",FiMapPin],["Xodimlar",FiUsers],["Ruxsatlar",FiShield],["Chek",FiPrinter],["POS",FiCreditCard],["Ombor",FiLayers],["Ish kuni",FiClock],["Bildirishnomalar",FiBell],["Telegram",FiSmartphone],["Interfeys",FiSliders],["Funksiyalar",FiGrid],["Eksport",FiDownload],["Diagnostika",FiDatabase],["Tarix",FiClock],
];
const STORE_SCOPED_TABS=new Set(["Chek","POS","Ombor","Ish kuni","Bildirishnomalar"]);
const settingsSearchIndex=[
  ["Biznes nomi, telefon, manzil, valyuta, vaqt zonasi","Tashkilot"],["Filial nomi, filial limiti","Filiallar"],["Xodim, login, rol, parol","Xodimlar"],["Ruxsat, modul","Ruxsatlar"],["Chek, printer, chop etish, chek osti matni, logo","Chek"],["POS, to‘lov, chegirma, shtrix-kod, savat, naqd, karta, o‘tkazma","POS"],["Ombor, qoldiq, transfer, inventarizatsiya","Ombor"],["Smena, ish kuni, yopilish, vaqt","Ish kuni"],["Bildirishnoma, kam qoldiq, tarif, tasdiqlash","Bildirishnomalar"],["Telegram, bot, guruh","Telegram"],["Mavzu, asosiy rang, matn, interfeys","Interfeys"],["Biznes turi, IMEI, partiya, yaroqlilik, variant","Funksiyalar"],["Eksport, CSV, JSON, nusxa, yuklab olish","Eksport"],["Diagnostika, internet, printer, xotira, PWA, Telegram","Diagnostika"],["O‘zgarishlar, tarix, kim o‘zgartirdi","Tarix"],
];

const SwitchRow=({title,desc,checked,onChange,disabled=false})=><div className="pro-switch-row"><div><strong>{title}</strong>{desc&&<small>{desc}</small>}</div><label className="pro-switch"><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>!disabled&&onChange(e.target.checked)}/><span/></label></div>;

function Settings(){
  const {currentUser,createWorkspaceUser,updateWorkspaceUser,resetWorkspaceUserPassword}=useAuth();
  const location=useLocation();
  const {notify,confirm,undo}=useFeedback();
  const {stores,setStores,addStore:createStore,updateStore,currentStore,currentStoreId,telegramSettings,setTelegramSettings,uiPreferences,setUiPreferences,resetUiPreferences,businessFeatures,setBusinessFeatures,workspaceSettings,setWorkspaceSettings,employees,setEmployees,organizations,rolePermissions,setRolePermissions,activityLogs,addActivityLog,hasPermission,inventoryState,activeShifts,inventoryTransfers,inventoryCounts}=useStore();
  const canWrite=hasPermission("settingsWrite",currentUser?.appRole);
  const canManagePermissions=currentUser?.appRole===ROLES.OWNER;
  const [tab,setTab]=useState(()=>{const requested=new URLSearchParams(location.search).get("tab");return tabs.some(([name])=>name===requested)?requested:"Tashkilot"}); const [mobileSectionOpen,setMobileSectionOpen]=useState(false); const [testSent,setTestSent]=useState(false); const [telegramBusy,setTelegramBusy]=useState(false); const [advancedUi,setAdvancedUi]=useState(false);
  const [settingsQuery,setSettingsQuery]=useState("");const [scope,setScope]=useState("global");const [saveState,setSaveState]=useState("saved");
  const saveTimer=useRef(null);const auditTimers=useRef(new Map());const storeNameBaselines=useRef(new Map());
  const [employeeModal,setEmployeeModal]=useState(false);const [employeeBusy,setEmployeeBusy]=useState(false);const [employeeError,setEmployeeError]=useState("");
  const [permissionEmployee,setPermissionEmployee]=useState(null);
  const [mobilePermissionRole,setMobilePermissionRole]=useState(ROLES.MANAGER);
  const [passwordEmployee,setPasswordEmployee]=useState(null);const [passwordValue,setPasswordValue]=useState("");const [passwordError,setPasswordError]=useState("");const [passwordBusy,setPasswordBusy]=useState(false);
  const [employeeForm,setEmployeeForm]=useState({name:"",phone:"+998",login:"",password:"",role:ROLES.CASHIER,storeId:""});
  const [employeeSearch,setEmployeeSearch]=useState("");
  const [employeeStatus,setEmployeeStatus]=useState("all");
  const [selectedEmployeeIds,setSelectedEmployeeIds]=useState([]);
  const employeeColumnDefs=[
    {id:"phone",label:"Telefon"},{id:"login",label:"Kirish nomi"},{id:"role",label:"Rol"},{id:"store",label:"Filial"},{id:"status",label:"Holat"},{id:"account",label:"Hisob"},{id:"permissions",label:"Shaxsiy ruxsat"},
  ];
  const {visible:employeeColumns,toggle:toggleEmployeeColumn,show:showEmployeeColumn}=usePersistentColumns("zenix_settings_employee_columns",employeeColumnDefs);
  useEffect(()=>{const requested=new URLSearchParams(location.search).get("tab");if(requested&&tabs.some(([name])=>name===requested)){setTab(requested);setMobileSectionOpen(true)}},[location.search]);
  const employeeFormInitial=useRef(null);
  const employeeFormDirty=!!employeeModal&&!!employeeFormInitial.current&&JSON.stringify(employeeForm)!==JSON.stringify(employeeFormInitial.current);
  const guardEmployeeClose=useUnsavedGuard(employeeFormDirty,"Yangi xodim uchun kiritilgan ma’lumotlar hali saqlanmagan. Chiqsangiz, ular yo‘qoladi.");
  const closeEmployeeModal=()=>{if(employeeBusy)return;guardEmployeeClose(()=>{setEmployeeModal(false);setEmployeeError("");employeeFormInitial.current=null})};
  const scopedSection=(section)=>scope==="store"&&STORE_SCOPED_TABS.has(tab)?{...(workspaceSettings[section]||{}),...(workspaceSettings.storeOverrides?.[currentStoreId]?.[section]||{})}:(workspaceSettings[section]||{});
  const org=workspaceSettings.organization; const pos=scopedSection("pos"); const receipt=scopedSection("receipt"); const inv=scopedSection("inventory"); const businessDay=scopedSection("businessDay"); const notificationSettings=scopedSection("notifications");
  const markSaving=()=>{setSaveState("saving");if(saveTimer.current)clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>setSaveState("saved"),550)};
  const queueSettingsAudit=(section,key,before,value)=>{
    const auditKey=`${scope}:${currentStoreId}:${section}:${key}`;const previous=auditTimers.current.get(auditKey);if(previous)clearTimeout(previous);
    const timer=setTimeout(()=>{addActivityLog({type:"settings",title:"Sozlama o‘zgartirildi",description:`${section}.${key}${scope==="store"?` · ${currentStore?.name||"Filial"}`:" · Barcha filiallar"}`,before:String(before??"—"),after:String(value??"—"),changes:{field:`${section}.${key}`,before,after:value}});auditTimers.current.delete(auditKey)},700);
    auditTimers.current.set(auditKey,timer);
  };
  const updateSection=(section,key,value)=>{
    if(!canWrite)return;const before=scopedSection(section)?.[key];markSaving();
    setWorkspaceSettings(prev=>{
      if(scope==="store"&&STORE_SCOPED_TABS.has(tab)){const storeOverrides=prev.storeOverrides||{};const currentOverride=storeOverrides[currentStoreId]||{};return{...prev,storeOverrides:{...storeOverrides,[currentStoreId]:{...currentOverride,[section]:{...(currentOverride[section]||{}),[key]:value}}}}}
      return{...prev,[section]:{...(prev[section]||{}),[key]:value}};
    });
    queueSettingsAudit(section,key,before,value);
  };
  const clearCurrentStoreOverrides=()=>{if(!canWrite||scope!=="store")return;const sectionByTab={Chek:"receipt",POS:"pos",Ombor:"inventory","Ish kuni":"businessDay",Bildirishnomalar:"notifications"};const section=sectionByTab[tab];if(!section)return;markSaving();setWorkspaceSettings(prev=>{const all={...(prev.storeOverrides||{})};const row={...(all[currentStoreId]||{})};delete row[section];if(Object.keys(row).length)all[currentStoreId]=row;else delete all[currentStoreId];return{...prev,storeOverrides:all}});addActivityLog({type:"settings",title:"Filial sozlamasi tiklandi",description:`${currentStore?.name||"Filial"} · ${tab} umumiy sozlamaga qaytarildi`})};
  const changeUi=(patch)=>{if(!canWrite)return;markSaving();setUiPreferences(patch);const keys=Object.keys(patch||{});if(keys.length)addActivityLog({type:"settings",title:"Interfeys sozlamasi o‘zgartirildi",description:keys.map(key=>`${key}: ${String(patch[key])}`).join(" · ")})};
  const changeFeatures=(patch,businessType)=>{if(!canWrite)return;markSaving();setBusinessFeatures(state=>typeof patch==="function"?patch(state):patch);addActivityLog({type:"settings",title:"Biznes funksiyalari o‘zgartirildi",description:businessType?`Biznes turi: ${businessType}`:"Funksiyalar yangilandi"});if(businessType)updateSection("organization","businessType",businessType)};
  const filteredTabs=useMemo(()=>{const q=settingsQuery.trim().toLowerCase();if(!q)return tabs;const matched=new Set(settingsSearchIndex.filter(([terms,name])=>`${terms} ${name}`.toLowerCase().includes(q)).map(([,name])=>name));return tabs.filter(([name])=>matched.has(name)||name.toLowerCase().includes(q))},[settingsQuery]);
  const recentSettingLogs=(activityLogs||[]).filter(item=>item.type==="settings").slice(0,40);
  const activeStores=stores.filter(s=>s.active!==false);
  const filteredEmployees=useMemo(()=>{
    const query=employeeSearch.trim().toLowerCase();
    return employees.filter((emp)=>{
      const matchesStatus=employeeStatus==="all"||(employeeStatus==="active"?emp.active!==false:emp.active===false);
      if(!matchesStatus)return false;
      if(!query)return true;
      const storeName=stores.find((store)=>store.id===emp.storeId)?.name||"";
      return `${emp.name||""} ${emp.phone||""} ${emp.login||""} ${ROLE_LABELS[emp.role]||emp.role||""} ${storeName}`.toLowerCase().includes(query);
    });
  },[employees,employeeSearch,employeeStatus,stores]);
  const protectedEmployee=(emp)=>emp.role===ROLES.OWNER||emp.accountId===currentUser?.id||String(emp.login||"").toLowerCase()===String(currentUser?.username||"").toLowerCase();
  const selectableEmployees=filteredEmployees.filter((emp)=>!protectedEmployee(emp));
  const selectedEmployees=employees.filter((emp)=>selectedEmployeeIds.includes(emp.id)&&!protectedEmployee(emp));
  const allFilteredEmployeesSelected=selectableEmployees.length>0&&selectableEmployees.every((emp)=>selectedEmployeeIds.includes(emp.id));
  const toggleEmployeeSelection=(id,checked)=>setSelectedEmployeeIds((ids)=>checked?[...new Set([...ids,id])]:ids.filter((item)=>item!==id));
  const toggleAllEmployees=()=>setSelectedEmployeeIds((ids)=>allFilteredEmployeesSelected?ids.filter((id)=>!selectableEmployees.some((emp)=>emp.id===id)):[...new Set([...ids,...selectableEmployees.map((emp)=>emp.id)])]);
  const currentOrg=organizations.find(o=>o.id===currentUser?.organizationId);
  const telegramConnections=telegramSettings.connections||{};
  const legacyTelegram=!Object.keys(telegramConnections).length&&(telegramSettings.connected||telegramSettings.connectionCode)?telegramSettings:null;
  const currentTelegram=telegramConnections[currentStoreId]||legacyTelegram||{connected:false,connectionCode:"",groupName:"",chatId:""};
  const updateTelegramConnection=(updater)=>setTelegramSettings(state=>{
    const previous=(state.connections||{})[currentStoreId]||(!Object.keys(state.connections||{}).length&&(state.connected||state.connectionCode)?state:{});
    const next=typeof updater==="function"?updater(previous):{...previous,...updater};
    return{...state,connections:{...(state.connections||{}),[currentStoreId]:next}};
  });
  const includedStoreCount=currentOrg?.includedStores||BILLING_CONFIG.annual.includedStores;
  const storeLimit=Math.max(includedStoreCount,Number(currentOrg?.storeLimit||includedStoreCount));
  const addStore=async()=>{if(!canWrite||activeStores.length>=storeLimit)return;let index=stores.length+1;let name=`Yangi filial ${index}`;while(stores.some(store=>String(store.name||"").trim().toLowerCase()===name.toLowerCase())){index+=1;name=`Yangi filial ${index}`}const result=await createStore({name});if(!result?.success){notify({tone:"danger",title:"Filial qo‘shilmadi",message:result?.message||"Server xatosi"});return}addActivityLog({type:"settings",title:"Filial qo‘shildi",description:result.store.name,storeId:result.store.id,storeName:result.store.name,changes:[{field:"active",label:"Holat",before:"—",after:"Faol"}]})};
  const storeArchiveBlocker=(id)=>{
    if(activeShifts?.[id])return "Bu filialda ochiq smena bor. Avval smenani yoping.";
    const stocked=(inventoryState||[]).find((product)=>Number(product.stockByStore?.[id]||0)>0);
    if(stocked)return `${stocked.name||"Mahsulot"} va boshqa qoldiqlar mavjud. Avval qoldiqni ko‘chiring yoki nolga tushiring.`;
    const branchRoles=new Set([ROLES.CASHIER,ROLES.SALES,ROLES.WAREHOUSE]);
    const assigned=(employees||[]).find((employee)=>employee.active!==false&&employee.storeId===id&&branchRoles.has(employee.role));
    if(assigned)return `${assigned.name||"Xodim"} shu filialga biriktirilgan. Avval boshqa faol filialga o‘tkazing.`;
    const openTransfer=(inventoryTransfers||[]).find((transfer)=>["PENDING","Draft","IN_TRANSIT","In Transit"].includes(transfer.status)&&(transfer.fromStoreId===id||transfer.toStoreId===id));
    if(openTransfer)return `${openTransfer.id||"Transfer"} yakunlanmagan. Avval transferni yakunlang yoki bekor qiling.`;
    const openCount=(inventoryCounts||[]).find((count)=>count.storeId===id&&["PENDING","CONFLICT"].includes(count.status));
    if(openCount)return `${openCount.id||"Inventarizatsiya"} yakunlanmagan. Avval inventarizatsiyani yoping.`;
    return "";
  };
  const toggleStore=async(id)=>{if(!canWrite)return;const target=stores.find(x=>x.id===id);if(!target)return;const activeCount=stores.filter(x=>x.active!==false).length;if(target.active!==false&&activeCount<=1)return;if(target.active===false&&activeCount>=storeLimit)return;const nextActive=target.active===false;if(!nextActive){const blocker=storeArchiveBlocker(id);if(blocker){notify({tone:"warning",title:"Filialni hozir arxivlab bo‘lmaydi",message:blocker});return}}const result=await updateStore(id,{active:nextActive});if(!result.success){notify({tone:"danger",title:"Filial yangilanmadi",message:result.message});return}addActivityLog({type:"settings",title:nextActive?"Filial tiklandi":"Filial arxivlandi",description:target.name,storeId:id,storeName:target.name,before:target.active!==false?"Faol":"Arxivda",after:nextActive?"Faol":"Arxivda",changes:[{field:"active",label:"Holat",before:target.active!==false?"Faol":"Arxivda",after:nextActive?"Faol":"Arxivda"}]})};
  const finishStoreRename=async(store)=>{const before=storeNameBaselines.current.get(store.id);storeNameBaselines.current.delete(store.id);const after=String(store.name||"").trim();if(before===undefined||String(before).trim()===after)return;const result=await updateStore(store.id,{name:after});if(!result.success){setStores(items=>items.map(x=>x.id===store.id?{...x,name:before}:x));notify({tone:"danger",title:"Filial nomi saqlanmadi",message:result.message});return}addActivityLog({type:"settings",title:"Filial nomi o‘zgartirildi",description:after||before,storeId:store.id,storeName:after||before,before:String(before||"—"),after:after||"—",changes:[{field:"name",label:"Filial nomi",before,after}]})};
  const addEmployee=()=>{if(!canWrite)return;const draft={name:"",phone:"+998",login:"",password:"",role:ROLES.CASHIER,storeId:activeStores[0]?.id||""};employeeFormInitial.current=draft;setEmployeeError("");setEmployeeForm(draft);setEmployeeModal(true)};
  const createEmployee=async()=>{
    if(!canWrite||employeeBusy)return;
    const name=employeeForm.name.trim(),login=employeeForm.login.trim(),phone=formatUzPhone(employeeForm.phone);
    if(name.length<2||login.length<3||employeeForm.password.length<8||!employeeForm.storeId||!isValidUzPhone(phone)){setEmployeeError("Ism, telefon, filial, kamida 3 belgili login va 8 belgili vaqtinchalik parol kiriting.");return}
    if(employees.some((item)=>item.active!==false&&sameUzPhone(item.phone,phone))){setEmployeeError("Bu telefon raqami boshqa faol xodimda ishlatilgan.");return}
    if(employeeForm.role===ROLES.OWNER&&currentUser?.appRole!==ROLES.OWNER){setEmployeeError("Egasi rolini faqat Egasi bera oladi.");return}
    setEmployeeBusy(true);setEmployeeError("");
    const result=await createWorkspaceUser({name,phone,username:login,password:employeeForm.password,appRole:employeeForm.role,storeId:employeeForm.storeId});
    if(!result.success){setEmployeeBusy(false);setEmployeeError(result.message||"Xodimning kirish hisobini yaratib bo‘lmadi");return}
    setEmployees(items=>[...items,{id:result.user?.id,accountId:result.user?.id,name,phone,login:result.user?.username||login,role:employeeForm.role,storeId:employeeForm.storeId,active:true}]);
    employeeFormInitial.current=null;setEmployeeBusy(false);setEmployeeModal(false);
  };
  const updateEmployeeField=async(emp,key,value)=>{
    if(!canWrite)return;
    const ownerRow=emp.role===ROLES.OWNER;
    if(ownerRow&&(key==="active"||key==="role")){
      notify({tone:"warning",title:"Asosiy egasi himoyalangan",message:"Asosiy egasining roli yoki faol holatini bu yerdan o‘zgartirib bo‘lmaydi."});
      return;
    }
    if(key==="role"&&value===ROLES.OWNER){
      notify({tone:"warning",title:"Egasi roli himoyalangan",message:"Yangi asosiy egani oddiy rol o‘zgarishi orqali tayinlab bo‘lmaydi."});
      return;
    }
    let normalizedValue=value;
    if(key==="phone"){
      normalizedValue=formatUzPhone(value);
      if(!isValidUzPhone(normalizedValue)){
        // Mask bo‘yicha yozish davomida local qiymatni ko‘rsatamiz, accountga faqat to‘liq raqam yoziladi.
        setEmployees(items=>items.map(item=>item.id===emp.id?{...item,phone:normalizedValue}:item));
        return;
      }
      const duplicate=employees.some(item=>item.id!==emp.id&&item.active!==false&&sameUzPhone(item.phone,normalizedValue));
      if(duplicate){notify({tone:"danger",title:"Telefon band",message:"Bu telefon raqami boshqa faol xodimda ishlatilgan."});return}
    }
    const nextOverrides=key==="role"?{}:(emp.permissionOverrides||{});
    if(emp.accountId||emp.login){
      const result=await updateWorkspaceUser(emp.id,{...(key==="name"?{name:normalizedValue}:{}),...(key==="phone"?{phone:normalizedValue}:{}),...(key==="role"?{appRole:normalizedValue,role:legacyRoleForAppRole(normalizedValue),permissionOverrides:nextOverrides}:{}),...(key==="storeId"?{storeId:normalizedValue}:{}),...(key==="active"?{active:normalizedValue}:{})});
      if(!result.success){notify({tone:"danger",title:"Xodim yangilanmadi",message:result.message||"Kirish hisobini yangilab bo‘lmadi."});return}
    }
    setEmployees(items=>items.map(item=>item.id===emp.id?{...item,[key]:normalizedValue,...(key==="role"?{permissionOverrides:{}}:{})}:item));
  };
  const applyEmployeeActiveBulk=async(targets,nextActive)=>{
    const successful=[];
    for(const emp of targets){
      if(protectedEmployee(emp))continue;
      if(emp.accountId||emp.login){
        const result=await updateWorkspaceUser(emp.id,{active:nextActive});
        if(!result?.success)continue;
      }
      successful.push(emp.id);
    }
    if(successful.length){
      const ids=new Set(successful);
      setEmployees((items)=>items.map((item)=>ids.has(item.id)?{...item,active:nextActive}:item));
    }
    return successful;
  };
  const bulkEmployeeActive=async(nextActive)=>{
    if(!canWrite||!selectedEmployees.length)return;
    const targets=[...selectedEmployees];
    const accepted=await confirm({
      title:nextActive?"Tanlangan xodimlarni faollashtirasizmi?":"Tanlangan xodimlarni o‘chirasizmi?",
      message:`${targets.length} ta xodimning kirish holati ${nextActive?"faollashadi":"o‘chiriladi"}. Asosiy egasi va joriy hisob bu amalga kirmaydi.`,
      confirmLabel:nextActive?"Faollashtirish":"O‘chirish",cancelLabel:"Bekor qilish",tone:nextActive?"primary":"danger",
    });
    if(!accepted)return;
    const before=targets.map((emp)=>({id:emp.id,active:emp.active!==false}));
    const changed=await applyEmployeeActiveBulk(targets,nextActive);
    if(!changed.length){notify({tone:"warning",title:"Xodimlar yangilanmadi",message:"Tanlangan hisoblarni yangilab bo‘lmadi."});return}
    setSelectedEmployeeIds((ids)=>ids.filter((id)=>!changed.includes(id)));
    addActivityLog({type:"settings",title:nextActive?"Xodimlar faollashtirildi":"Xodimlar o‘chirildi",description:`${changed.length} ta xodim`});
    undo({title:nextActive?"Xodimlar faollashtirildi":"Xodimlar o‘chirildi",message:`${changed.length} ta xodim`,onUndo:async()=>{
      const restore=targets.filter((emp)=>changed.includes(emp.id));
      for(const emp of restore){
        const old=before.find((item)=>item.id===emp.id);
        if(old)await applyEmployeeActiveBulk([emp],old.active);
      }
    }});
  };
  const resetEmployeePassword=(emp)=>{setPasswordEmployee(emp);setPasswordValue("");setPasswordError("")};
  const saveEmployeePassword=async()=>{
    if(!passwordEmployee||passwordBusy)return;
    if(passwordValue.length<8){setPasswordError("Parol kamida 8 ta belgidan iborat bo‘lsin");return}
    setPasswordBusy(true);setPasswordError("");
    const result=await resetWorkspaceUserPassword(passwordEmployee.id,passwordValue);
    setPasswordBusy(false);
    if(!result.success){setPasswordError(result.message||"Parolni yangilab bo‘lmadi");return}
    setPasswordEmployee(null);setPasswordValue("");
  };
  const employeePermissionValue=(emp,permission)=>{
    if(emp?.role===ROLES.OWNER)return true;
    if(emp?.permissionOverrides&&Object.prototype.hasOwnProperty.call(emp.permissionOverrides,permission))return Boolean(emp.permissionOverrides[permission]);
    return Boolean(rolePermissions?.[emp?.role]?.[permission]);
  };
  const setEmployeePermission=async(emp,permission,value)=>{
    if(!canManagePermissions||!emp?.accountId||emp.role===ROLES.OWNER)return;
    const defaults=Boolean(rolePermissions?.[emp.role]?.[permission]);
    const overrides={...(emp.permissionOverrides||{})};
    if(Boolean(value)===defaults)delete overrides[permission];else overrides[permission]=Boolean(value);
    setEmployees(items=>items.map(item=>item.id===emp.id?{...item,permissionOverrides:overrides}:item));
    await updateWorkspaceUser(emp.id,{permissionOverrides:overrides});
  };
  const resetEmployeePermissions=async(emp)=>{
    if(!canManagePermissions||!emp?.accountId||emp.role===ROLES.OWNER)return;
    setEmployees(items=>items.map(item=>item.id===emp.id?{...item,permissionOverrides:{}}:item));
    await updateWorkspaceUser(emp.id,{permissionOverrides:{}});
  };
  const startTelegramConnect=async()=>{
    if(!canWrite||telegramBusy)return;
    // Desktop browsers can block window.open after an awaited network request.
    // Open a neutral tab synchronously from the user gesture, then navigate it
    // after the one-time link is created. On mobile, same-tab navigation opens
    // Telegram more reliably and the connection is re-hydrated when the user returns.
    const isMobile=typeof window!=="undefined"&&window.matchMedia?.("(max-width: 760px)").matches;
    const telegramWindow=!isMobile&&typeof window!=="undefined"?window.open("about:blank","_blank"):null;
    if(telegramWindow)telegramWindow.opener=null;
    setTelegramBusy(true);
    try{
      const result=await createTelegramConnection({storeId:currentStoreId});
      updateTelegramConnection(prev=>({...prev,connected:false,connectionId:"",groupName:"",chatId:"",deepLink:result.deepLink,botUsername:result.botUsername,connecting:true}));
      if(telegramWindow&&!telegramWindow.closed)telegramWindow.location.replace(result.deepLink);
      else if(typeof window!=="undefined")window.location.assign(result.deepLink);
      addActivityLog({type:"settings",title:"Telegram ulash boshlandi",description:`${currentStore?.name||"Filial"} uchun Telegram guruh tanlash oynasi ochildi`});
      if(isMobile)return;
      const linked=await waitForTelegramConnection({storeId:currentStoreId});
      updateTelegramConnection(prev=>({...prev,...linked,connecting:false,deepLink:linked.connected?"":result.deepLink}));
      if(linked.connected){
        addActivityLog({type:"settings",title:"Telegram guruhi ulandi",description:`${currentStore?.name||"Filial"} · ${linked.groupName||"Telegram guruhi"}`});
        notify({tone:"success",title:"Telegram ulandi",message:`${linked.groupName||"Telegram guruhi"} muvaffaqiyatli bog‘landi.`});
      }else notify({tone:"info",title:"Ulanish kutilmoqda",message:linked.message||"Telegramda guruhni tanlab botni qo‘shing."});
    }catch(error){
      if(telegramWindow&&!telegramWindow.closed)telegramWindow.close();
      notify({tone:"danger",title:"Telegram ulanmadi",message:error?.message||"Telegram ulanishini boshlash mumkin bo‘lmadi."});
    }finally{setTelegramBusy(false)}
  };
  const disconnectTelegram=async()=>{
    if(!canWrite||telegramBusy)return;
    setTelegramBusy(true);
    try{
      await disconnectTelegramGroup({connectionId:currentTelegram.connectionId});
      updateTelegramConnection(prev=>({...prev,connected:false,connectionId:"",groupName:"",chatId:"",deepLink:"",connecting:false,connectedAt:""}));
      addActivityLog({type:"settings",title:"Telegram uzildi",description:`${currentStore?.name||"Filial"} Telegram guruhidan uzildi`});
    }catch(error){notify({tone:"danger",title:"Telegramni uzib bo‘lmadi",message:error?.message||"Qayta urinib ko‘ring."})}
    finally{setTelegramBusy(false)}
  };
  const changeTelegramSetting=async(key,value)=>{
    if(!canWrite||!currentTelegram.connected||telegramBusy)return;
    const nextSettings={...(currentTelegram.settings||{}),[key]:Boolean(value)};
    updateTelegramConnection(prev=>({...prev,settings:nextSettings}));
    try{
      await updateTelegramConnectionSettings({connectionId:currentTelegram.connectionId,settings:nextSettings});
    }catch(error){
      updateTelegramConnection(prev=>({...prev,settings:{...(prev.settings||{}),[key]:!Boolean(value)}}));
      notify({tone:"danger",title:"Telegram sozlamasi saqlanmadi",message:error?.message||"Qayta urinib ko‘ring."});
    }
  };
  const testTelegram=async()=>{
    if(!currentTelegram.connected||telegramBusy)return;
    setTelegramBusy(true);
    try{
      await sendTelegramTestMessage({connectionId:currentTelegram.connectionId});
      setTestSent(true);setTimeout(()=>setTestSent(false),1400);
      notify({tone:"success",title:"Test xabar yuborildi",message:currentTelegram.groupName||"Telegram guruhi"});
    }catch(error){notify({tone:"danger",title:"Test xabar yuborilmadi",message:error?.message||"Qayta urinib ko‘ring."})}
    finally{setTelegramBusy(false)}
  };
  const settingLabels={sale:"Savdo",dailyReport:"Kunlik hisobot",shiftClose:"Smena ochilishi / yopilishi",returns:"Qaytarish",expenses:"Xarajatlar",transfers:"Transferlar",inventoryReceived:"Omborga kirim",lowStock:"Kam qoldiq",outOfStock:"Tugagan mahsulot",supplierDebt:"Ta’minotchi qarzi"};
  const modulePermissionDefs=[
    ["moduleDashboard","Boshqaruv paneli"],["moduleShifts","Kassa / Smena"],["moduleSales","Savdo / POS"],["moduleHistory","Savdo tarixi"],
    ["moduleProducts","Mahsulotlar"],["moduleInventory","Ombor"],["moduleSuppliers","Ta’minotchilar"],["moduleExpenses","Xarajatlar"],
    ["moduleAnalytics","Analitika"],["moduleSellerAnalytics","Sotuvchi tahlili"],["moduleActivityLog","Amallar tarixi"],["moduleSettings","Sozlamalar"],["moduleBilling","Tarif va to‘lovlar"],
  ];
  const actionPermissionDefs=[
    ["productWrite","Mahsulot yaratish / tahrirlash"],["inventoryAdjust","Ombor qoldig‘ini o‘zgartirish"],["transferView","Transferlarni ko‘rish"],["transferCreate","Transfer yaratish"],["transferApprove","Transferni jo‘natish / tasdiqlash"],["transferReceive","Transferni qabul qilish"],["transferCancel","Transferni bekor qilish"],["supplierWrite","Ta’minotchini boshqarish"],["returns","Qaytarish"],["expensesWrite","Xarajat qo‘shish"],["analytics","Analitika amallari"],["shiftRecon","Smena hisob-kitobi"],["inventoryCountApprove","Inventarizatsiyani tasdiqlash"],["closeBusinessDay","Savdo kunini yopish"],["dataExport","Ma’lumot eksport qilish"],["settingsWrite","Sozlamalarni o‘zgartirish"],["billingWrite","Tarif va to‘lovlarni boshqarish"],
  ];
  const permissionRoles=[ROLES.OWNER,ROLES.ADMIN,ROLES.MANAGER,ROLES.CASHIER,ROLES.SALES,ROLES.WAREHOUSE];
  const togglePermission=(permission,role)=>{if(!canManagePermissions||role===ROLES.OWNER)return;markSaving();setRolePermissions(prev=>({...prev,[role]:{...(prev[role]||{}),[permission]:!prev?.[role]?.[permission]}}));addActivityLog({type:"settings",title:"Rol ruxsati o‘zgartirildi",description:`${role} · ${permission}`})};
  const paymentLabels={cash:"Naqd",card:"Karta",transfer:"O‘tkazma",split:"Aralash"};
  const paymentMethods={cash:true,card:true,transfer:true,split:true,...(pos.paymentMethods||{})};
  const togglePaymentMethod=(key,value)=>{
    const active=Object.values(paymentMethods).filter(Boolean).length;if(!value&&active<=1)return;
    const next={...paymentMethods,[key]:value};updateSection("pos","paymentMethods",next);
    if(!next[pos.defaultPayment]){const fallback=Object.keys(next).find(item=>next[item]);if(fallback)updateSection("pos","defaultPayment",fallback)}
  };
  const applyPreset=(type)=>{
    const presets={
      clothing:{...DEFAULT_BUSINESS_FEATURES,sizeColor:true,variants:true,batchExpiry:false,serialImei:false,weightVolume:false},
      grocery:{...DEFAULT_BUSINESS_FEATURES,batchExpiry:true,weightVolume:true,serialImei:false,warranty:false},
      electronics:{...DEFAULT_BUSINESS_FEATURES,serialImei:true,warranty:true,variants:false,batchExpiry:false},
      cosmetics:{...DEFAULT_BUSINESS_FEATURES,variants:true,batchExpiry:true,serialImei:false,warranty:false},
      universal:{...DEFAULT_BUSINESS_FEATURES},
    };
    changeFeatures(presets[type]||presets.universal,type);
    addActivityLog({type:"settings",title:"Biznes turi tanlandi",description:type});
  };
  const printReceiptTest=()=>{
    const popup=window.open("","_blank","width=420,height=640");if(!popup)return;
    const business=String(org.businessName||"Zenix POS").replace(/[<>]/g,"");const footer=String(receipt.footer||"").replace(/[<>]/g,"");
    const copies=Math.max(1,Math.min(3,Number(receipt.copies||1)));
    const one=`<section class="receipt-copy"><h2>${business}</h2><p>Sinov cheki</p><div class="row"><span>Mahsulot</span><b>120 000 so‘m</b></div><div class="row"><span>Mahsulot 2</span><b>85 000 so‘m</b></div><div class="row total"><span>Jami</span><b>205 000 so‘m</b></div>${receipt.showCashier?'<p>Kassir: Aziz Karimov</p>':''}<p class="foot">${footer}</p></section>`;
    popup.document.write(`<!doctype html><html><head><title>Chek testi</title><style>body{font-family:Arial,sans-serif;width:${receipt.width||80}mm;margin:12px auto;color:#111}.receipt-copy{padding:0 0 8mm}.receipt-copy:not(:last-child){border-bottom:1px dashed #bbb;margin-bottom:8mm;page-break-after:always}h2,p{text-align:center}.row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed #bbb}.total{font-size:20px;font-weight:700;margin-top:12px}.foot{margin-top:18px;font-size:12px}@page{margin:0}</style></head><body>${Array.from({length:copies},()=>one).join("")}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}<\/script></body></html>`);popup.document.close();
  };
  return <div className="pro-page settings-pro"><PageHeader title="Sozlamalar" subtitle="Tashkilot, xodimlar, POS, ombor va platforma qoidalarini boshqaring." actions={<><span className={`settings-autosave ${saveState}`}><FiCheck/> {saveState==="saving"?"Saqlanmoqda...":"Saqlandi"}</span><Link className="pro-btn secondary" to="/billing"><FiCreditCard/> Tarif va to‘lovlar</Link></>}/>
    <div className="settings-controlbar"><div className="settings-search"><FiSearch/><input value={settingsQuery} onChange={e=>setSettingsQuery(e.target.value)} placeholder="Sozlamani qidiring..."/>{settingsQuery&&<button type="button" onClick={()=>setSettingsQuery("")}>×</button>}</div>{STORE_SCOPED_TABS.has(tab)&&<div className="settings-scope"><button className={scope==="global"?"active":""} onClick={()=>setScope("global")}>Barcha filiallar</button><button className={scope==="store"?"active":""} onClick={()=>setScope("store")}>{currentStore?.name||"Joriy filial"}</button>{scope==="store"&&<button className="settings-scope-reset" onClick={clearCurrentStoreOverrides}><FiRotateCcw/> Umumiy sozlamaga qaytarish</button>}</div>}</div>
    {settingsQuery&&<div className="settings-search-results">{filteredTabs.length?filteredTabs.map(([name,Icon])=><button key={name} onClick={()=>{setTab(name);setSettingsQuery("");setMobileSectionOpen(true)}}><Icon/><span><strong>{name}</strong><small>Sozlamalar bo‘limini ochish</small></span></button>):<span>Hech narsa topilmadi</span>}</div>}
    <div className={`settings-layout ${mobileSectionOpen?"mobile-section-open":""}`}><aside className="settings-nav">{(settingsQuery?filteredTabs:tabs).map(([name,Icon])=><button key={name} className={tab===name?"active":""} onClick={()=>{setTab(name);setMobileSectionOpen(true);if(!STORE_SCOPED_TABS.has(name))setScope("global")}}><Icon/><span>{name}</span></button>)}</aside>
      <section className="pro-card settings-content"><button type="button" className="settings-mobile-back" onClick={()=>setMobileSectionOpen(false)}><FiChevronLeft/><span>Sozlamalar</span><strong>{tab}</strong></button>
        {tab==="Tashkilot"&&<><div className="pro-card-head"><div><h2>Tashkilot sozlamalari</h2><p>Chek, hisobot va platformada ishlatiladigan asosiy ma’lumotlar.</p></div></div><div className="pro-form-grid"><label className="pro-field"><span>Biznes nomi</span><input disabled={!canWrite} value={org.businessName} onChange={e=>updateSection("organization","businessName",e.target.value)}/></label><label className="pro-field"><span>Telefon</span><input disabled={!canWrite} value={org.phone} onChange={e=>updateSection("organization","phone",e.target.value)}/></label><label className="pro-field full"><span>Manzil</span><input disabled={!canWrite} value={org.address} onChange={e=>updateSection("organization","address",e.target.value)}/></label><label className="pro-field"><span>Biznes turi</span><PremiumSelect disabled={!canWrite} value={org.businessType||"universal"} onChange={e=>applyPreset(e.target.value)}><option value="universal">Universal savdo</option><option value="grocery">Oziq-ovqat</option><option value="clothing">Kiyim</option><option value="electronics">Elektronika</option><option value="cosmetics">Kosmetika</option></PremiumSelect></label><label className="pro-field"><span>Valyuta</span><PremiumSelect disabled={!canWrite} value={org.currency} onChange={e=>updateSection("organization","currency",e.target.value)}><option>UZS</option><option>USD</option><option>EUR</option></PremiumSelect></label><label className="pro-field"><span>Vaqt zonasi</span><PremiumSelect disabled={!canWrite} value={org.timezone} onChange={e=>updateSection("organization","timezone",e.target.value)}><option>Asia/Tashkent</option><option>Asia/Almaty</option><option>Europe/Moscow</option></PremiumSelect></label><label className="pro-field"><span>Sana formati</span><PremiumSelect disabled={!canWrite} value={org.dateFormat||"DD.MM.YYYY"} onChange={e=>updateSection("organization","dateFormat",e.target.value)}><option>DD.MM.YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></PremiumSelect></label><label className="pro-field"><span>Vaqt formati</span><PremiumSelect disabled={!canWrite} value={org.timeFormat||"24"} onChange={e=>updateSection("organization","timeFormat",e.target.value)}><option value="24">24 soat</option><option value="12">12 soat</option></PremiumSelect></label></div></>}
        {tab==="Filiallar"&&<><div className="pro-card-head"><div><h2>Filiallar</h2><p>Filial nomi, holati va asosiy tashkilot tuzilmasini boshqaring. Asosiy tarifga {includedStoreCount} ta filial kiradi. Joriy limit: {storeLimit} ta.</p></div>{activeStores.length<storeLimit?<button className="pro-btn primary" disabled={!canWrite} onClick={addStore}>+ Filial qo‘shish</button>:<Link className="pro-btn primary" to="/billing">+ Qo‘shimcha filial</Link>}</div><div className="settings-list">{stores.map((s,i)=><div className="settings-store-row" key={s.id}><div className="store-index">{i+1}</div><label className="pro-field"><span>Filial nomi</span><input disabled={!canWrite} value={s.name} onFocus={()=>storeNameBaselines.current.set(s.id,s.name)} onChange={e=>canWrite&&setStores(items=>items.map(x=>x.id===s.id?{...x,name:e.target.value}:x))} onBlur={()=>finishStoreRename(s)}/></label><StatusBadge tone={s.active!==false?"success":"neutral"}>{s.active!==false?"Faol":"Arxivda"}</StatusBadge><button className="pro-btn secondary" disabled={!canWrite||(s.active!==false&&activeStores.length<=1)||(s.active===false&&activeStores.length>=storeLimit)} onClick={()=>toggleStore(s.id)}>{s.active!==false?"Arxivlash":"Tiklash"}</button></div>)}</div></>}
        {tab==="Xodimlar"&&<>
          <div className="pro-card-head">
            <div><h2>Xodimlar</h2><p>Xodim, kirish hisobi, filial va rol bitta joyda boshqariladi.</p></div>
            <button className="pro-btn primary" disabled={!canWrite} onClick={addEmployee}>+ Xodim qo‘shish</button>
          </div>
          <div className="pro-toolbar employee-toolbar">
            <div className="pro-search"><FiSearch/><input value={employeeSearch} onChange={(event)=>setEmployeeSearch(event.target.value)} placeholder="Xodim, telefon, kirish nomi yoki filial..."/></div>
            <PremiumSelect value={employeeStatus} onChange={(event)=>setEmployeeStatus(event.target.value)}><option value="all">Barcha holatlar</option><option value="active">Faol</option><option value="inactive">O‘chiq</option></PremiumSelect>
            <ColumnPicker columns={employeeColumnDefs} visible={employeeColumns} onToggle={toggleEmployeeColumn}/>
            {canWrite&&selectableEmployees.length>0&&<button type="button" className="pro-btn secondary compact-action" onClick={toggleAllEmployees}>{allFilteredEmployeesSelected?"Tanlovni bekor qilish":"Ko‘rinayotganlarni tanlash"}</button>}
          </div>
          {canWrite&&selectedEmployees.length>0&&<div className="employee-bulk-bar"><span><strong>{selectedEmployees.length} ta</strong> xodim tanlandi</span><div><button type="button" className="pro-btn secondary compact-action" onClick={()=>bulkEmployeeActive(true)}>Faollashtirish</button><button type="button" className="pro-btn secondary compact-action employee-bulk-danger" onClick={()=>bulkEmployeeActive(false)}>O‘chirish</button><button type="button" className="pro-btn ghost compact-action" onClick={()=>setSelectedEmployeeIds([])}>Bekor qilish</button></div></div>}
          <div className="pro-table-wrap mobile-card-wrap settings-employees-wrap">
            <table className="pro-table mobile-card-table settings-employees-table">
              <thead><tr>{canWrite&&<th className="employee-select-column"><PremiumCheckbox checked={allFilteredEmployeesSelected} onChange={(event)=>event.target.checked!==allFilteredEmployeesSelected&&toggleAllEmployees()} aria-label="Barcha xodimlarni tanlash"/></th>}<th>Xodim</th>{showEmployeeColumn("phone")&&<th>Telefon</th>}{showEmployeeColumn("login")&&<th>Kirish nomi</th>}{showEmployeeColumn("role")&&<th>Rol</th>}{showEmployeeColumn("store")&&<th>Filial</th>}{showEmployeeColumn("status")&&<th>Holat</th>}{showEmployeeColumn("account")&&<th>Hisob</th>}{showEmployeeColumn("permissions")&&<th>Shaxsiy ruxsat</th>}</tr></thead>
              <tbody>{filteredEmployees.length?filteredEmployees.map(emp=>{
                const ownerRow=emp.role===ROLES.OWNER;
                const protectedRow=protectedEmployee(emp);
                return <tr key={emp.id}>
                  {canWrite&&<td data-label="Tanlash" className="employee-select-cell">{protectedRow?<StatusBadge tone="neutral">Himoyalangan</StatusBadge>:<PremiumCheckbox checked={selectedEmployeeIds.includes(emp.id)} onChange={(event)=>toggleEmployeeSelection(emp.id,event.target.checked)} aria-label={`${emp.name} xodimini tanlash`}/>}</td>}
                  <td data-label="Xodim"><input className="table-inline-input" disabled={!canWrite} value={emp.name} onChange={e=>updateEmployeeField(emp,"name",e.target.value)}/></td>
                  {showEmployeeColumn("phone")&&<td data-label="Telefon"><input className="table-inline-input phone-inline" inputMode="tel" disabled={!canWrite} value={emp.phone||""} onChange={e=>updateEmployeeField(emp,"phone",formatUzPhone(e.target.value))} placeholder="+998 90 123 45 67"/></td>}
                  {showEmployeeColumn("login")&&<td data-label="Kirish"><span className="employee-account-copy"><strong>{emp.login||(ownerRow?currentUser?.username:"—")}</strong><small>{emp.accountId?"Kirish faol":"Kirish hisobi yo‘q"}</small></span></td>}
                  {showEmployeeColumn("role")&&<td data-label="Rol"><PremiumSelect className="table-inline-select" disabled={!canWrite||ownerRow} value={emp.role} onChange={e=>updateEmployeeField(emp,"role",e.target.value)}><option value={ROLES.OWNER}>{ROLE_LABELS[ROLES.OWNER]}</option><option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option><option value={ROLES.MANAGER}>{ROLE_LABELS[ROLES.MANAGER]}</option><option value={ROLES.CASHIER}>{ROLE_LABELS[ROLES.CASHIER]}</option><option value={ROLES.SALES}>{ROLE_LABELS[ROLES.SALES]}</option><option value={ROLES.WAREHOUSE}>{ROLE_LABELS[ROLES.WAREHOUSE]}</option></PremiumSelect></td>}
                  {showEmployeeColumn("store")&&<td data-label="Filial"><PremiumSelect className="table-inline-select" disabled={!canWrite} value={emp.storeId||""} onChange={e=>updateEmployeeField(emp,"storeId",e.target.value)}>{stores.map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</PremiumSelect></td>}
                  {showEmployeeColumn("status")&&<td data-label="Holat"><button disabled={!canWrite||protectedRow} className={`status-toggle ${emp.active!==false?"on":""}`} onClick={()=>updateEmployeeField(emp,"active",emp.active===false)}>{emp.active!==false?"Faol":"O‘chiq"}</button></td>}
                  {showEmployeeColumn("account")&&<td data-label="Hisob">{emp.accountId?<button className="pro-btn secondary compact-action" onClick={()=>resetEmployeePassword(emp)}>Parolni yangilash</button>:<StatusBadge tone="neutral">Hisob yo‘q</StatusBadge>}</td>}
                  {showEmployeeColumn("permissions")&&<td data-label="Shaxsiy ruxsat">{emp.accountId&&emp.role!==ROLES.OWNER?<button className="pro-btn secondary compact-action" disabled={!canManagePermissions} onClick={()=>setPermissionEmployee(emp)}><FiShield/> Sozlash</button>:<span className="permission-default-label">{emp.role===ROLES.OWNER?"To‘liq":"Rol bo‘yicha"}</span>}</td>}
                </tr>
              }):<tr><td colSpan={employeeColumns.length+2}><div className="pro-empty"><FiUsers/><strong>Xodim topilmadi</strong><span>Qidiruv yoki holat filtrini o‘zgartiring.</span></div></td></tr>}</tbody>
            </table>
          </div>
        </>}
        {tab==="Ruxsatlar"&&<>
          <div className="pro-card-head"><div><h2>Rollar va ruxsatlar</h2><p>Modul ko‘rinishi va muhim amallarni bitta joydan boshqaring. Egasi ruxsatlari doim to‘liq.</p></div></div>
          <div className="permission-note"><FiShield/><span><strong>Ruxsat nazorati</strong><small>Ruxsat o‘chirilsa yon menyu, global qidiruv, tezkor tugmalar va sahifa manzili ham bloklanadi.</small></span></div>
          <div className="pro-table-wrap permission-desktop"><table className="pro-table permission-table"><thead><tr><th>Ruxsat</th>{permissionRoles.map(role=><th key={role}>{ROLE_LABELS[role]||role}</th>)}</tr></thead><tbody><tr className="permission-section-row"><td colSpan={permissionRoles.length+1}>Modullar</td></tr>{modulePermissionDefs.map(([id,label])=><tr key={id}><td><strong>{label}</strong><small>Modulni ko‘rish</small></td>{permissionRoles.map(role=><td key={role}><label className="permission-check"><input type="checkbox" checked={role===ROLES.OWNER?true:!!rolePermissions?.[role]?.[id]} disabled={!canManagePermissions||role===ROLES.OWNER} onChange={()=>togglePermission(id,role)}/><span><FiCheck/></span></label></td>)}</tr>)}<tr className="permission-section-row"><td colSpan={permissionRoles.length+1}>Amallar</td></tr>{actionPermissionDefs.map(([id,label])=><tr key={id}><td><strong>{label}</strong><small>Amal uchun ruxsat</small></td>{permissionRoles.map(role=><td key={role}><label className="permission-check"><input type="checkbox" checked={role===ROLES.OWNER?true:!!rolePermissions?.[role]?.[id]} disabled={!canManagePermissions||role===ROLES.OWNER} onChange={()=>togglePermission(id,role)}/><span><FiCheck/></span></label></td>)}</tr>)}</tbody></table></div>
          <div className="permission-mobile">
            <div className="permission-mobile-head"><span><strong>Rolni tanlang</strong><small>Telefonda ruxsatlar bitta rol bo‘yicha ko‘rsatiladi.</small></span><PremiumSelect value={mobilePermissionRole} onChange={e=>setMobilePermissionRole(e.target.value)}>{permissionRoles.map(role=><option key={role} value={role}>{ROLE_LABELS[role]||role}</option>)}</PremiumSelect></div>
            {mobilePermissionRole===ROLES.OWNER&&<div className="permission-owner-note"><FiShield/><span><strong>Egasi</strong><small>Egasi ruxsatlari doim to‘liq va o‘zgartirilmaydi.</small></span></div>}
            <section className="permission-mobile-group"><h3>Modullar</h3>{modulePermissionDefs.map(([id,label])=><SwitchRow key={id} title={label} desc="Modulni ko‘rish" checked={mobilePermissionRole===ROLES.OWNER?true:!!rolePermissions?.[mobilePermissionRole]?.[id]} disabled={!canManagePermissions||mobilePermissionRole===ROLES.OWNER} onChange={()=>togglePermission(id,mobilePermissionRole)}/>)}</section>
            <section className="permission-mobile-group"><h3>Amallar</h3>{actionPermissionDefs.map(([id,label])=><SwitchRow key={id} title={label} desc="Amal uchun ruxsat" checked={mobilePermissionRole===ROLES.OWNER?true:!!rolePermissions?.[mobilePermissionRole]?.[id]} disabled={!canManagePermissions||mobilePermissionRole===ROLES.OWNER} onChange={()=>togglePermission(id,mobilePermissionRole)}/>)}</section>
          </div>
        </>}
        {tab==="Chek"&&<><div className="pro-card-head"><div><h2>Chek va chop etish</h2><p>Chek ko‘rinishi, avtomatik chop etish va printer tekshiruvini boshqaring.</p></div><button className="pro-btn secondary" type="button" onClick={printReceiptTest}><FiPrinter/> Sinov cheki</button></div><div className="receipt-settings-layout"><div><div className="pro-form-grid"><label className="pro-field"><span>Chek eni</span><PremiumSelect disabled={!canWrite} value={receipt.width} onChange={e=>updateSection("receipt","width",e.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option></PremiumSelect></label><label className="pro-field"><span>Chop etish usuli</span><PremiumSelect disabled value={receipt.printMode||"browser"} onChange={()=>{}}><option value="browser">Brauzer printer oynasi</option></PremiumSelect><small>Fizik printer brauzerning chop etish oynasida tanlanadi.</small></label><label className="pro-field"><span>Nusxa soni</span><PremiumSelect disabled={!canWrite} value={String(receipt.copies||1)} onChange={e=>updateSection("receipt","copies",Math.max(1,Math.min(3,Number(e.target.value))))}><option value="1">1 nusxa</option><option value="2">2 nusxa</option><option value="3">3 nusxa</option></PremiumSelect></label><label className="pro-field full"><span>Chek osti matni</span><input disabled={!canWrite} value={receipt.footer} onChange={e=>updateSection("receipt","footer",e.target.value)}/></label></div><div className="settings-switch-group"><SwitchRow disabled={!canWrite} title="Logo ko‘rsatish" checked={receipt.showLogo} onChange={v=>updateSection("receipt","showLogo",v)}/><SwitchRow disabled={!canWrite} title="Kassir ismini ko‘rsatish" checked={receipt.showCashier} onChange={v=>updateSection("receipt","showCashier",v)}/><SwitchRow disabled={!canWrite} title="To‘lov tafsilotlarini ko‘rsatish" checked={receipt.showPaymentBreakdown} onChange={v=>updateSection("receipt","showPaymentBreakdown",v)}/><SwitchRow disabled={!canWrite} title="Savdodan keyin avtomatik chop etish" desc="Savdo yakunlangach brauzer printer oynasi avtomatik ochiladi." checked={!!pos.autoPrintReceipt} onChange={v=>updateSection("pos","autoPrintReceipt",v)}/></div></div><div className={`settings-receipt-preview width-${receipt.width||80}`}><span>CHEK KO‘RINISHI</span>{receipt.showLogo&&<h3>{org.businessName||"Zenix POS"}</h3>}<small>{currentStore?.name||"Asosiy filial"}</small><div className="receipt-preview-line"><span>Mahsulot</span><b>120 000 so‘m</b></div><div className="receipt-preview-line"><span>Mahsulot 2</span><b>85 000 so‘m</b></div><div className="receipt-preview-total"><span>Jami</span><strong>205 000 so‘m</strong></div>{receipt.showPaymentBreakdown&&<small>To‘lov: Naqd</small>}{receipt.showCashier&&<small>Kassir: Aziz Karimov</small>}<p>{receipt.footer}</p></div></div></>}
        {tab==="POS"&&<><div className="pro-card-head"><div><h2>POS sozlamalari</h2><p>Kassadagi to‘lov, chegirma, barcode va savdo yakunlash qoidalari.</p></div></div><div className="settings-subsection"><h3>To‘lov usullari</h3><p>Kassada faqat yoqilgan usullar ko‘rinadi. Kamida bittasi faol bo‘lishi kerak.</p><div className="settings-switch-group two-col">{Object.entries(paymentLabels).map(([key,label])=><SwitchRow key={key} disabled={!canWrite} title={label} checked={paymentMethods[key]!==false} onChange={value=>togglePaymentMethod(key,value)}/>)}</div><label className="pro-field settings-default-payment"><span>Standart to‘lov turi</span><PremiumSelect disabled={!canWrite} value={pos.defaultPayment} onChange={e=>updateSection("pos","defaultPayment",e.target.value)}>{Object.entries(paymentLabels).filter(([key])=>paymentMethods[key]!==false).map(([key,label])=><option key={key} value={key}>{label}</option>)}</PremiumSelect></label></div><div className="settings-subsection"><h3>Savdo qoidalari</h3><div className="pro-form-grid"><label className="pro-field"><span>Chegirma limiti (%)</span><input disabled={!canWrite} type="number" min="0" max="100" value={pos.discountLimit} onChange={e=>updateSection("pos","discountLimit",Math.max(0,Math.min(100,Number(e.target.value))))}/></label></div><div className="settings-switch-group"><SwitchRow disabled={!canWrite} title="Shtrix-kod skan qilinganda avtomatik qo‘shish" checked={pos.barcodeAutoAdd} onChange={v=>updateSection("pos","barcodeAutoAdd",v)}/><SwitchRow disabled={!canWrite} title="Enter bilan mahsulot qo‘shish" checked={pos.enterAddsProduct} onChange={v=>updateSection("pos","enterAddsProduct",v)}/><SwitchRow disabled={!canWrite} title="0 va manfiy qoldiqni bloklash" checked={pos.blockNegativeStock} onChange={v=>updateSection("pos","blockNegativeStock",v)}/><SwitchRow disabled={!canWrite} title="Savdoni yakunlashdan oldin tasdiqlash" desc="Jami summa va to‘lov turi yana bir marta ko‘rsatiladi." checked={!!pos.saleConfirmation} onChange={v=>updateSection("pos","saleConfirmation",v)}/><SwitchRow disabled={!canWrite} title="Kassir chegirma qo‘llashi mumkin" checked={!!pos.cashierDiscountAllowed} onChange={v=>updateSection("pos","cashierDiscountAllowed",v)}/><SwitchRow disabled={!canWrite} title="Savatni ushlab turish" checked={pos.holdCartEnabled} onChange={v=>updateSection("pos","holdCartEnabled",v)}/></div></div></>}
        {tab==="Ombor"&&<><div className="pro-card-head"><div><h2>Ombor qoidalari</h2><p>Qoldiq, transfer va inventarizatsiya xavfsizlik qoidalari.</p></div></div><div className="pro-form-grid"><label className="pro-field"><span>Standart kam qoldiq chegarasi</span><input disabled={!canWrite} type="number" min="0" value={inv.defaultLowStock} onChange={e=>updateSection("inventory","defaultLowStock",Math.max(0,Number(e.target.value)))}/></label><label className="pro-field"><span>Tannarx usuli</span><input readOnly value="O‘rtacha tannarx"/><small>Har yangi kirimda mavjud va yangi qoldiq qiymati asosida avtomatik hisoblanadi.</small></label></div><div className="settings-switch-group"><SwitchRow disabled={!canWrite} title="Manfiy qoldiqni bloklash" checked={inv.blockNegativeStock} onChange={v=>updateSection("inventory","blockNegativeStock",v)}/><SwitchRow disabled={!canWrite} title="Transferni tasdiqlash" desc="Menejer yaratgan transfer Egasi yoki Administrator tasdiqlagandan keyin ombordan chiqadi." checked={inv.transferApproval} onChange={v=>updateSection("inventory","transferApproval",v)}/><SwitchRow disabled={!canWrite} title="Inventarizatsiyani tasdiqlash" desc="Menejer sanagan qoldiq Egasi yoki Administrator tasdiqlagandan keyin qo‘llanadi." checked={inv.countApproval!==false} onChange={v=>updateSection("inventory","countApproval",v)}/></div><div className="settings-info-row"><FiLayers/><span><strong>Partiya, yaroqlilik muddati va IMEI</strong><small>Bu imkoniyatlar “Funksiyalar” bo‘limida biznes turiga qarab yoqiladi.</small></span></div></>}
        {tab==="Ish kuni"&&<><div className="pro-card-head"><div><h2>Ish kuni va smena</h2><p>Filial ish vaqti, smena davomiyligi va yopilish ogohlantirishlarini sozlang.</p></div></div><div className="pro-form-grid"><label className="pro-field"><span>Ish kuni boshlanishi</span><PremiumTimeInput disabled={!canWrite} value={businessDay.startTime||"00:00"} onChange={e=>updateSection("businessDay","startTime",e.target.value)}/></label><label className="pro-field"><span>Ish kuni yopilishi</span><PremiumTimeInput disabled={!canWrite} value={businessDay.closeTime||"23:59"} onChange={e=>updateSection("businessDay","closeTime",e.target.value)}/></label><label className="pro-field"><span>Maksimal smena davomiyligi</span><input disabled={!canWrite} type="number" min="1" max="48" value={businessDay.maxShiftHours||12} onChange={e=>updateSection("businessDay","maxShiftHours",Math.max(1,Number(e.target.value)))}/><small>Soat</small></label><label className="pro-field"><span>Yopilishdan oldin ogohlantirish</span><input disabled={!canWrite} type="number" min="0" max="240" value={businessDay.warnBeforeCloseMinutes||30} onChange={e=>updateSection("businessDay","warnBeforeCloseMinutes",Math.max(0,Number(e.target.value)))}/><small>Daqiqa</small></label></div><div className="settings-info-row"><FiClock/><span><strong>Smena nazorati</strong><small>Smena maksimal vaqtdan oshsa yoki ish kuni yopilishiga yaqinlashsa kassada ogohlantirish ko‘rinadi.</small></span></div></>}
        {tab==="Bildirishnomalar"&&<><div className="pro-card-head"><div><h2>Platforma bildirishnomalari</h2><p>Topbar bildirishnoma markazida qaysi signallar ko‘rinishini tanlang.</p></div></div><div className="settings-switch-group"><SwitchRow disabled={!canWrite} title="Kam qoldiq" desc="Mahsulot belgilangan minimumdan pastga tushganda." checked={notificationSettings.lowStock!==false} onChange={v=>updateSection("notifications","lowStock",v)}/><SwitchRow disabled={!canWrite} title="Mahsulot tugaganda" checked={notificationSettings.outOfStock!==false} onChange={v=>updateSection("notifications","outOfStock",v)}/><SwitchRow disabled={!canWrite} title="Smena signallari" desc="Smena ochilmagan yoki uzoq vaqt yopilmagan holatlar." checked={notificationSettings.shift!==false} onChange={v=>updateSection("notifications","shift",v)}/><SwitchRow disabled={!canWrite} title="Tasdiqlashlar" desc="Transfer va inventarizatsiya tasdiq kutganda." checked={notificationSettings.approvals!==false} onChange={v=>updateSection("notifications","approvals",v)}/><SwitchRow disabled={!canWrite} title="Tarif va to‘lovlar" desc="Tarif muddati va to‘lov tekshiruvi haqida." checked={notificationSettings.billing!==false} onChange={v=>updateSection("notifications","billing",v)}/><SwitchRow disabled={!canWrite} title="Ta’minotchi qarzi" desc="Qarz muddati yaqinlashganda yoki o‘tganda." checked={notificationSettings.supplierDebt!==false} onChange={v=>updateSection("notifications","supplierDebt",v)}/></div></>}
        {tab==="Telegram"&&<><div className="pro-card-head"><div><h2>Telegram bildirishnomalari</h2><p>@zenixposbot ni ishchi guruhingizga ulang. Guruh tanlash Telegram ichida ochiladi va ulanish avtomatik tasdiqlanadi.</p><small className="settings-context-note">Joriy filial: {currentStore?.name||"Filial"}</small></div><StatusBadge tone={currentTelegram.connected?"success":currentTelegram.connecting?"warning":"neutral"}>{currentTelegram.connected?"Ulangan":currentTelegram.connecting?"Ulanish kutilmoqda":"Ulanmagan"}</StatusBadge></div>{currentTelegram.connected?<div className="telegram-connected-card"><div className="telegram-connected-icon"><FiCheck/></div><div><small>Ulangan guruh</small><strong>{currentTelegram.groupName||"Telegram guruhi"}</strong><span>{currentTelegram.connectedAt?`Ulangan: ${new Date(currentTelegram.connectedAt).toLocaleString("uz-UZ")}`:"Bildirishnomalar faol"}</span></div><button className="pro-btn secondary" disabled={!canWrite||telegramBusy} onClick={disconnectTelegram}>Uzish</button></div>:<div className="telegram-onboarding"><div className="telegram-steps"><div><b>1</b><span><strong>Guruhni ulashni bosing</strong><small>Zenix POS xavfsiz bir martalik ulash havolasini yaratadi.</small></span></div><div><b>2</b><span><strong>Telegramda guruhni tanlang</strong><small>@zenixposbot guruhga avtomatik qo‘shiladi.</small></span></div><div><b>3</b><span><strong>Tayyor</strong><small>Guruh Zenix POS akkauntingiz va joriy filial bilan avtomatik bog‘lanadi.</small></span></div></div><button className="pro-btn primary telegram-start" disabled={!canWrite||telegramBusy} onClick={startTelegramConnect}><FiSmartphone/> {telegramBusy?"Telegram kutilmoqda...":"Telegram guruhini ulash"}</button></div>}<div className="settings-switch-group two-col">{Object.entries(settingLabels).map(([key,label])=><SwitchRow disabled={!canWrite||!currentTelegram.connected||telegramBusy} key={key} title={label} checked={currentTelegram.settings?.[key]!==false} onChange={v=>changeTelegramSetting(key,v)}/>)}</div><button className="pro-btn secondary" disabled={!canWrite||!currentTelegram.connected||telegramBusy} onClick={testTelegram}><FiBell/> {testSent?"Test xabar yuborildi":telegramBusy?"Yuborilmoqda...":"Test xabar yuborish"}</button></>}
        {tab==="Interfeys"&&<><div className="pro-card-head"><div><h2>Interfeysni moslash</h2><p>Kundalik ko‘rinish sozlamalari sodda qoldirilgan. Texnik parametrlar “Kengaytirilgan” ichida.</p></div><button className="pro-btn secondary" disabled={!canWrite} onClick={()=>{if(!canWrite)return;markSaving();resetUiPreferences();addActivityLog({type:"settings",title:"Interfeys tiklandi",description:"Interfeys sozlamalari standart holatga qaytarildi"})}}><FiRotateCcw/> Standartga qaytarish</button></div><div className="appearance-grid"><label className="pro-field"><span>Mavzu</span><PremiumSelect disabled={!canWrite} value={uiPreferences.theme} onChange={e=>changeUi({theme:e.target.value})}><option value="light">Yorug‘</option><option value="dark">Qorong‘i</option><option value="system">Tizim bo‘yicha</option></PremiumSelect></label><label className="pro-field"><span>Asosiy rang</span><div className="color-field"><input disabled={!canWrite} type="color" value={uiPreferences.accent} onChange={e=>changeUi({accent:e.target.value})}/><input disabled={!canWrite} value={uiPreferences.accent} onChange={e=>changeUi({accent:e.target.value})}/></div></label><label className="pro-field"><span>Elementlar zichligi</span><PremiumSelect disabled={!canWrite} value={uiPreferences.density} onChange={e=>changeUi({density:e.target.value})}><option value="compact">Ixcham</option><option value="comfortable">Qulay</option></PremiumSelect></label><label className="pro-field"><span>Matn o‘lchami</span><PremiumSelect disabled={!canWrite} value={uiPreferences.fontScale} onChange={e=>changeUi({fontScale:e.target.value})}><option value="small">Kichik</option><option value="default">Standart</option><option value="large">Katta</option></PremiumSelect></label></div><button type="button" className="pro-btn secondary interface-advanced-toggle" onClick={()=>setAdvancedUi(v=>!v)}><FiSliders/> {advancedUi?"Kengaytirilgan sozlamalarni yopish":"Kengaytirilgan sozlamalar"}</button>{advancedUi&&<div className="interface-advanced-panel"><div className="appearance-grid"><label className="pro-field"><span>Karta yumaloqligi</span><PremiumSelect disabled={!canWrite} value={uiPreferences.radius} onChange={e=>changeUi({radius:e.target.value})}><option value="small">Kichik</option><option value="medium">Standart</option><option value="large">Katta</option></PremiumSelect></label><label className="pro-field"><span>Yon menyu kengligi</span><input disabled={!canWrite} type="range" min="220" max="290" value={uiPreferences.sidebarWidth} onChange={e=>changeUi({sidebarWidth:Number(e.target.value)})}/><small>{uiPreferences.sidebarWidth}px</small></label><label className="pro-field"><span>Mahsulot ko‘rinishi</span><PremiumSelect disabled={!canWrite} value={uiPreferences.productView} onChange={e=>changeUi({productView:e.target.value})}><option value="grid">Kartalar</option><option value="list">Ro‘yxat</option></PremiumSelect></label><label className="pro-field"><span>Ombor ustunlari</span><PremiumSelect disabled={!canWrite} value={uiPreferences.inventoryColumns} onChange={e=>changeUi({inventoryColumns:Number(e.target.value)})}><option value="2">2 ustun</option><option value="3">3 ustun</option><option value="4">4 ustun</option></PremiumSelect></label><label className="pro-field"><span>Jadval zichligi</span><PremiumSelect disabled={!canWrite} value={uiPreferences.tableDensity} onChange={e=>changeUi({tableDensity:e.target.value})}><option value="compact">Ixcham</option><option value="comfortable">Qulay</option></PremiumSelect></label><label className="pro-field"><span>Yon menyu rejimi</span><PremiumSelect disabled={!canWrite} value={uiPreferences.sidebarMode} onChange={e=>changeUi({sidebarMode:e.target.value})}><option value="compact">Ixcham</option><option value="comfortable">Qulay</option></PremiumSelect></label></div><div className="settings-switch-group"><SwitchRow disabled={!canWrite} title="Kartalar soyasi" checked={uiPreferences.cardShadow} onChange={v=>changeUi({cardShadow:v})}/><SwitchRow disabled={!canWrite} title="Topbar ixcham rejimi" checked={uiPreferences.navbarCompact} onChange={v=>changeUi({navbarCompact:v})}/><SwitchRow disabled={!canWrite} title="Animatsiyalarni kamaytirish" checked={uiPreferences.reducedMotion} onChange={v=>changeUi({reducedMotion:v})}/></div></div>}<div className="interface-preview"><FiMonitor/><div><strong>Jonli ko‘rinish faol</strong><small>O‘zgartirishlar shu zahoti ko‘rinadi.</small></div></div></>}
        {tab==="Funksiyalar"&&<><div className="pro-card-head"><div><h2>Biznes funksiyalari</h2><p>Biznes turini tanlang yoki kerakli imkoniyatlarni o‘zingiz yoqing.</p></div></div><div className="feature-presets"><button className={(org.businessType||"universal")==="clothing"?"active":""} disabled={!canWrite} onClick={()=>applyPreset("clothing")}>Kiyim</button><button className={org.businessType==="grocery"?"active":""} disabled={!canWrite} onClick={()=>applyPreset("grocery")}>Oziq-ovqat</button><button className={org.businessType==="electronics"?"active":""} disabled={!canWrite} onClick={()=>applyPreset("electronics")}>Elektronika</button><button className={org.businessType==="cosmetics"?"active":""} disabled={!canWrite} onClick={()=>applyPreset("cosmetics")}>Kosmetika</button><button className={(org.businessType||"universal")==="universal"?"active":""} disabled={!canWrite} onClick={()=>applyPreset("universal")}>Universal</button></div><div className="settings-switch-group two-col"><SwitchRow disabled={!canWrite} title="Variantlar" desc="Bir mahsulotning bir nechta varianti" checked={businessFeatures.variants} onChange={v=>changeFeatures(s=>({...s,variants:v}))}/><SwitchRow disabled={!canWrite} title="O‘lcham / rang" desc="Kiyim va variantli mahsulotlar" checked={businessFeatures.sizeColor} onChange={v=>changeFeatures(s=>({...s,sizeColor:v}))}/><SwitchRow disabled={!canWrite} title="Vazn / hajm" checked={businessFeatures.weightVolume} onChange={v=>changeFeatures(s=>({...s,weightVolume:v}))}/><SwitchRow disabled={!canWrite} title="Partiya / yaroqlilik muddati" checked={businessFeatures.batchExpiry} onChange={v=>changeFeatures(s=>({...s,batchExpiry:v}))}/><SwitchRow disabled={!canWrite} title="Serial / IMEI" checked={businessFeatures.serialImei} onChange={v=>changeFeatures(s=>({...s,serialImei:v}))}/><SwitchRow disabled={!canWrite} title="Kafolat" checked={businessFeatures.warranty} onChange={v=>changeFeatures(s=>({...s,warranty:v}))}/><SwitchRow disabled={!canWrite} title="Ta’minotchini kuzatish" checked={businessFeatures.supplierTracking} onChange={v=>changeFeatures(s=>({...s,supplierTracking:v}))}/><SwitchRow disabled={!canWrite} title="Filiallararo transfer" checked={businessFeatures.stockTransfers} onChange={v=>changeFeatures(s=>({...s,stockTransfers:v}))}/></div></>}
        {tab==="Eksport"&&<ExportCenter/>}
        {tab==="Diagnostika"&&<SystemDiagnostics/>}
        {tab==="Tarix"&&<><div className="pro-card-head"><div><h2>Sozlamalar tarixi</h2><p>Sozlamalarda kim, qachon va nima o‘zgartirganini ko‘ring.</p></div></div>{recentSettingLogs.length?<div className="settings-history-list">{recentSettingLogs.map(item=><article key={item.id}><div className="settings-history-icon"><FiSettings/></div><span><strong>{item.title}</strong><small>{item.description}</small></span><time>{item.date||""} {item.time||""}</time></article>)}</div>:<div className="pro-empty"><FiClock/><strong>Hali o‘zgarish yo‘q</strong><span>Sozlamalar o‘zgartirilganda tarix shu yerda ko‘rinadi.</span></div>}</>}
      </section>
    </div>
    <Modal open={!!passwordEmployee} onClose={()=>!passwordBusy&&setPasswordEmployee(null)} title="Vaqtinchalik parolni yangilash" subtitle={`${passwordEmployee?.name||"Xodim"} keyingi kirishda yangi parolni o‘zgartiradi.`} size="sm" footer={<><button className="pro-btn secondary" disabled={passwordBusy} onClick={()=>setPasswordEmployee(null)}>Bekor qilish</button><button className="pro-btn primary" disabled={passwordBusy||passwordValue.length<8} onClick={saveEmployeePassword}>{passwordBusy?"Saqlanmoqda...":"Parolni yangilash"}</button></>}>
      {passwordError&&<div className="pro-alert danger">{passwordError}</div>}
      <label className="pro-field"><span>Yangi vaqtinchalik parol</span><input autoFocus type="password" value={passwordValue} onChange={e=>setPasswordValue(e.target.value)} placeholder="Kamida 8 ta belgi" autoComplete="new-password"/><small>Xodim bu parol bilan kirgach, uni shaxsiy paroliga almashtirishga majbur bo‘ladi.</small></label>
    </Modal>
    <Modal open={!!permissionEmployee} onClose={()=>setPermissionEmployee(null)} title={`${permissionEmployee?.name||"Xodim"} — individual ruxsatlar`} subtitle="Rol sozlamalaridan faqat kerakli amallarni alohida o‘zgartiring." size="lg" footer={<><button className="pro-btn secondary" onClick={()=>permissionEmployee&&resetEmployeePermissions(employees.find(item=>item.id===permissionEmployee.id)||permissionEmployee)}>Rol sozlamalariga qaytarish</button><button className="pro-btn primary" onClick={()=>setPermissionEmployee(null)}>Tayyor</button></>}>
      {permissionEmployee&&(()=>{const emp=employees.find(item=>item.id===permissionEmployee.id)||permissionEmployee;const overrides=emp.permissionOverrides||{};const overrideCount=Object.keys(overrides).length;return <div className="employee-permission-editor"><div className="employee-permission-summary"><FiShield/><span><strong>{ROLE_LABELS[emp.role]||emp.role} roli asosida</strong><small>{overrideCount?`${overrideCount} ta individual o‘zgarish bor`:"Hozir barcha ruxsatlar rol sozlamalaridan olinadi"}</small></span></div><div className="employee-permission-groups"><section><h3>Modullar</h3>{modulePermissionDefs.map(([key,label])=><SwitchRow key={key} title={label} desc={Object.prototype.hasOwnProperty.call(overrides,key)?"Alohida sozlangan":"Rol bo‘yicha"} checked={employeePermissionValue(emp,key)} onChange={value=>setEmployeePermission(emp,key,value)} disabled={!canManagePermissions}/>)}</section><section><h3>Amallar</h3>{actionPermissionDefs.map(([key,label])=><SwitchRow key={key} title={label} desc={Object.prototype.hasOwnProperty.call(overrides,key)?"Alohida sozlangan":"Rol bo‘yicha"} checked={employeePermissionValue(emp,key)} onChange={value=>setEmployeePermission(emp,key,value)} disabled={!canManagePermissions}/>)}</section></div></div>})()}
    </Modal>
    <Modal open={employeeModal} onClose={closeEmployeeModal} title="Yangi xodim" subtitle="Xodim uchun filial, rol va alohida login yarating." size="sm" footer={<><button className="pro-btn secondary" disabled={employeeBusy} onClick={closeEmployeeModal}>Bekor qilish</button><button className="pro-btn primary" disabled={employeeBusy} onClick={createEmployee}>{employeeBusy?"Yaratilmoqda...":"Xodimni yaratish"}</button></>}>
      {employeeError&&<div className="pro-alert danger">{employeeError}</div>}
      <div className="pro-form-grid employee-create-form"><label className="pro-field full"><span>Ism va familiya</span><input autoFocus value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})} placeholder="Masalan, Sardor Tursunov"/></label><label className="pro-field full"><span>Telefon raqami *</span><input inputMode="tel" value={employeeForm.phone} onChange={e=>setEmployeeForm({...employeeForm,phone:formatUzPhone(e.target.value)})} placeholder="+998 90 123 45 67"/><small>Majburiy. Bir xil raqam ikki faol xodimda ishlatilmaydi.</small></label><label className="pro-field full"><span>Kirish nomi</span><input autoCapitalize="none" value={employeeForm.login} onChange={e=>setEmployeeForm({...employeeForm,login:e.target.value})} placeholder="sardor"/></label><label className="pro-field full"><span>Vaqtinchalik parol</span><input type="password" value={employeeForm.password} onChange={e=>setEmployeeForm({...employeeForm,password:e.target.value})} placeholder="Kamida 8 belgi"/></label><label className="pro-field"><span>Rol</span><PremiumSelect value={employeeForm.role} onChange={e=>setEmployeeForm({...employeeForm,role:e.target.value})}>{currentUser?.appRole===ROLES.OWNER&&<option value={ROLES.OWNER}>{ROLE_LABELS[ROLES.OWNER]}</option>}<option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option><option value={ROLES.MANAGER}>{ROLE_LABELS[ROLES.MANAGER]}</option><option value={ROLES.CASHIER}>{ROLE_LABELS[ROLES.CASHIER]}</option><option value={ROLES.SALES}>{ROLE_LABELS[ROLES.SALES]}</option><option value={ROLES.WAREHOUSE}>{ROLE_LABELS[ROLES.WAREHOUSE]}</option></PremiumSelect></label><label className="pro-field"><span>Filial</span><PremiumSelect value={employeeForm.storeId} onChange={e=>setEmployeeForm({...employeeForm,storeId:e.target.value})}>{activeStores.map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</PremiumSelect></label></div>
      <div className="employee-security-note"><FiShield/><span><strong>Hisob xavfsizligi</strong><small>Parollar serverda kuchli xesh ko‘rinishida saqlanadi. Sessiyalar HttpOnly cookie orqali boshqariladi va faol qurilmalarni profilingizdan yopishingiz mumkin.</small></span></div>
    </Modal>
  </div>;
}
export default Settings;
