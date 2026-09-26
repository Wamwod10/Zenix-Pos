import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { DEFAULT_BUSINESS_FEATURES, DEFAULT_UI_PREFERENCES, DEFAULT_WORKSPACE_SETTINGS, DEFAULT_ROLE_PERMISSIONS } from "../config/uiDefaults";
import { ROLES } from "../config/roles";
import { BILLING_PLANS, addBillingMonths, billingDateISO } from "../config/billing";
import { formatWorkspaceDate, workspaceDateISO, workspaceTime } from "../utils/workspaceDate";
import { invoiceBalance } from "../utils/supplierLedger";
import { api, ApiError } from "../services/apiClient";

const StoreContext = createContext(null);
const DEFAULT_STORE_ID = "dokon-1";

const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const settlementFor = (total, meta = {}) => {
  const amount=Math.max(0,number(total,0));
  if(meta.payment==="paid")return {paidAmount:amount,balance:0,paymentStatus:"paid"};
  if(meta.payment==="partial"){
    const paidAmount=Math.min(amount,Math.max(0,number(meta.paidAmount,0)));
    const balance=Math.max(0,amount-paidAmount);
    return {paidAmount,balance,paymentStatus:balance<=0?"paid":paidAmount>0?"partial":"credit"};
  }
  return {paidAmount:0,balance:amount,paymentStatus:"credit"};
};

const billingExpiryISO = (value) => {
  const raw=String(value||"").slice(0,10);
  const match=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)return null;
  const [,year,month,day]=match;
  return new Date(Number(year),Number(month)-1,Number(day),23,59,59,999).toISOString();
};
const nextBillingExpiry = (baseValue,plan) => {
  const now=new Date();
  const current=baseValue?new Date(baseValue):now;
  const base=current.getTime()>now.getTime()?current:now;
  return billingExpiryISO(addBillingMonths(billingDateISO(base),plan==="MONTHLY"?1:12));
};
const normalizeProduct = (item, storeIds = [DEFAULT_STORE_ID]) => {
  const legacyQty = number(item.quantity ?? item.stock, 0);
  const stockByStore = item.stockByStore && typeof item.stockByStore === "object"
    ? { ...item.stockByStore }
    : { [storeIds[0] || DEFAULT_STORE_ID]: legacyQty };
  storeIds.forEach((id) => { if (stockByStore[id] == null) stockByStore[id] = 0; });
  return {
    ...item,
    quantity: legacyQty,
    stock: legacyQty,
    stockByStore,
    sellPrice:number(item.sellPrice ?? item.price,0),
    price:number(item.price ?? item.sellPrice,0),
    costPrice:number(item.costPrice,0),
    minStock:number(item.minStock,5),
    unit:item.unit || "dona",
    archived:Boolean(item.archived),
  };
};
const normalizeInventoryState = (items = [], storeIds = [DEFAULT_STORE_ID]) => items.map((item)=>normalizeProduct(item,storeIds));
const projectInventory = (items = [], storeId = DEFAULT_STORE_ID) => items.map((item)=>{
  const qty = number(item.stockByStore?.[storeId], number(item.quantity ?? item.stock,0));
  return { ...item, quantity:qty, stock:qty };
});
const productFromApi=(row,storeIds=[])=>normalizeProduct({
  id:row.id,name:row.name,sku:row.sku||"",barcode:row.barcode||"",category:row.category||"",brand:row.brand||"",unit:row.unit||"dona",
  costPrice:number(row.cost_price??row.costPrice,0),sellPrice:number(row.sell_price??row.sellPrice,0),wholesalePrice:number(row.wholesale_price??row.wholesalePrice,0),
  minStock:number(row.min_stock??row.minStock,0),archived:Boolean(row.archived),stockByStore:row.stock_by_store||row.stockByStore||{},
  ...(row.metadata||{}),metadata:row.metadata||{},
},storeIds);
const apiFailure=(error,fallback)=>({success:false,message:error instanceof ApiError?error.message:(error?.message||fallback)});



export const StoreProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [inventoryState, setInventoryState] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [returns, setReturns] = useState([]);
  const [activeShifts, setActiveShifts] = useState({});
  const [shiftHistory, setShiftHistory] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [inventoryTransfers, setInventoryTransfers] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [inventoryCounts, setInventoryCounts] = useState([]);
  const [telegramSettings, setTelegramSettings] = useState({connected:false,connections:{}});
  const [organizations, setOrganizationsState] = useState([]);
  const [payments, setPaymentsState] = useState([]);
  const [billingDraft, setBillingDraft] = useState(null);
  const [uiPreferences, setUiPreferencesState] = useState(DEFAULT_UI_PREFERENCES);
  const [businessFeatures, setBusinessFeatures] = useState(DEFAULT_BUSINESS_FEATURES);
  const [workspaceSettings, setWorkspaceSettings] = useState(DEFAULT_WORKSPACE_SETTINGS);
  const [employees, setEmployees] = useState([]);
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState("");
  const lastOrg = useRef(undefined);
  const settingsBaselineRef = useRef({workspaceSettings:"",businessFeatures:"",rolePermissions:""});

  const activeStores = stores.filter((store) => store.active !== false);
  const branchLockedRole=[ROLES.CASHIER,ROLES.SALES,ROLES.WAREHOUSE].includes(currentUser?.appRole);
  const assignedStore=branchLockedRole?activeStores.find((store)=>store.id===currentUser?.storeId):null;
  const branchAssignmentValid=!branchLockedRole||Boolean(assignedStore);
  const currentStoreId = branchLockedRole
    ? (currentUser?.storeId || DEFAULT_STORE_ID)
    : (activeStores.some((store)=>store.id===selectedStoreId) ? selectedStoreId : activeStores[0]?.id || DEFAULT_STORE_ID);
  const currentStore = activeStores.find((store) => store.id === currentStoreId)
    || (branchLockedRole ? stores.find((store)=>store.id===currentStoreId) : activeStores[0])
    || { id:DEFAULT_STORE_ID, name:"Asosiy filial" };
  const inventory = useMemo(()=>projectInventory(inventoryState,currentStoreId),[inventoryState,currentStoreId]);
  const activeShift = activeShifts[currentStoreId] || null;
  const hasPermission = useCallback((permission, role=currentUser?.appRole)=>{
    if(role===ROLES.OWNER)return true;
    const overrides=currentUser?.permissionOverrides;
    if(role===currentUser?.appRole&&overrides&&Object.prototype.hasOwnProperty.call(overrides,permission)) return Boolean(overrides[permission]);
    return Boolean(rolePermissions?.[role]?.[permission]);
  },[rolePermissions,currentUser?.appRole,currentUser?.permissionOverrides]);
  const effectiveWorkspaceSettings = useMemo(()=>{
    const override=workspaceSettings.storeOverrides?.[currentStoreId]||{};
    return {
      ...workspaceSettings,
      pos:{...workspaceSettings.pos,...(override.pos||{})},
      inventory:{...workspaceSettings.inventory,...(override.inventory||{})},
      businessDay:{...workspaceSettings.businessDay,...(override.businessDay||{})},
      receipt:{...workspaceSettings.receipt,...(override.receipt||{})},
      notifications:{...workspaceSettings.notifications,...(override.notifications||{})},
    };
  },[workspaceSettings,currentStoreId]);

  const hydrateWorkspace = useCallback(async()=>{
    const org=currentUser?.organizationId||null;
    setWorkspaceReady(false);
    setPersistenceError("");
    if(!currentUser){
      setStores([]);setInventoryState([]);setDailySales([]);setSalesHistory([]);setSuppliers([]);setExpenses([]);setReturns([]);
      setActiveShifts({});setShiftHistory([]);setActivityLogs([]);setInventoryTransfers([]);setStockMovements([]);setInventoryCounts([]);
      setOrganizationsState([]);setPaymentsState([]);setBillingDraft(null);setEmployees([]);setTelegramSettings({connected:false,connections:{}});
      setWorkspaceReady(true);return;
    }
    if(currentUser.appRole===ROLES.PLATFORM_ADMIN){
      try{
        const data=await api.get("/api/platform/bootstrap");
        setOrganizationsState(data.organizations||[]);setPaymentsState(data.payments||[]);setBillingDraft(null);
      }catch(error){setPersistenceError(error instanceof ApiError?error.message:"Platforma ma’lumotlarini yuklab bo‘lmadi")}
      setWorkspaceReady(true);return;
    }
    if(!org){setWorkspaceReady(true);return;}
    try{
      // Billing approval changes the authoritative organization entitlement in /api/bootstrap.
      // Do not let an unrelated settings request keep a stale PAYMENT_REQUIRED/REVIEW
      // organization in memory: that made React Router change the URL while WorkspaceAccess
      // kept rendering/redirecting back to Billing after a Telegram approval.
      const [baseResult,settingsResult]=await Promise.allSettled([api.get("/api/bootstrap"),api.get("/api/settings")]);
      if(baseResult.status!=="fulfilled")throw baseResult.reason;
      const base=baseResult.value||{};
      const settingsData=settingsResult.status==="fulfilled"?(settingsResult.value||{}):{};
      const nextStores=(base.stores||[]).map((store)=>({...store,active:store.active!==false}));
      const storeIds=nextStores.map((store)=>store.id);
      setStores(nextStores);
      const preferred=settingsData.selectedStoreId;
      setSelectedStoreId(nextStores.some((store)=>store.id===preferred&&store.active!==false)?preferred:(nextStores[0]?.id||""));
      setInventoryState((base.inventory||[]).map((item)=>productFromApi(item,storeIds)));
      setDailySales(base.dailySales||[]);setSalesHistory(base.salesHistory||[]);setSuppliers(base.suppliers||[]);setExpenses(base.expenses||[]);setReturns(base.returns||[]);
      setActiveShifts(base.activeShifts||{});setShiftHistory(base.shiftHistory||[]);setActivityLogs(base.activityLogs||[]);setInventoryTransfers(base.inventoryTransfers||[]);
      setStockMovements(base.stockMovements||[]);setInventoryCounts(base.inventoryCounts||[]);setPaymentsState(base.payments||[]);
      const orgRow=base.organization||{};
      const included=Math.max(1,number(BILLING_PLANS[orgRow.plan]?.includedStores,2));
      setOrganizationsState(orgRow.id?[{...orgRow,owner:currentUser.name,stores:nextStores.filter((item)=>item.active!==false).length,includedStores:included,purchasedExtraStores:Math.max(0,number(orgRow.storeLimit,included)-included)}]:[]);
      const tgConnections={};
      (base.telegramConnections||[]).forEach((row)=>{const storeId=row.store_id||row.storeId||"all";tgConnections[storeId]={connected:true,connectionId:row.id,groupName:row.chat_title||row.chatTitle||"Telegram guruhi",chatId:String(row.chat_id||row.chatId||""),botUsername:"@zenixposbot",settings:row.settings||{}}});
      setTelegramSettings({connected:Object.keys(tgConnections).length>0,connections:tgConnections});
      const rawWorkspace=settingsData.workspaceSettings||{};
      const nextWorkspaceSettings={
        ...DEFAULT_WORKSPACE_SETTINGS,...rawWorkspace,
        organization:{...DEFAULT_WORKSPACE_SETTINGS.organization,...(settingsData.organization||{}),...(rawWorkspace.organization||{}),businessName:settingsData.organization?.businessName||currentUser.organizationName||""},
        pos:{...DEFAULT_WORKSPACE_SETTINGS.pos,...(rawWorkspace.pos||{})},inventory:{...DEFAULT_WORKSPACE_SETTINGS.inventory,...(rawWorkspace.inventory||{})},
        businessDay:{...DEFAULT_WORKSPACE_SETTINGS.businessDay,...(rawWorkspace.businessDay||{})},receipt:{...DEFAULT_WORKSPACE_SETTINGS.receipt,...(rawWorkspace.receipt||{})},
        notifications:{...DEFAULT_WORKSPACE_SETTINGS.notifications,...(rawWorkspace.notifications||{})},storeOverrides:{...(rawWorkspace.storeOverrides||{})},
      };
      const nextBusinessFeatures={...DEFAULT_BUSINESS_FEATURES,...(settingsData.businessFeatures||{})};
      const nextRolePermissions=Object.fromEntries(Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role,defaults])=>[role,{...defaults,...(settingsData.rolePermissions?.[role]||{})}]));
      settingsBaselineRef.current={
        workspaceSettings:JSON.stringify(nextWorkspaceSettings),
        businessFeatures:JSON.stringify(nextBusinessFeatures),
        rolePermissions:JSON.stringify(nextRolePermissions),
      };
      setWorkspaceSettings(nextWorkspaceSettings);
      setBusinessFeatures(nextBusinessFeatures);
      setRolePermissions(nextRolePermissions);
      setUiPreferencesState({...DEFAULT_UI_PREFERENCES,...(settingsData.uiPreferences||{})});
      setEmployees((base.employees||[]).map((row)=>({id:row.id,accountId:row.id,name:row.name,phone:row.phone||"",login:row.username,role:row.app_role||row.appRole,storeId:row.store_id||row.storeId||null,active:row.active!==false,permissionOverrides:row.permission_overrides||row.permissionOverrides||{}})));
      setWorkspaceReady(true);
    }catch(error){
      setPersistenceError(error instanceof ApiError?error.message:"Serverdan ish maydonini yuklab bo‘lmadi");
      setWorkspaceReady(true);
    }
  },[currentUser]);

  useEffect(()=>{
    const org=currentUser?.organizationId||null;
    if(lastOrg.current===org)return;
    lastOrg.current=org;
    void hydrateWorkspace();
  },[currentUser?.organizationId,currentUser?.id,hydrateWorkspace]);

  useEffect(()=>{
    if(!workspaceReady||!currentUser?.organizationId||!selectedStoreId||branchLockedRole)return;
    api.patch("/api/settings/preferences",{selectedStoreId}).catch(()=>{});
  },[workspaceReady,currentUser?.organizationId,selectedStoreId,branchLockedRole]);

  useEffect(()=>{
    if(!workspaceReady||!currentUser?.organizationId||!hasPermission("settingsWrite",currentUser?.appRole))return undefined;
    const snapshots={
      workspaceSettings:JSON.stringify(workspaceSettings),
      businessFeatures:JSON.stringify(businessFeatures),
      rolePermissions:JSON.stringify(rolePermissions),
    };
    const baseline=settingsBaselineRef.current;
    const payload={};
    if(snapshots.workspaceSettings!==baseline.workspaceSettings)payload.workspaceSettings=workspaceSettings;
    if(snapshots.businessFeatures!==baseline.businessFeatures)payload.businessFeatures=businessFeatures;
    if(currentUser?.appRole===ROLES.OWNER&&snapshots.rolePermissions!==baseline.rolePermissions){
      payload.rolePermissions=Object.fromEntries(Object.entries(rolePermissions||{}).filter(([role])=>role!==ROLES.OWNER&&role!==ROLES.PLATFORM_ADMIN));
    }
    if(!Object.keys(payload).length)return undefined;
    const timer=setTimeout(async()=>{
      try{
        await api.patch("/api/settings/workspace",payload);
        settingsBaselineRef.current={...settingsBaselineRef.current,...Object.fromEntries(Object.keys(payload).map((key)=>[key,snapshots[key]]))};
        setPersistenceError("");
      }catch(error){setPersistenceError(error?.message||"Sozlamalarni serverga saqlab bo‘lmadi")}
    },350);
    return()=>clearTimeout(timer);
  },[workspaceSettings,businessFeatures,rolePermissions,workspaceReady,currentUser?.organizationId,currentUser?.appRole,hasPermission]);

  const setUiPreferences=useCallback((updater)=>{
    setUiPreferencesState((previous)=>{
      const patch=typeof updater==="function"?updater(previous):updater;const next={...previous,...(patch||{})};
      api.patch("/api/settings/preferences",{uiPreferences:next}).catch((error)=>setPersistenceError(error?.message||"Interfeys sozlamalarini saqlab bo‘lmadi"));
      return next;
    });
  },[]);
  const resetUiPreferences=useCallback(()=>{setUiPreferencesState(DEFAULT_UI_PREFERENCES);api.patch("/api/settings/preferences",{uiPreferences:DEFAULT_UI_PREFERENCES}).catch(()=>{})},[]);

  const generateBarcode = useCallback(async ({ reserved = [] } = {}) => {
    const blocked=new Set((reserved||[]).map((value)=>String(value||"").trim()).filter(Boolean));
    try{
      for(let attempt=0;attempt<8;attempt+=1){
        const data=await api.get("/api/products/barcode/generate");
        const barcode=String(data.barcode||"").trim();
        if(barcode&&!blocked.has(barcode))return {success:true,barcode};
      }
      return {success:false,message:"Unikal shtrix-kod yaratib bo‘lmadi. Qayta urinib ko‘ring."};
    }catch(error){return apiFailure(error,"Shtrix-kod yaratib bo‘lmadi")}
  },[]);

  const saveProduct=useCallback(async({id=null,payload})=>{
    const metadata={variant:payload.variant||"",size:payload.size||"",color:payload.color||"",weight:payload.weight||"",warranty:payload.warranty||"",imageKey:payload.imageKey||"",imageName:payload.imageName||""};
    const body={name:payload.name,sku:payload.sku||"",barcode:payload.barcode||"",category:payload.category||"",brand:payload.brand||"",unit:payload.unit||"dona",costPrice:number(payload.costPrice,0),sellPrice:number(payload.sellPrice??payload.price,0),wholesalePrice:number(payload.wholesalePrice,0),minStock:number(payload.minStock,0),metadata};
    try{const data=id?await api.patch(`/api/products/${encodeURIComponent(id)}`,body):await api.post("/api/products",body);const product=productFromApi(data.product,stores.map((item)=>item.id));setInventoryState((items)=>id?items.map((item)=>item.id===id?{...item,...product,stockByStore:item.stockByStore}:item):[product,...items]);return {success:true,product}}
    catch(error){return {success:false,message:error?.message||"Mahsulotni saqlab bo‘lmadi"}}
  },[stores]);

  const setProductArchived=useCallback(async(productId,archived)=>{
    try{const data=await api.post(`/api/products/${encodeURIComponent(productId)}/${archived?"archive":"restore"}`,{});setInventoryState((items)=>items.map((item)=>item.id===productId?{...item,archived:Boolean(data.product.archived)}:item));return {success:true,product:data.product}}
    catch(error){return {success:false,message:error?.message||"Mahsulot holatini yangilab bo‘lmadi"}}
  },[]);

  const patchProducts=useCallback(async(productIds,patch)=>{
    const results=[];
    for(const id of productIds||[]){
      const current=inventoryState.find((item)=>item.id===id);if(!current)continue;
      if(Object.prototype.hasOwnProperty.call(patch,"archived")){const result=await setProductArchived(id,Boolean(patch.archived));if(!result.success)return result;results.push(result.product);continue;}
      const result=await saveProduct({id,payload:{...current,...patch}});if(!result.success)return result;results.push(result.product);
    }
    return {success:true,products:results};
  },[inventoryState,saveProduct,setProductArchived]);

  const addStore = useCallback(async({name})=>{
    if(!hasPermission("settingsWrite",currentUser?.appRole))return {success:false,message:"Filial yaratish uchun Sozlamalarni boshqarish ruxsati kerak"};
    const cleanName=String(name||"").trim();if(cleanName.length<2)return {success:false,message:"Filial nomini kiriting"};
    try{const data=await api.post("/api/stores",{name:cleanName});const store=data.store;setStores((items)=>[...items,store]);setInventoryState((items)=>items.map((item)=>({...item,stockByStore:{...(item.stockByStore||{}),[store.id]:0}})));setSelectedStoreId(store.id);return {success:true,store}}
    catch(error){return {success:false,message:error?.message||"Filialni yaratib bo‘lmadi"}}
  },[hasPermission,currentUser?.appRole]);

  const updateStore=useCallback(async(id,patch)=>{
    try{const data=await api.patch(`/api/stores/${encodeURIComponent(id)}`,patch);setStores((items)=>items.map((item)=>item.id===id?{...item,...data.store}:item));return {success:true,store:data.store}}
    catch(error){return {success:false,message:error?.message||"Filialni yangilab bo‘lmadi"}}
  },[]);

  const getStoreStock = useCallback((productId,storeId=currentStoreId)=>{
    const item=inventoryState.find((product)=>product.id===productId);
    return Math.max(0,number(item?.stockByStore?.[storeId],0));
  },[inventoryState,currentStoreId]);
  const getStoreProduct = useCallback((productId,storeId=currentStoreId)=>{
    const item=inventoryState.find((product)=>product.id===productId);
    if(!item)return null;
    const quantity=Math.max(0,number(item?.stockByStore?.[storeId],number(item.quantity ?? item.stock,0)));
    return {...item,quantity,stock:quantity};
  },[inventoryState,currentStoreId]);
  const addActivityLog = useCallback(async (log) => {
    const now=new Date();
    const item = {
      id:crypto.randomUUID(), type:log.type || "general", title:log.title || "Amal bajarildi", description:log.description || "",
      userName:log.userName || currentUser?.name || "Foydalanuvchi", userRole:log.userRole || currentUser?.appRole || "USER",
      storeId:log.storeId || currentStoreId || null, storeName:log.storeName || currentStore?.name,
      before:log.before, after:log.after, changes:log.changes || null, metadata:log.metadata || null,
      date:formatWorkspaceDate(now,workspaceSettings.organization||{}), dateISO:workspaceDateISO(now,workspaceSettings.organization?.timezone), time:workspaceTime(now,workspaceSettings.organization||{}), createdAt:now.toISOString(),
    };
    // Activity shown immediately in the UI is optimistic only. The authoritative
    // audit trail is written by the backend endpoint that performed the action;
    // accepting arbitrary client-supplied audit rows would make the audit log forgeable.
    setActivityLogs((items) => [item, ...items].slice(0,500));
    return item;
  }, [currentUser,currentStoreId,currentStore?.name,workspaceSettings.organization]);

  const commitInventoryAdjustment = useCallback(async ({ productId, storeId = currentStoreId, delta = 0, reason = "", allowNegative = false } = {}) => {
    if(!productId||!storeId)return {success:false,message:"Mahsulot yoki filial topilmadi"};
    if(!String(reason||"").trim())return {success:false,message:"Tuzatish sababini kiriting"};
    try{
      const data=await api.post("/api/inventory/adjust",{productId,storeId,delta:number(delta,0),reason:String(reason).trim(),allowNegative:Boolean(allowNegative)});
      await hydrateWorkspace();
      return {success:true,movement:data};
    }catch(error){return apiFailure(error,"Qoldiqni yangilab bo‘lmadi")}
  },[currentStoreId,hydrateWorkspace]);

  const commitInventoryReceipt = useCallback(async ({ lines = [], meta = {}, activity = null, storeId = currentStoreId } = {}) => {
    if(!storeId)return {success:false,message:"Filial topilmadi"};
    const sourceLines=(lines||[]).filter((line)=>Math.max(0,number(line?.qty??line?.quantity,0))>0&&(line?.productId||String(line?.name||"").trim()));
    if(!sourceLines.length)return {success:false,message:"Kirim uchun mahsulot topilmadi"};
    try{
      const body={
        storeId,
        lines:sourceLines.map((line)=>({
          productId:line.productId||null,name:String(line.name||"").trim(),sku:String(line.sku||"").trim(),barcode:String(line.barcode||"").trim(),category:String(line.category||"").trim(),brand:String(line.brand||"").trim(),unit:line.unit||"dona",
          quantity:Math.max(0,number(line.qty??line.quantity,0)),costPrice:Math.max(0,number(line.costPrice,0)),sellPrice:Math.max(0,number(line.sellPrice,0)),wholesalePrice:Math.max(0,number(line.wholesalePrice,0)),minStock:Math.max(0,number(line.minStock,workspaceSettings.inventory?.defaultLowStock||0)),
          batchNo:String(line.batchNo||"").trim(),expiryDate:String(line.expiry||line.expiryDate||"").trim()||null,
          serials:String(line.serial||"").split(/[\n,;]+/).map((value)=>value.trim()).filter(Boolean),
          metadata:{variant:line.variant||"",size:line.size||"",color:line.color||"",weight:line.weight||"",warranty:line.warranty||""},note:String(line.note||"").trim(),
        })),
        supplierId:meta.supplierId&&meta.supplierId!=="__new__"?meta.supplierId:null,
        newSupplier:meta.supplierId==="__new__"?{name:String(meta.newSupplierName||"").trim(),phone:String(meta.newSupplierPhone||"").trim()}:null,
        settlement:{status:meta.payment||"paid",paidAmount:Math.max(0,number(meta.paidAmount,0)),invoiceNo:String(meta.invoiceNo||"").trim(),dueDate:String(meta.dueDate||"").trim()||null,note:String(meta.note||"").trim()},
        reference:String(meta.invoiceNo||"").trim(),note:String(meta.note||"").trim(),
      };
      const data=await api.post("/api/inventory/receive",body);
      await hydrateWorkspace();
      const products=(data.updated||[]).map((row)=>({id:row.productId||row.id,name:row.name,quantity:number(row.quantity,0),stock:number(row.quantity,0),costPrice:number(row.avgCost??row.costPrice,0),unit:sourceLines.find((line)=>String(line.productId||"")===String(row.productId||row.id))?.unit||"dona"}));
      return {success:true,accepted:products.length,products,purchaseItems:data.purchaseLines||[],supplier:data.supplier||null,invoice:data.invoice||null,total:number(data.total,0),settlement:data.settlement||{},movements:data.updated||[]};
    }catch(error){return apiFailure(error,"Kirimni saqlab bo‘lmadi")}
  },[currentStoreId,hydrateWorkspace,workspaceSettings.inventory?.defaultLowStock]);

  const commitInventoryTransferCreate = useCallback(async ({ toStoreId, items = [], needsApproval = false } = {}) => {
    if(!toStoreId||toStoreId===currentStoreId)return {success:false,message:"Qabul qiluvchi filialni tanlang"};
    const clean=(items||[]).map((item)=>({productId:item.productId,quantity:Math.max(0,number(item.qty??item.quantity,0))})).filter((item)=>item.productId&&item.quantity>0);
    if(!clean.length)return {success:false,message:"Transferga mahsulot qo‘shing"};
    try{
      const data=await api.post("/api/inventory/transfers",{fromStoreId:currentStoreId,toStoreId,needsApproval:Boolean(needsApproval),items:clean});
      await hydrateWorkspace();
      return {success:true,transfer:data.transfer||data};
    }catch(error){return apiFailure(error,"Transferni yaratib bo‘lmadi")}
  },[currentStoreId,hydrateWorkspace]);

  const commitInventoryTransferTransition = useCallback(async ({ transferId, nextStatus, receivedQuantities = null, differenceReason = "" } = {}) => {
    if(!transferId)return {success:false,message:"Transfer topilmadi"};
    try{
      let data;
      if(nextStatus==="IN_TRANSIT")data=await api.post(`/api/inventory/transfers/${encodeURIComponent(transferId)}/dispatch`,{});
      else if(nextStatus==="RECEIVED"){
        const transfer=inventoryTransfers.find((item)=>String(item.id)===String(transferId));
        const items=(transfer?.items||[]).map((item)=>({productId:item.productId,receivedQuantity:Math.max(0,number(receivedQuantities?.[item.productId],item.qty??item.sentQty??0))}));
        data=await api.post(`/api/inventory/transfers/${encodeURIComponent(transferId)}/receive`,{items,differenceReason:String(differenceReason||"").trim()});
      }else if(nextStatus==="REJECTED")data=await api.post(`/api/inventory/transfers/${encodeURIComponent(transferId)}/cancel`,{});
      else return {success:false,message:"Transfer holati noto‘g‘ri"};
      await hydrateWorkspace();
      return {success:true,transfer:data.transfer||data};
    }catch(error){return apiFailure(error,"Transfer holatini yangilab bo‘lmadi")}
  },[inventoryTransfers,hydrateWorkspace]);

  const commitInventoryCountSubmit = useCallback(async ({ changes = [], requireApproval = false, storeId = currentStoreId, storeName = currentStore?.name } = {}) => {
    const clean=(changes||[]).filter((change)=>change?.productId&&Number.isFinite(Number(change.after))).map((change)=>({productId:change.productId,before:Math.max(0,number(change.before,0)),after:Math.max(0,number(change.after,0))}));
    if(!clean.length)return {success:false,message:"Inventarizatsiya farqi topilmadi"};
    try{
      const data=await api.post("/api/inventory/counts",{storeId,requireApproval:Boolean(requireApproval),changes:clean});
      await hydrateWorkspace();
      return {success:true,pending:Boolean(requireApproval),count:data.count||data,storeName};
    }catch(error){return apiFailure(error,"Inventarizatsiyani saqlab bo‘lmadi")}
  },[currentStoreId,currentStore?.name,hydrateWorkspace]);

  const commitInventoryCountReview = useCallback(async ({ countId, decision } = {}) => {
    if(!countId||!["approve","reject"].includes(decision))return {success:false,message:"Inventarizatsiya amali noto‘g‘ri"};
    try{
      const data=await api.post(`/api/inventory/counts/${encodeURIComponent(countId)}/review`,{decision});
      await hydrateWorkspace();
      return {success:true,status:String(data.count?.status||decision).toUpperCase(),count:data.count||data};
    }catch(error){const result=apiFailure(error,"Inventarizatsiyani ko‘rib chiqib bo‘lmadi");if(error?.code==="INVENTORY_COUNT_CONFLICT")return {...result,conflict:true,conflicts:error?.details||[]};return result}
  },[hydrateWorkspace]);

  const loadSaleHolds = useCallback(async (storeId = currentStoreId) => {
    if(!storeId)return {success:true,holds:[]};
    try{const data=await api.get(`/api/sales/holds?storeId=${encodeURIComponent(storeId)}`);return {success:true,holds:data.holds||[]}}
    catch(error){return apiFailure(error,"Ushlab turilgan savatlarni yuklab bo‘lmadi")}
  },[currentStoreId]);

  const createSaleHold = useCallback(async ({ name, cart, customer = "", note = "", cartDiscountPct = 0, total = 0, storeId = currentStoreId, shiftId = activeShift?.id || null } = {}) => {
    if(!storeId||!(cart||[]).length)return {success:false,message:"Savat bo‘sh"};
    try{
      const data=await api.post("/api/sales/holds",{storeId,shiftId,name:String(name||"Savat").trim()||"Savat",cart,customer:String(customer||""),note:String(note||""),cartDiscountPct:number(cartDiscountPct,0),total:number(total,0)});
      return {success:true,hold:data.hold||data};
    }catch(error){return apiFailure(error,"Savatni ushlab turib bo‘lmadi")}
  },[currentStoreId,activeShift?.id]);

  const deleteSaleHold = useCallback(async (holdId) => {
    if(!holdId)return {success:false,message:"Savat topilmadi"};
    try{const data=await api.delete(`/api/sales/holds/${encodeURIComponent(holdId)}`);return {success:true,hold:data.hold||null}}
    catch(error){return apiFailure(error,"Ushlab turilgan savatni o‘chirib bo‘lmadi")}
  },[]);

  const commitSaleTransaction = useCallback(async ({ sale, productUpdates = [], activity = null, storeId = currentStoreId } = {}) => {
    if(!sale||!storeId||!(sale.items||[]).length)return {success:false,message:"Savdo ma’lumotlari to‘liq emas"};
    const paymentMix=sale.paymentMethod==="split"?(sale.paymentBreakdown||{}):{[sale.paymentMethod||"cash"]:number(sale.total,0)};
    const payments=["cash","card","transfer"].map((method)=>({method,amount:Math.max(0,number(paymentMix?.[method],0))})).filter((row)=>row.amount>0);
    try{
      const data=await api.post("/api/sales",{
        storeId,shiftId:sale.shiftId||null,clientReference:String(sale.id||""),businessDate:sale.businessDateISO||sale.dateISO,
        items:(sale.items||[]).map((item)=>({productId:item.productId||item.id,quantity:Math.max(0,number(item.quantity??item.qty,0)),unitPrice:Math.max(0,number(item.finalPrice??item.price??item.sellPrice,0)),discountPercent:0,metadata:{tracking:item.tracking||null,originalUnitPrice:number(item.sellPrice??item.price,0),itemDiscountPercent:number(item.discountPercent,0),cartDiscountPercent:number(item.cartDiscountPercent??sale.cartDiscountPercent,0)}})),
        payments,customer:typeof sale.customer==="object"&&sale.customer!==null?sale.customer:{name:String(sale.customer||"")},metadata:{note:sale.note||"",frontendSubtotal:number(sale.subtotal,0),frontendDiscountTotal:number(sale.discountTotal,0),paymentMethod:sale.paymentMethod||"cash"},
      });
      const server=data.sale||data;
      await hydrateWorkspace();
      const committed={...sale,id:server.id||sale.id,saleNumber:server.sale_number||server.saleNumber||sale.saleNumber,createdAt:server.created_at||server.createdAt||sale.createdAt};
      return {success:true,sale:committed};
    }catch(error){return apiFailure(error,"Savdoni saqlab bo‘lmadi")}
  },[currentStoreId,hydrateWorkspace]);

  const commitReturnTransaction = useCallback(async ({ saleId, updatedSale, productUpdates = [], stockStoreId = currentStoreId, returnRecord, cashMovement = null, activity = null } = {}) => {
    if(!saleId||!returnRecord?.productId||number(returnRecord.quantity,0)<=0)return {success:false,message:"Qaytarish ma’lumotlari to‘liq emas"};
    try{
      const data=await api.post(`/api/sales/${encodeURIComponent(saleId)}/returns`,{
        productId:returnRecord.productId,quantity:number(returnRecord.quantity,0),reason:String(returnRecord.reason||"Qaytarish").trim(),refundMethod:returnRecord.refundMethod||"original",
        refundShiftId:returnRecord.refundShiftId||cashMovement&&activeShift?.id||null,refundBreakdown:returnRecord.refundBreakdown||undefined,
        metadata:{businessDateISO:returnRecord.businessDateISO||"",dateISO:returnRecord.dateISO||"",tracking:returnRecord.tracking||null},
      });
      await hydrateWorkspace();
      return {success:true,sale:updatedSale,returnRecord:{...returnRecord,id:data.return?.id||returnRecord.id,amount:number(data.return?.amount,returnRecord.amount)}};
    }catch(error){return apiFailure(error,"Qaytarishni saqlab bo‘lmadi")}
  },[currentStoreId,activeShift?.id,hydrateWorkspace]);

  const commitBusinessDay = useCallback(async ({ day, storeId = currentStoreId, storeName = currentStore?.name, activity = null } = {}) => {
    if(!day?.businessDateISO&&!day?.dateISO)return {success:false,message:"Kunlik savdo sanasi topilmadi"};
    try{
      const data=await api.post("/api/sales/business-days/close",{storeId,businessDate:day.businessDateISO||day.dateISO,metadata:{clientReference:day.id||"",storeName:storeName||""}});
      await hydrateWorkspace();return {success:true,day:data.day||data};
    }catch(error){return apiFailure(error,"Biznes kunini yakunlab bo‘lmadi")}
  },[currentStoreId,currentStore?.name,hydrateWorkspace]);

  const saveSupplier = useCallback(async ({ id = null, payload } = {}) => {
    if(!payload?.name)return {success:false,message:"Ta’minotchi nomini kiriting"};
    const body={name:String(payload.name||"").trim(),phone:String(payload.phone||"").trim(),contactName:String(payload.contact||payload.contactName||"").trim(),telegram:String(payload.telegram||"").trim(),metadata:{deadline:payload.deadline||"",notes:payload.notes||""}};
    try{
      const data=id?await api.patch(`/api/suppliers/${encodeURIComponent(id)}`,body):await api.post("/api/suppliers",body);
      await hydrateWorkspace();
      return {success:true,supplier:data.supplier||data};
    }catch(error){return apiFailure(error,"Ta’minotchini saqlab bo‘lmadi")}
  },[hydrateWorkspace]);

  const setSupplierArchived = useCallback(async (supplierId, archived) => {
    if(!supplierId)return {success:false,message:"Ta’minotchi topilmadi"};
    try{
      const data=await api.post(`/api/suppliers/${encodeURIComponent(supplierId)}/${archived?"archive":"restore"}`,{});
      await hydrateWorkspace();
      return {success:true,supplier:data.supplier||data};
    }catch(error){return apiFailure(error,"Ta’minotchi holatini yangilab bo‘lmadi")}
  },[hydrateWorkspace]);

  const commitSupplierPayment = useCallback(async ({ supplierId, invoiceId = "", amount = 0, method = "cash", note = "", payFromRegister = false } = {}) => {
    if(!supplierId||number(amount,0)<=0)return {success:false,message:"To‘lov ma’lumotlari to‘liq emas"};
    try{
      const data=await api.post(`/api/suppliers/${encodeURIComponent(supplierId)}/payments`,{invoiceId:invoiceId||null,storeId:currentStoreId||null,shiftId:method==="cash"&&payFromRegister?(activeShift?.id||null):null,fromRegister:method==="cash"&&payFromRegister,amount:number(amount,0),method,note:String(note||"")});
      await hydrateWorkspace();return {success:true,payment:data.payment||data,amount:number(amount,0)};
    }catch(error){return apiFailure(error,"Ta’minotchi to‘lovini saqlab bo‘lmadi")}
  },[currentStoreId,activeShift?.id,hydrateWorkspace]);

  const commitExpenseTransaction = useCallback(async ({ expense, remove = false, activity = null } = {}) => {
    if(!expense)return {success:false,message:"Xarajat ma’lumotlari to‘liq emas"};
    try{
      if(remove){if(!expense.id)return {success:false,message:"Xarajat topilmadi"};await api.delete(`/api/expenses/${encodeURIComponent(expense.id)}`);}
      else{
        const body={storeId:expense.storeId||currentStoreId,shiftId:expense.shiftId||null,title:expense.title||expense.name,category:expense.category||"",amount:number(expense.amount,0),paymentMethod:expense.paymentMethod||"cash",note:expense.note||"",metadata:{receiptKey:expense.receiptKey||"",receiptName:expense.receiptName||"",receiptType:expense.receiptType||"",dateISO:expense.dateISO||""}};
        if(expense.id&&expenses.some((item)=>String(item.id)===String(expense.id)))await api.patch(`/api/expenses/${encodeURIComponent(expense.id)}`,body);else await api.post("/api/expenses",body);
      }
      await hydrateWorkspace();return {success:true,expense};
    }catch(error){return apiFailure(error,remove?"Xarajatni o‘chirib bo‘lmadi":"Xarajatni saqlab bo‘lmadi")}
  },[currentStoreId,expenses,hydrateWorkspace]);

  const commitShiftOpen = useCallback(async ({ shift, activity = null } = {}) => {
    if(!shift?.storeId)return {success:false,message:"Smena ma’lumotlari to‘liq emas"};
    try{
      const data=await api.post("/api/shifts/open",{storeId:shift.storeId,openingCash:number(shift.openingCash,0),registerKey:shift.registerKey||`user:${currentUser?.id}`,metadata:{businessDateISO:shift.businessDateISO||"",clientReference:shift.id||""}});
      await hydrateWorkspace();return {success:true,shift:data.shift||data};
    }catch(error){return apiFailure(error,"Smenani ochib bo‘lmadi")}
  },[hydrateWorkspace,currentUser?.id]);

  const commitShiftMovement = useCallback(async ({ movement, storeId = currentStoreId, activity = null } = {}) => {
    const shift=activeShifts?.[storeId];if(!shift)return {success:false,message:"Avval smenani oching"};
    if(!movement||number(movement.amount,0)<=0)return {success:false,message:"Kassa harakati ma’lumotlari to‘liq emas"};
    try{
      const data=await api.post(`/api/shifts/${encodeURIComponent(shift.id)}/movements`,{type:movement.type,amount:number(movement.amount,0),reason:String(movement.reason||"").trim(),source:movement.source||"manual",referenceId:movement.referenceId||movement.id||""});
      await hydrateWorkspace();return {success:true,movement:data.movement||data};
    }catch(error){return apiFailure(error,"Kassa harakatini saqlab bo‘lmadi")}
  },[activeShifts,currentStoreId,hydrateWorkspace]);

  const commitShiftClose = useCallback(async ({ closedShift, storeId = currentStoreId, activity = null } = {}) => {
    const current=activeShifts?.[storeId];if(!current||!closedShift)return {success:false,message:"Joriy smena topilmadi"};
    try{
      const data=await api.post(`/api/shifts/${encodeURIComponent(current.id)}/close`,{actualCash:number(closedShift.closingCash??closedShift.actualCash,0),metadata:{differenceReason:closedShift.differenceReason||"",denominationCounts:closedShift.denominationCounts||null,duration:closedShift.duration||""}});
      await hydrateWorkspace();return {success:true,shift:data.shift||data};
    }catch(error){return apiFailure(error,"Smenani yopib bo‘lmadi")}
  },[activeShifts,currentStoreId,hydrateWorkspace]);

  const loadBillingDraft = useCallback(async () => {
    try{const data=await api.get("/api/billing/draft");const draft=data.draft||null;setBillingDraft(draft);return {success:true,draft}}
    catch(error){return apiFailure(error,"To‘lov draftini yuklab bo‘lmadi")}
  },[]);

  const createBillingDraft = useCallback(async (payload = {}) => {
    try{
      const data=await api.post("/api/billing/draft",payload);
      const draft=data.draft||null;setBillingDraft(draft);
      return {success:true,draft};
    }catch(error){return apiFailure(error,"To‘lov draftini yaratib bo‘lmadi")}
  },[]);

  const cancelBillingDraft = useCallback(async (draftId = billingDraft?.id) => {
    if(!draftId){setBillingDraft(null);return {success:true}}
    try{await api.post(`/api/billing/draft/${encodeURIComponent(draftId)}/cancel`,{});setBillingDraft((current)=>current?.id===draftId?null:current);return {success:true}}
    catch(error){return apiFailure(error,"To‘lov draftini bekor qilib bo‘lmadi")}
  },[billingDraft?.id]);

  const getBillingReceipt = useCallback(async (receiptId) => {
    if(!receiptId)return {success:false,message:"Chek topilmadi"};
    const path=currentUser?.appRole===ROLES.PLATFORM_ADMIN?`/api/platform/receipts/${encodeURIComponent(receiptId)}`:`/api/billing/receipts/${encodeURIComponent(receiptId)}`;
    try{const blob=await api.blob(path);return {success:true,blob}}
    catch(error){return apiFailure(error,"Chekni ochib bo‘lmadi")}
  },[currentUser?.appRole]);

  const commitBillingSubmission = useCallback(async ({ draftId = billingDraft?.id, file } = {}) => {
    if(!draftId)return {success:false,message:"To‘lov drafti topilmadi"};
    if(!file)return {success:false,message:"To‘lov chekini yuklang"};
    try{
      const upload=await api.upload("/api/billing/receipts",file);
      const receiptId=upload.receipt?.id;
      if(!receiptId)return {success:false,message:"Chek serverga yuklanmadi"};
      const data=await api.post("/api/billing/payments",{draftId,receiptId});
      setBillingDraft(null);
      await hydrateWorkspace();
      return {success:true,payment:data.payment||data};
    }catch(error){return apiFailure(error,"To‘lovni yuborib bo‘lmadi")}
  },[billingDraft?.id,hydrateWorkspace]);

  const commitBillingReview = useCallback(async ({ paymentId, status, reason = "" } = {}) => {
    if(!paymentId)return {success:false,message:"To‘lov topilmadi"};
    try{
      const data=await api.post(`/api/platform/payments/${encodeURIComponent(paymentId)}/review`,{status,reason});
      await hydrateWorkspace();
      return {success:true,payment:data.payment||data};
    }catch(error){return apiFailure(error,"To‘lov holatini yangilab bo‘lmadi")}
  },[hydrateWorkspace]);

  useEffect(() => {
    const organizationId = currentUser?.organizationId;
    if (!organizationId || organizationId === "org-1" || currentUser?.appRole === ROLES.PLATFORM_ADMIN) return;
    const storeCount = stores.filter((store) => store.active !== false).length;
    setOrganizationsState((previous) => {
      let changed = false;
      const next = previous.map((organization) => {
        if (organization.id !== organizationId || Number(organization.stores || 0) === storeCount) return organization;
        changed = true;
        return { ...organization, stores: storeCount };
      });
      return changed ? next : previous;
    });
  }, [stores, currentUser?.organizationId, currentUser?.appRole]);

  const reloadStore = useCallback(()=>hydrateWorkspace(),[hydrateWorkspace]);
  const value = useMemo(() => ({
    inventory,generateBarcode,saveProduct,setProductArchived,patchProducts,inventoryState,getStoreStock,getStoreProduct,commitInventoryAdjustment,commitInventoryReceipt,commitInventoryTransferCreate,commitInventoryTransferTransition,commitInventoryCountSubmit,commitInventoryCountReview,loadSaleHolds,createSaleHold,deleteSaleHold,commitSaleTransaction,commitReturnTransaction,commitBusinessDay,saveSupplier,setSupplierArchived,commitSupplierPayment,commitExpenseTransaction,commitShiftOpen,commitShiftMovement,commitShiftClose,
    dailySales,setDailySales,salesHistory,setSalesHistory,suppliers,setSuppliers,
    expenses,setExpenses,returns,setReturns,activeShift,activeShifts,shiftHistory,setShiftHistory,
    telegramSettings,setTelegramSettings,activityLogs,setActivityLogs,addActivityLog,inventoryTransfers,setInventoryTransfers,stockMovements,setStockMovements,inventoryCounts,setInventoryCounts,stores,setStores,
    currentStore,currentStoreId,selectedStoreId,setSelectedStoreId,addStore,updateStore,branchAssignmentValid,organizations,payments,billingDraft,loadBillingDraft,createBillingDraft,cancelBillingDraft,getBillingReceipt,commitBillingSubmission,commitBillingReview,
    uiPreferences,setUiPreferences,resetUiPreferences,businessFeatures,setBusinessFeatures,workspaceSettings,setWorkspaceSettings,effectiveWorkspaceSettings,
    employees,setEmployees,rolePermissions,setRolePermissions,hasPermission,workspaceReady,persistenceError,loading:!workspaceReady,loadingMessage:workspaceReady?"":"Ish maydoni yuklanmoqda...",error:"",reloadStore,
  }), [inventory,generateBarcode,saveProduct,setProductArchived,patchProducts,inventoryState,getStoreStock,getStoreProduct,commitInventoryAdjustment,commitInventoryReceipt,commitInventoryTransferCreate,commitInventoryTransferTransition,commitInventoryCountSubmit,commitInventoryCountReview,loadSaleHolds,createSaleHold,deleteSaleHold,commitSaleTransaction,commitReturnTransaction,commitBusinessDay,saveSupplier,setSupplierArchived,commitSupplierPayment,commitExpenseTransaction,commitShiftOpen,commitShiftMovement,commitShiftClose,dailySales,salesHistory,suppliers,expenses,returns,activeShift,activeShifts,shiftHistory,telegramSettings,activityLogs,addActivityLog,inventoryTransfers,stockMovements,inventoryCounts,stores,currentStore,currentStoreId,selectedStoreId,addStore,updateStore,branchAssignmentValid,organizations,payments,billingDraft,loadBillingDraft,createBillingDraft,cancelBillingDraft,getBillingReceipt,commitBillingSubmission,commitBillingReview,uiPreferences,setUiPreferences,resetUiPreferences,businessFeatures,workspaceSettings,effectiveWorkspaceSettings,employees,rolePermissions,hasPermission,workspaceReady,persistenceError,reloadStore]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
};
