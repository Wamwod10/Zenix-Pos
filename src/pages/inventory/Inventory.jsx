import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  FiAlertTriangle, FiArchive, FiArrowRight, FiBox, FiCheck, FiCheckCircle,
  FiClipboard, FiFileText, FiPackage, FiPlus, FiRefreshCw, FiSearch, FiTruck, FiUpload, FiX, FiCamera,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { ROLES } from "../../config/roles";
import { formatPrice } from "../../utils/formatPrice";
import { formatWorkspaceDate, workspaceDateISO, workspaceTime } from "../../utils/workspaceDate";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumDateInput, MultiFilePicker, ColumnPicker } from "../../components/Ui";
import { analyzeImportFiles } from "../../services/documentImportService";
import { cellToText } from "../../utils/spreadsheetImport";
import { isBarcodeDuplicate } from "../../utils/barcode";
import Modal from "../../components/Modal";
import BarcodeScannerModal from "../../components/BarcodeScannerModal";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { useFeedback } from "../../context/FeedbackContext";
import "./inventory.scss";

const emptyReceive = {
  productId:"", barcode:"", name:"", sku:"", category:"", brand:"", unit:"dona",
  variant:"", size:"", color:"", weight:"", batchNo:"", expiry:"", serial:"", warranty:"",
  qty:"", costPrice:"", sellPrice:"", supplierId:"", payment:"paid", paidAmount:"", invoiceNo:"",
  dueDate:"", note:"", newSupplierName:"", newSupplierPhone:"",
};
const emptyQuickRow = () => ({ id:crypto.randomUUID(), productId:"", barcode:"", name:"", sku:"", category:"", unit:"dona", qty:"", costPrice:"", sellPrice:"" });

const normalizeCsvHeader=(value)=>String(value||"").trim().toLowerCase().replace(/[._-]+/g," ");
const receiveHeaderAliases={
  name:["name","product","product name","nomi","mahsulot","mahsulot nomi","наименование","товар"],
  sku:["sku","артикул","kod","code","mahsulot kodi"],
  barcode:["barcode","bar code","shtrix kod","штрихкод","ean","upc","gtin"],
  category:["category","kategoriya","категория","group","guruh"],
  brand:["brand","brend","бренд"],
  unit:["unit","birlik","единица","uom"],
  qty:["qty","quantity","miqdor","soni","qoldiq","количество","остаток"],
  costPrice:["cost","cost price","tannarx","kelish narxi","закупочная цена","себестоимость"],
  sellPrice:["price","sell price","sotuv narxi","selling price","цена","розничная цена"],
};
const splitCsvLine=(line,delimiter=",")=>{const out=[];let value="",quoted=false;for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'&&quoted&&line[index+1]==='"'){value+='"';index++;continue}if(char==='"'){quoted=!quoted;continue}if(char===delimiter&&!quoted){out.push(value.trim());value="";continue}value+=char}out.push(value.trim());return out};
const parseReceiveCsv=(text)=>{const lines=String(text||"").replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());if(!lines.length)return{headers:[],rows:[]};const delimiter=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?";":",";const headers=splitCsvLine(lines[0],delimiter);return{headers,rows:lines.slice(1).map(line=>splitCsvLine(line,delimiter))}};
const mapReceiveHeaders=(headers)=>Object.fromEntries(Object.entries(receiveHeaderAliases).map(([field,aliases])=>[field,headers.findIndex(header=>aliases.includes(normalizeCsvHeader(header)))]));
const receiveMappingFields=[
  ["name","Mahsulot nomi"],["sku","SKU"],["barcode","Shtrix-kod"],["category","Kategoriya"],["brand","Brend"],["unit","Birlik"],
  ["qty","Miqdor"],["costPrice","Tannarx"],["sellPrice","Sotuv narxi"],
];
const mappingProfileId=(result)=>{
  const supplier=normalizeCsvHeader(result?.meta?.supplier||"");
  if(supplier)return `supplier:${supplier}`;
  const signature=(result?.table?.headers||[]).map(normalizeCsvHeader).filter(Boolean).join("|");
  return signature?`headers:${signature}`:"";
};
const resolveSavedMapping=(headers,saved={})=>Object.fromEntries(receiveMappingFields.map(([field])=>{
  const wanted=normalizeCsvHeader(saved?.[field]||"");
  return [field,wanted?headers.findIndex((header)=>normalizeCsvHeader(header)===wanted):-1];
}));
const serializeMapping=(headers,mapping={})=>Object.fromEntries(receiveMappingFields.flatMap(([field])=>{
  const index=Number(mapping?.[field]);
  return Number.isInteger(index)&&index>=0&&headers[index]!=null?[[field,String(headers[index])]]:[];
}));
const csvNumber=(value)=>Math.max(0,Number(String(value??"").replace(/\s/g,"").replace(",","."))||0);

const movementColumnDefs=[
  {id:"action",label:"Amal"},
  {id:"before",label:"Oldin"},
  {id:"after",label:"Keyin"},
  {id:"reason",label:"Sabab"},
  {id:"user",label:"Xodim"},
];

const paymentAmounts=(total,meta)=>{
  const amount=Math.max(0,Number(total||0));
  if(meta?.payment==="paid")return{paidAmount:amount,balance:0,paymentStatus:"paid"};
  if(meta?.payment==="partial"){
    const paidAmount=Math.min(amount,Math.max(0,Number(meta?.paidAmount||0)));
    const balance=Math.max(0,amount-paidAmount);
    return{paidAmount,balance,paymentStatus:balance<=0?"paid":paidAmount>0?"partial":"credit"};
  }
  return{paidAmount:0,balance:amount,paymentStatus:"credit"};
};

const transferDisplayLabel=(transfer)=>transfer?.documentNo||transfer?.transferNo||`Transfer · ${transfer?.from||"Manba"} → ${transfer?.to||"Qabul qiluvchi"}`;
const productTracking=(product,storeId)=>{
  const batches=(product?.stockBatches||[]).filter((row)=>row.storeId===storeId&&Number(row.remaining||0)>0).sort((a,b)=>String(a.expiryDate||"9999-12-31").localeCompare(String(b.expiryDate||"9999-12-31"))||String(a.receivedAt||"").localeCompare(String(b.receivedAt||"")));
  const serials=(product?.serializedUnits||[]).filter((row)=>row.storeId===storeId&&row.status==="IN_STOCK");
  return{batches,serials,isBatchTracked:batches.length>0,isSerialTracked:serials.length>0};
};
const previewBatchAllocation=(batches,quantity)=>{let remaining=Math.max(0,Number(quantity||0));return batches.flatMap((batch)=>{if(remaining<=0)return[];const take=Math.min(remaining,Number(batch.remaining||0));remaining-=take;return take>0?[{...batch,take}]:[]})};

function Inventory(){
  const {currentUser}=useAuth();
  const {confirm,notify}=useFeedback();
  const location=useLocation();
  const {
    inventory,suppliers,stores,currentStore,currentStoreId,uiPreferences,setUiPreferences,generateBarcode,
    effectiveWorkspaceSettings:workspaceSettings,businessFeatures,addActivityLog,getStoreStock,commitInventoryAdjustment,commitInventoryReceipt,commitInventoryTransferCreate,commitInventoryTransferTransition,commitInventoryCountSubmit,commitInventoryCountReview,hasPermission,
    inventoryTransfers,stockMovements,inventoryCounts,
  }=useStore();
  const canAdjust=hasPermission("inventoryAdjust",currentUser?.appRole);
  const canViewTransfers=hasPermission("transferView",currentUser?.appRole);
  const canCreateTransfer=hasPermission("transferCreate",currentUser?.appRole);
  const canApproveTransfer=hasPermission("transferApprove",currentUser?.appRole);
  const canReceiveTransfer=hasPermission("transferReceive",currentUser?.appRole);
  const canCancelTransfer=hasPermission("transferCancel",currentUser?.appRole);
  const canApproveCount=hasPermission("inventoryCountApprove",currentUser?.appRole);
  const [tab,setTab]=useState("stock");
  const changeTab=(next)=>{setOperationError("");setTab(next)};
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [category,setCategory]=useState("all");
  const [receiveOpen,setReceiveOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [receive,setReceive]=useState(emptyReceive);
  const [receiveScannerOpen,setReceiveScannerOpen]=useState(false);
  const [quickRows,setQuickRows]=useState([emptyQuickRow()]);
  const [quickImportNotice,setQuickImportNotice]=useState("");
  const [quickExpectedTotal,setQuickExpectedTotal]=useState(0);
  const [quickMeta,setQuickMeta]=useState({supplierId:"",payment:"paid",paidAmount:"",invoiceNo:"",dueDate:"",note:"",newSupplierName:"",newSupplierPhone:""});
  const [documentOpen,setDocumentOpen]=useState(false);
  const [documentLoading,setDocumentLoading]=useState(false);
  const [documentResults,setDocumentResults]=useState([]);
  const [documentRows,setDocumentRows]=useState([]);
  const [documentNotice,setDocumentNotice]=useState("");
  const [expandedDocuments,setExpandedDocuments]=useState({});
  const [mappingTarget,setMappingTarget]=useState(null);
  const [mappingDraft,setMappingDraft]=useState({});
  const [formError,setFormError]=useState("");
  const [counts,setCounts]=useState({});
  const [transferForm,setTransferForm]=useState({to:"",productId:"",qty:""});
  const [transferItems,setTransferItems]=useState([]);
  const [receivingTransfer,setReceivingTransfer]=useState(null);
  const [transferReceiveQty,setTransferReceiveQty]=useState({});
  const [transferDifferenceReason,setTransferDifferenceReason]=useState("");
  const [operationError,setOperationError]=useState("");
  const [movementSearch,setMovementSearch]=useState("");
  const [movementType,setMovementType]=useState("all");
  const {visible:movementColumns,toggle:toggleMovementColumn,show:showMovementColumn}=usePersistentColumns(
    `zenix_inventory_movement_columns:${currentUser?.organizationId||"workspace"}`,
    movementColumnDefs,
    {required:[]}
  );
  const [adjustment,setAdjustment]=useState(null);
  const [adjustQty,setAdjustQty]=useState("");
  const [adjustReason,setAdjustReason]=useState("");
  const receiveBaselineRef=useRef(JSON.stringify(emptyReceive));
  const quickBaselineRef=useRef(JSON.stringify({rows:[emptyQuickRow()],meta:{supplierId:"",payment:"paid",paidAmount:"",invoiceNo:"",dueDate:"",note:"",newSupplierName:"",newSupplierPhone:""}}));
  const receiveDirty=receiveOpen&&JSON.stringify(receive)!==receiveBaselineRef.current;
  const quickDirty=quickOpen&&JSON.stringify({rows:quickRows,meta:quickMeta})!==quickBaselineRef.current;
  const guardReceiveClose=useUnsavedGuard(receiveDirty);
  const guardQuickClose=useUnsavedGuard(quickDirty);
  const closeReceive=()=>guardReceiveClose(()=>{setReceiveOpen(false);setFormError("")});
  const closeQuick=()=>guardQuickClose(()=>{setQuickOpen(false);setFormError("");setQuickImportNotice("")});
  const openReceiveForm=(next=emptyReceive)=>{const value={...emptyReceive,...next};setReceive(value);receiveBaselineRef.current=JSON.stringify(value);setFormError("");setReceiveOpen(true)};
  const openQuickForm=()=>{const rows=[emptyQuickRow()];const meta={supplierId:"",payment:"paid",paidAmount:"",invoiceNo:"",dueDate:"",note:"",newSupplierName:"",newSupplierPhone:""};setQuickRows(rows);setQuickMeta(meta);quickBaselineRef.current=JSON.stringify({rows,meta});setQuickImportNotice("");setQuickExpectedTotal(0);setFormError("");setQuickOpen(true)};
  const mappingProfileKey=String(currentUser?.organizationId||"workspace");
  const readMappingProfiles=()=>uiPreferences?.receiveMappings?.[mappingProfileKey]||{};
  const saveMappingProfile=(id,value)=>{if(!id)return;setUiPreferences((previous)=>({...previous,receiveMappings:{...(previous?.receiveMappings||{}),[mappingProfileKey]:{...(previous?.receiveMappings?.[mappingProfileKey]||{}),[id]:value}}}))};

  useEffect(()=>{
    const mode=new URLSearchParams(location.search).get("receive");
    if(!canAdjust)return;
    if(mode==="1"){
      setTab("receive");
      const productId=new URLSearchParams(location.search).get("product");
      const product=inventory.find((item)=>item.id===productId);
      if(product)openReceiveForm({productId:product.id,barcode:product.barcode||"",name:product.name,sku:product.sku||"",category:product.category||"",brand:product.brand||"",unit:product.unit||"dona",costPrice:String(product.costPrice||""),sellPrice:String(product.sellPrice||product.price||"")});
      else openReceiveForm();
    }
    if(mode==="quick"){setTab("receive");openQuickForm()}
  },[location.search,canAdjust,inventory]);

  const otherStores=stores.filter((store)=>store.active!==false&&store.id!==currentStoreId);
  const categories=[...new Set(inventory.map((product)=>product.category).filter(Boolean))];
  const filtered=useMemo(()=>inventory.filter((product)=>!product.archived&&`${product.name} ${product.sku||""} ${product.barcode||""}`.toLowerCase().includes(search.toLowerCase())&&(category==="all"||product.category===category)&&(status==="all"||(status==="out"&&product.quantity<=0)||(status==="low"&&product.quantity>0&&product.quantity<=product.minStock)||(status==="ok"&&product.quantity>product.minStock))),[inventory,search,category,status]);
  const stockedPositions=inventory.filter((product)=>!product.archived&&Number(product.quantity)>0).length;
  const value=inventory.filter((product)=>!product.archived).reduce((sum,product)=>sum+Number(product.quantity||0)*Number(product.costPrice||0),0);
  const low=inventory.filter((product)=>!product.archived&&product.quantity>0&&product.quantity<=product.minStock).length;
  const out=inventory.filter((product)=>!product.archived&&product.quantity<=0).length;
  const movements=stockMovements.filter((movement)=>!movement.storeId||movement.storeId===currentStoreId);
  const movementTypes=useMemo(()=>[...new Set(movements.map((movement)=>movement.type).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"uz")),[movements]);
  const visibleMovements=useMemo(()=>{
    const query=movementSearch.trim().toLowerCase();
    return movements.filter((movement)=>{
      if(movementType!=="all"&&movement.type!==movementType)return false;
      if(!query)return true;
      return `${movement.product||""} ${movement.type||""} ${movement.reason||""} ${movement.user||""} ${movement.date||""}`.toLowerCase().includes(query);
    });
  },[movements,movementSearch,movementType]);
  const transfers=inventoryTransfers.filter((transfer)=>transfer.fromStoreId===currentStoreId||transfer.toStoreId===currentStoreId);
  const pendingCounts=inventoryCounts.filter((count)=>count.storeId===currentStoreId&&["PENDING","CONFLICT"].includes(count.status));
  const receiveTotal=Math.max(0,Number(receive.qty||0))*Math.max(0,Number(receive.costPrice||0));
  const receiveSettlement=paymentAmounts(receiveTotal,receive);
  const quickDocumentTotal=quickRows.reduce((sum,row)=>sum+Math.max(0,Number(row.qty||0))*Math.max(0,Number(row.costPrice||0)),0);
  const quickSettlement=paymentAmounts(quickDocumentTotal,quickMeta);

  const submitReceive=async()=>{
    if(!canAdjust)return;
    setFormError("");
    const existing=inventory.find((item)=>item.id===receive.productId)||inventory.find((item)=>receive.barcode&&String(item.barcode||"")===String(receive.barcode));
    if(!receive.productId&&receive.barcode&&isBarcodeDuplicate(inventory,receive.barcode)){setFormError("Bu shtrix-kod katalogda allaqachon mavjud. Topish tugmasi orqali mavjud mahsulotni tanlang.");return}
    if(!existing&&!receive.name.trim()){setFormError("Yangi mahsulot uchun nomini kiriting.");return}
    if(Number(receive.qty||0)<=0){setFormError("Kirim miqdorini kiriting.");return}
    const total=Math.max(0,Number(receive.qty||0))*Math.max(0,Number(receive.costPrice||existing?.costPrice||0));
    if(businessFeatures.supplierTracking&&receive.supplierId==="__new__"&&!receive.newSupplierName.trim()){setFormError("Yangi ta’minotchi nomini kiriting.");return}
    if(businessFeatures.supplierTracking&&receive.payment==="partial"){
      const paid=Math.max(0,Number(receive.paidAmount||0));
      if(paid<=0||paid>=total){setFormError("Qisman to‘lov summasi 0 dan katta va jami summadan kichik bo‘lishi kerak.");return}
    }
    const result=await commitInventoryReceipt({
      lines:[receive],
      meta:businessFeatures.supplierTracking?receive:{...receive,supplierId:"",newSupplierName:"",newSupplierPhone:""},
      activity:{type:"inventory",title:"Omborga kirim",description:`${existing?.name||receive.name} · +${Number(receive.qty)} ${existing?.unit||receive.unit||"dona"}`},
    });
    if(!result.success){setFormError(result.message||"Kirimni saqlab bo‘lmadi.");return}
    const product=result.products?.[0];
    setReceive(emptyReceive);setReceiveOpen(false);setTab("stock");
    notify({tone:"success",title:"Kirim qabul qilindi",message:`${product?.name||receive.name} · +${Number(receive.qty)} ${product?.unit||receive.unit||"dona"}`});
  };

  const selectReceiveProduct=(id)=>{
    const product=inventory.find((item)=>item.id===id);
    if(!product){setReceive((state)=>({...state,productId:""}));return}
    setReceive((state)=>({...state,productId:product.id,barcode:product.barcode||"",name:product.name,sku:product.sku||"",category:product.category||"",brand:product.brand||"",unit:product.unit||"dona",costPrice:String(product.costPrice||""),sellPrice:String(product.sellPrice||product.price||"")}));
  };

  const lookupReceiveBarcode=(rawCode=receive.barcode)=>{
    const barcode=String(rawCode||"").trim();
    if(!barcode){setFormError("Qidirish uchun shtrix-kodni kiriting yoki kamerada skanerlang.");return false}
    const product=inventory.find((item)=>String(item.barcode||"").trim()===barcode);
    if(product){selectReceiveProduct(product.id);setFormError("");return true}
    setReceive((state)=>({...state,productId:"",barcode,sku:state.sku||`BC-${barcode}`}));
    setFormError("Bu shtrix-kod bo‘yicha mahsulot topilmadi. Yangi mahsulot ma’lumotlarini kiriting — kod saqlanib qoladi.");
    return false;
  };
  const generateReceiveBarcode=async()=>{
    const result=await generateBarcode();
    if(!result.success){setFormError(result.message);return}
    const barcode=result.barcode;
    setFormError("");
    setReceive((state)=>({...state,productId:"",barcode,sku:state.sku?.trim()?state.sku:`BC-${barcode}`}));
  };

  const mapDocumentTable=(table,fileName="",forcedMapping=null)=>{
    const headers=table?.headers||[];
    const mapping=forcedMapping||mapReceiveHeaders(headers);
    if(mapping.name<0&&mapping.barcode<0&&mapping.sku<0)return[];
    return (table?.rows||[]).flatMap((raw,index)=>{
      const get=(field)=>mapping[field]>=0?cellToText(raw[mapping[field]],{identifier:["barcode","sku"].includes(field)}).trim():"";
      const barcode=get("barcode"),sku=get("sku"),name=get("name");
      const product=inventory.find((item)=>barcode&&String(item.barcode||"")===barcode)
        ||inventory.find((item)=>sku&&String(item.sku||"").toLowerCase()===sku.toLowerCase())
        ||inventory.find((item)=>name&&String(item.name||"").toLowerCase()===name.toLowerCase());
      if(!product&&!name&&!barcode&&!sku)return[];
      const qty=csvNumber(get("qty")),costPrice=csvNumber(get("costPrice")),sellPrice=csvNumber(get("sellPrice"));
      const missing=[];
      if(!product&&!name)missing.push("nomi");
      if(qty<=0)missing.push("miqdor");
      if(costPrice<=0)missing.push("tannarx");
      return [{
        id:crypto.randomUUID(),sourceFile:fileName,sourceRow:index+2,
        productId:product?.id||"",barcode:product?.barcode||barcode,name:product?.name||name,sku:product?.sku||sku,
        category:product?.category||get("category"),brand:product?.brand||get("brand"),unit:product?.unit||get("unit")||"dona",
        qty:qty?String(qty):"",costPrice:String(costPrice||product?.costPrice||""),sellPrice:String(sellPrice||product?.sellPrice||product?.price||""),
        importStatus:missing.length?"review":product?"matched":"new",missing,
      }];
    });
  };

  const normalizeImportedRows=(rows=[])=>{
    const normalized=[];
    const strongIndex=new Map();
    const weakIndex=new Map();
    rows.forEach((raw)=>{
      const row={...raw,missing:[...(raw.missing||[])]};
      const strongKey=row.productId?`id:${row.productId}`:row.barcode?`barcode:${String(row.barcode).trim()}`:row.sku?`sku:${String(row.sku).trim().toLowerCase()}`:"";
      const weakKey=!strongKey&&row.name?`name:${String(row.name).trim().toLowerCase()}`:"";
      if(strongKey&&strongIndex.has(strongKey)){
        const target=normalized[strongIndex.get(strongKey)];
        const sameCost=Number(target.costPrice||0)===Number(row.costPrice||0);
        const sameSell=Number(target.sellPrice||0)===Number(row.sellPrice||0);
        if(sameCost&&sameSell){
          target.qty=String(Number(target.qty||0)+Number(row.qty||0));
          target.mergedRows=Number(target.mergedRows||1)+1;
          return;
        }
        const warning="takror mahsulot — narxlarni tekshiring";
        if(!target.missing.includes(warning))target.missing.push(warning);
        target.importStatus="review";
        if(!row.missing.includes(warning))row.missing.push(warning);
        row.importStatus="review";
      }else if(weakKey&&weakIndex.has(weakKey)){
        const target=normalized[weakIndex.get(weakKey)];
        const warning="bir xil nomli qator — mahsulotni tekshiring";
        if(!target.missing.includes(warning))target.missing.push(warning);
        target.importStatus="review";
        if(!row.missing.includes(warning))row.missing.push(warning);
        row.importStatus="review";
      }
      const nextIndex=normalized.length;
      normalized.push(row);
      if(strongKey&&!strongIndex.has(strongKey))strongIndex.set(strongKey,nextIndex);
      if(weakKey&&!weakIndex.has(weakKey))weakIndex.set(weakKey,nextIndex);
    });
    return normalized;
  };

  const enrichLooseRows=(rows,fileName="")=>(rows||[]).map((raw,index)=>{
    const barcode=String(raw.barcode||"").trim(),sku=String(raw.sku||"").trim(),name=String(raw.name||"").trim();
    const product=inventory.find((item)=>barcode&&String(item.barcode||"")===barcode)
      ||inventory.find((item)=>sku&&String(item.sku||"").toLowerCase()===sku.toLowerCase())
      ||inventory.find((item)=>name&&String(item.name||"").toLowerCase()===name.toLowerCase());
    const missing=[...(raw.missing||[])];
    if(!product&&!name&&!missing.includes("nomi"))missing.push("nomi");
    if(Number(raw.qty||0)<=0&&!missing.includes("miqdor"))missing.push("miqdor");
    if(Number(raw.costPrice||0)<=0&&!missing.includes("tannarx"))missing.push("tannarx");
    return {
      ...raw,id:crypto.randomUUID(),sourceFile:fileName,sourceRow:index+1,
      productId:product?.id||"",barcode:product?.barcode||barcode,name:product?.name||name,sku:product?.sku||sku,
      category:product?.category||raw.category||"",brand:product?.brand||raw.brand||"",unit:product?.unit||raw.unit||"dona",
      costPrice:String(raw.costPrice||product?.costPrice||""),sellPrice:String(raw.sellPrice||product?.sellPrice||product?.price||""),
      importStatus:missing.length?"review":product?"matched":"new",missing,
    };
  });

  const applyRememberedMapping=(result)=>{
    if(result?.status!=="parsed"||!result.table)return result;
    const profiles=readMappingProfiles();
    const profileId=mappingProfileId(result);
    const saved=profileId?profiles[profileId]:null;
    const auto=mapReceiveHeaders(result.table.headers||[]);
    const remembered=saved?resolveSavedMapping(result.table.headers||[],saved):null;
    const mapping=remembered&&Object.values(remembered).some((value)=>value>=0)?{...auto,...Object.fromEntries(Object.entries(remembered).filter(([,value])=>value>=0))}:auto;
    return {...result,mapping,profileId,mappingRemembered:Boolean(saved),rows:normalizeImportedRows(mapDocumentTable(result.table,result.fileName,mapping))};
  };

  const openColumnMapping=(result)=>{
    const headers=result?.table?.headers||[];
    if(!headers.length)return;
    const current=result.mapping||mapReceiveHeaders(headers);
    setMappingTarget(result);
    setMappingDraft(Object.fromEntries(receiveMappingFields.map(([field])=>[field,String(current[field]??-1)])));
  };

  const saveColumnMapping=()=>{
    if(!mappingTarget?.table)return;
    const headers=mappingTarget.table.headers||[];
    const numeric=Object.fromEntries(receiveMappingFields.map(([field])=>[field,Number(mappingDraft[field]??-1)]));
    const profileId=mappingProfileId(mappingTarget);
    if(profileId)saveMappingProfile(profileId,serializeMapping(headers,numeric));
    setDocumentResults((items)=>items.map((item)=>item.id===mappingTarget.id?{...item,mapping:numeric,profileId,mappingRemembered:Boolean(profileId),rows:normalizeImportedRows(mapDocumentTable(item.table,item.fileName,numeric))}:item));
    setMappingTarget(null);setMappingDraft({});
    setDocumentNotice("Ustunlar moslandi. Bu ta’minotchi yoki shu fayl formati keyingi importlarda avtomatik taniladi.");
  };

  const handleDocumentFiles=async(files)=>{
    const list=Array.from(files||[]);
    if(!list.length)return;
    setDocumentLoading(true);setDocumentNotice("");setFormError("");
    try{
      const analyzed=await analyzeImportFiles(list);
      const enriched=analyzed.map((result)=>{
        if(result.status==="parsed")return applyRememberedMapping(result);
        if(result.status==="parsed_text")return {...result,rows:normalizeImportedRows(enrichLooseRows(result.rows,result.fileName))};
        return result;
      });
      setDocumentResults(enriched);
      setExpandedDocuments({});
      const parsed=enriched.filter((item)=>["parsed","parsed_text"].includes(item.status));
      const rows=parsed.flatMap((item)=>item.rows||[]);
      setDocumentRows(rows);
      const ready=rows.filter((row)=>row.importStatus!=="review").length;
      const review=rows.filter((row)=>row.importStatus==="review").length;
      const recognition=enriched.filter((item)=>item.status==="recognition_required").length;
      const serverRequired=enriched.filter((item)=>item.status==="server_required").length;
      const manual=enriched.filter((item)=>item.status==="review_text").length;
      setDocumentNotice(`${enriched.length} ta fayl qabul qilindi · ${rows.length} ta qator aniqlandi${rows.length?` · ${ready} tayyor · ${review} tekshirish kerak`:""}${recognition?` · ${recognition} ta fayl OCR tahlilini kutmoqda`:""}${serverRequired?` · ${serverRequired} ta fayl server tahlilini kutmoqda`:""}${manual?` · ${manual} ta matnli faylni qo‘lda tekshirish kerak`:""}`);
    }finally{setDocumentLoading(false)}
  };

  const removeDocumentResult=(id)=>{
    setDocumentResults((items)=>items.filter((item)=>item.id!==id));
    setExpandedDocuments((current)=>{const next={...current};delete next[id];return next});
  };

  const toggleDocumentExpanded=(id)=>setExpandedDocuments((current)=>({...current,[id]:!current[id]}));

  const openDocumentInQuick=(result)=>{
    const rows=result?.rows||[];
    if(!rows.length)return;
    setQuickRows(rows.map(({importStatus,missing,confidence,sourceFile,sourceRow,...row})=>({...row,id:crypto.randomUUID()})));
    setQuickImportNotice(`${result.fileName}: ${rows.length} ta qator ko‘rib chiqishdan Tezkor kirimga o‘tkazildi. Tasdiqlashdan oldin miqdor va narxlarni tekshiring.`);
    setQuickExpectedTotal(Math.max(0,Number(result.meta?.total||0)));
    const detectedSupplier=String(result.meta?.supplier||"").trim();
    const matchedSupplier=detectedSupplier?suppliers.find((item)=>String(item.name||"").trim().toLowerCase()===detectedSupplier.toLowerCase()):null;
    setQuickMeta((meta)=>({
      ...meta,
      invoiceNo:meta.invoiceNo||result.meta?.invoiceNo||String(result.fileName||"").replace(/\.[^.]+$/,""),
      supplierId:matchedSupplier?.id||meta.supplierId||(detectedSupplier?"__new__":""),
      newSupplierName:matchedSupplier?meta.newSupplierName:(detectedSupplier||meta.newSupplierName),
      payment:Number(result.meta?.paid||0)>0&&Number(result.meta?.total||0)>Number(result.meta?.paid||0)?"partial":Number(result.meta?.debt||0)>0?"credit":meta.payment,
      paidAmount:Number(result.meta?.paid||0)>0?String(result.meta.paid):meta.paidAmount,
    }));
    const blankRows=[emptyQuickRow()];const blankMeta={supplierId:"",payment:"paid",paidAmount:"",invoiceNo:"",dueDate:"",note:"",newSupplierName:"",newSupplierPhone:""};quickBaselineRef.current=JSON.stringify({rows:blankRows,meta:blankMeta});setDocumentOpen(false);setQuickOpen(true);
  };

  const submitQuick=async()=>{
    if(!canAdjust)return;
    setFormError("");
    if(businessFeatures.supplierTracking&&quickMeta.supplierId==="__new__"&&!quickMeta.newSupplierName.trim()){setFormError("Yangi ta’minotchi nomini kiriting.");return}
    const validRows=quickRows.filter((row)=>Number(row.qty||0)>0&&(row.productId||row.name?.trim()));
    if(validRows.length!==quickRows.length){setFormError("Har bir qatorga mahsulot nomi va 0 dan katta miqdor kiriting.");return}
    if(validRows.some((row)=>!Number.isFinite(Number(row.costPrice))||Number(row.costPrice)<=0)){
      setFormError("Omborga kirim uchun har bir mahsulotning tannarxini 0 dan katta qilib tasdiqlang.");return;
    }
    const seen=new Set();
    for(const row of validRows){
      const key=row.productId?`id:${row.productId}`:row.barcode?.trim()?`barcode:${row.barcode.trim()}`:`sku:${String(row.sku||row.name||"").trim().toLowerCase()}`;
      if(seen.has(key)){setFormError("Bir mahsulot Tezkor kirimda ikki marta kiritilgan. Miqdorlarni bitta qatorda birlashtiring.");return}
      if(!row.productId&&row.barcode&&isBarcodeDuplicate(inventory,row.barcode)){setFormError(`${row.name||row.barcode}: bu shtrix-kod katalogda allaqachon mavjud.`);return}
      seen.add(key);
    }
    const documentTotal=validRows.reduce((sum,row)=>sum+Math.max(0,Number(row.qty||0))*Math.max(0,Number(row.costPrice||0)),0);
    if(quickImportNotice){
      const mismatch=quickExpectedTotal>0&&Math.abs(quickExpectedTotal-documentTotal)>Math.max(1,quickExpectedTotal*0.001);
      const accepted=await confirm({
        title:mismatch?"Hujjat jami bilan kirim jami farq qiladi":"Hujjatdagi qiymatlarni tasdiqlaysizmi?",
        message:mismatch
          ?`Hujjat: ${formatPrice(quickExpectedTotal)}. Kirim: ${formatPrice(documentTotal)}. Mahsulotlar, miqdor va tannarxni tekshirmasdan saqlamang.`
          :`${validRows.length} ta mahsulot, jami ${formatPrice(documentTotal)}. Hujjatdan olingan qiymatlar qo‘lda tekshirilganini tasdiqlang.`,
        confirmLabel:"Tekshirdim, saqlash",cancelLabel:"Bekor qilish",tone:mismatch?"danger":"primary",
      });
      if(!accepted)return;
    }
    if(businessFeatures.supplierTracking&&quickMeta.payment==="partial"){
      const paid=Math.max(0,Number(quickMeta.paidAmount||0));
      if(paid<=0||paid>=documentTotal){setFormError("Qisman to‘lov summasi 0 dan katta va jami summadan kichik bo‘lishi kerak.");return}
    }
    const meta=businessFeatures.supplierTracking?quickMeta:{...quickMeta,supplierId:"",newSupplierName:"",newSupplierPhone:""};
    const result=await commitInventoryReceipt({
      lines:validRows.map((row)=>({...row,...quickMeta})),meta,
      activity:{type:"inventory",title:"Tezkor kirim",description:`${validRows.length} ta mahsulot · ${quickMeta.invoiceNo||"bitta kirim hujjati"}`},
    });
    if(!result.success){setFormError(result.message||"Kirimni saqlab bo‘lmadi.");return}
    setQuickRows([emptyQuickRow()]);setQuickImportNotice("");setQuickExpectedTotal(0);setQuickMeta({supplierId:"",payment:"paid",paidAmount:"",invoiceNo:"",dueDate:"",note:"",newSupplierName:"",newSupplierPhone:""});setQuickOpen(false);setTab("stock");
    notify({tone:"success",title:"Tezkor kirim qabul qilindi",message:`${result.accepted} ta mahsulot`});
  };

  const setQuickProduct=(rowId,productId)=>setQuickRows((rows)=>rows.map((row)=>{
    if(row.id!==rowId)return row;
    const product=inventory.find((item)=>item.id===productId);
    return product?{...row,productId:product.id,name:product.name,barcode:product.barcode||"",sku:product.sku||"",category:product.category||"",unit:product.unit||"dona",costPrice:String(product.costPrice||""),sellPrice:String(product.sellPrice||product.price||"")}:{...emptyQuickRow(),id:row.id};
  }));
  const updateQuick=(id,patch)=>setQuickRows((rows)=>rows.map((row)=>row.id===id?{...row,...patch}:row));
  const generateQuickBarcode=async(rowId)=>{
    const reserved=quickRows.filter((row)=>row.id!==rowId&&row.barcode).map((row)=>row.barcode);
    const result=await generateBarcode({reserved});
    if(!result.success){setFormError(result.message);return}
    const barcode=result.barcode;
    setFormError("");
    setQuickRows((rows)=>rows.map((row)=>row.id===rowId?{...row,productId:"",barcode,sku:row.sku?.trim()?row.sku:`BC-${barcode}`}:row));
  };

  const openAdjustment=(product)=>{if(!canAdjust)return;setAdjustment(product);setAdjustQty("");setAdjustReason("")};
  const saveAdjustment=async(direction)=>{
    if(!canAdjust||!adjustment||Number(adjustQty||0)<=0||!adjustReason.trim())return;
    const amount=Number(adjustQty);const before=getStoreStock(adjustment.id,currentStoreId);const delta=direction==="in"?amount:-amount;
    if(delta<0&&workspaceSettings.inventory.blockNegativeStock&&amount>before){setOperationError("Omborda yetarli qoldiq yo‘q");return}
    const result=await commitInventoryAdjustment({productId:adjustment.id,storeId:currentStoreId,delta,reason:adjustReason,allowNegative:workspaceSettings.inventory.blockNegativeStock===false});
    if(!result.success){setOperationError(result.message||"Qoldiqni yangilab bo‘lmadi");return}
    setOperationError("");setAdjustment(null);
    notify({tone:"success",title:"Qoldiq yangilandi",message:`${adjustment.name}: ${result.movement.before} → ${result.movement.after}`});
  };


  const addTransferItem=()=>{
    if(!canCreateTransfer||!businessFeatures.stockTransfers)return;
    const product=inventory.find((item)=>item.id===transferForm.productId);
    const tracking=productTracking(product,currentStoreId);
    const rawAmount=Number(transferForm.qty||0);
    const amount=tracking.isSerialTracked?Math.floor(rawAmount):rawAmount;
    if(!product||amount<=0){setOperationError("Mahsulot va to‘g‘ri miqdorni tanlang");return}
    const already=Number(transferItems.find((item)=>item.productId===product.id)?.qty||0);
    if(amount+already>getStoreStock(product.id,currentStoreId)){setOperationError(`${product.name}: omborda yetarli qoldiq yo‘q`);return}
    setTransferItems((items)=>{const found=items.find((item)=>item.productId===product.id);return found?items.map((item)=>item.productId===product.id?{...item,qty:Number(item.qty||0)+amount}:item):[...items,{productId:product.id,product:product.name,sku:product.sku,qty:amount,unit:product.unit||"dona"}]});
    setTransferForm((form)=>({...form,productId:"",qty:""}));setOperationError("");
  };
  const submitTransfer=async()=>{
    if(!canCreateTransfer||!businessFeatures.stockTransfers||!transferItems.length)return;
    const needsApproval=workspaceSettings.inventory.transferApproval!==false&&!canApproveTransfer;
    setOperationError("");
    const result=await commitInventoryTransferCreate({toStoreId:transferForm.to,items:transferItems,needsApproval});
    if(!result.success){setOperationError(result.message||"Transferni yaratib bo‘lmadi");return}
    setTransferItems([]);setTransferForm({to:"",productId:"",qty:""});
    notify({tone:"success",title:needsApproval?"Transfer tasdiqlashga yuborildi":"Transfer jo‘natildi",message:`${result.transfer.itemCount} ta mahsulot · ${result.transfer.to}`});
  };

  const openTransferReceipt=(transfer)=>{
    const items=transfer.items?.length?transfer.items:[{productId:transfer.productId,product:transfer.product,qty:transfer.qty}];
    setReceivingTransfer(transfer);
    setTransferReceiveQty(Object.fromEntries(items.map((item)=>[item.productId,String(item.qty||0)])));
    setTransferDifferenceReason("");
    setOperationError("");
  };
  const submitTransferReceipt=()=>{
    if(!receivingTransfer)return;
    const items=receivingTransfer.items?.length?receivingTransfer.items:[{productId:receivingTransfer.productId,product:receivingTransfer.product,qty:receivingTransfer.qty}];
    const hasDifference=items.some((item)=>Math.max(0,Number(transferReceiveQty[item.productId]||0))!==Math.max(0,Number(item.qty||0)));
    if(hasDifference&&!transferDifferenceReason.trim()){setOperationError("Kam yoki ortiq qabul qilingan bo‘lsa, farq sababini yozing.");return}
    updateTransfer(receivingTransfer.id,"RECEIVED",{receivedQuantities:transferReceiveQty,differenceReason:transferDifferenceReason.trim()});
    setReceivingTransfer(null);setTransferReceiveQty({});setTransferDifferenceReason("");
  };

  const requestTransferReject=async(transfer)=>{
    const accepted=await confirm({title:transfer.status==="IN_TRANSIT"?"Transferni bekor qilish":"Transferni rad etish",message:`${transferDisplayLabel(transfer)}. ${transfer.status==="IN_TRANSIT"?"Jo‘natilgan qoldiq manba filialga qaytariladi.":"Transfer tasdiqlanmaydi."}`,confirmLabel:transfer.status==="IN_TRANSIT"?"Bekor qilish":"Rad etish",cancelLabel:"Ortga",tone:"danger"});
    if(accepted)updateTransfer(transfer.id,"REJECTED");
  };

  const updateTransfer=async(id,next,receivePayload=null)=>{
    const transfer=inventoryTransfers.find((item)=>item.id===id);if(!transfer)return;
    if(next==="IN_TRANSIT"&&(!canApproveTransfer||!["PENDING","Draft"].includes(transfer.status)))return;
    if(next==="RECEIVED"&&(!canReceiveTransfer||!["IN_TRANSIT","In Transit"].includes(transfer.status)))return;
    if(next==="REJECTED"&&!canCancelTransfer)return;
    setOperationError("");
    const result=await commitInventoryTransferTransition({
      transferId:id,nextStatus:next,
      receivedQuantities:receivePayload?.receivedQuantities||null,
      differenceReason:receivePayload?.differenceReason||"",
    });
    if(!result.success){setOperationError(result.message||"Transfer holatini yangilab bo‘lmadi");return}
    notify({tone:result.transfer.status==="RECEIVED_WITH_DIFFERENCE"?"warning":"success",title:next==="IN_TRANSIT"?"Transfer tasdiqlandi":next==="RECEIVED"?(result.transfer.status==="RECEIVED_WITH_DIFFERENCE"?"Farq bilan qabul qilindi":"Transfer qabul qilindi"):"Transfer bekor qilindi",message:transferDisplayLabel(transfer)});
  };

  const submitRevision=async()=>{
    if(!canAdjust)return;
    const changes=Object.entries(counts).flatMap(([id,value])=>{
      if(value==="")return[];
      const product=inventory.find((item)=>item.id===id);
      const before=getStoreStock(id,currentStoreId);
      const after=Math.max(0,Number(value));
      if(!product||after===before)return[];
      return[{productId:product.id,product:product.name,storeId:currentStoreId,before,after,delta:after-before}];
    });
    if(!changes.length)return;
    const requireApproval=workspaceSettings.inventory.countApproval!==false&&!canApproveCount;
    setOperationError("");
    const result=await commitInventoryCountSubmit({changes,requireApproval,storeId:currentStoreId,storeName:currentStore?.name});
    if(!result.success){setOperationError(result.message||"Inventarizatsiyani saqlab bo‘lmadi");return}
    setCounts({});
    notify({tone:"success",title:requireApproval?"Tasdiqlashga yuborildi":"Inventarizatsiya saqlandi",message:`${changes.length} ta farq`});
  };
  const approveCount=async(count)=>{
    if(!canApproveCount)return;
    setOperationError("");
    const result=await commitInventoryCountReview({countId:count.id,decision:"approve"});
    if(result.conflict){setOperationError(result.message);return}
    if(!result.success){setOperationError(result.message||"Inventarizatsiyani tasdiqlab bo‘lmadi");return}
    notify({tone:"success",title:"Inventarizatsiya tasdiqlandi",message:`${count.changes.length} ta farq`});
  };
  const rejectCount=async(count)=>{
    if(!canApproveCount)return;
    const result=await commitInventoryCountReview({countId:count.id,decision:"reject"});
    if(!result.success){setOperationError(result.message||"Inventarizatsiyani rad etib bo‘lmadi");return}
    notify({tone:"success",title:"Inventarizatsiya rad etildi",message:count.status==="CONFLICT"?"Qayta sanash uchun tekshiruv yopildi.":"Inventarizatsiya tekshiruvi rad etildi."});
  };


  const statusLabel=(value)=>({PENDING:"Tasdiq kutilmoqda",IN_TRANSIT:"Yo‘lda",Received:"Qabul qilindi",RECEIVED:"Qabul qilindi",RECEIVED_WITH_DIFFERENCE:"Farq bilan qabul qilindi",Rejected:"Rad etildi",REJECTED:"Rad etildi",Draft:"Tayyor"}[value]||value);
  const statusTone=(value)=>["RECEIVED","Received"].includes(value)?"success":value==="RECEIVED_WITH_DIFFERENCE"?"warning":["REJECTED","Rejected"].includes(value)?"danger":["IN_TRANSIT","In Transit"].includes(value)?"info":value==="PENDING"?"warning":"neutral";

  return <div className="pro-page inventory-pro">
    <PageHeader title="Ombor" subtitle="Tovar keldi — shu yerda kirim qiling. Mahsulot yangi bo‘lsa Zenix POS uni avtomatik katalogga ham yaratadi." actions={canAdjust&&<><button className="pro-btn secondary" onClick={()=>{setTab("revision");setCounts({})}}><FiClipboard/> Inventarizatsiya</button><button className="pro-btn secondary" onClick={()=>{setTab("receive");openQuickForm()}}><FiPackage/> Tezkor kirim</button><button className="pro-btn primary" onClick={()=>{setTab("receive");openReceiveForm()}}><FiPlus/> Kirim</button></>}/>
    {!canAdjust&&<div className="pro-alert info">Sizda ombor qoldig‘ini o‘zgartirish huquqi yo‘q. Ma’lumotlarni ko‘rish mumkin, amallar bloklangan.</div>}

    <div className="pro-stat-grid"><StatCard icon={FiPackage} label="Qoldiqdagi pozitsiyalar" value={stockedPositions} hint={`${inventory.filter((product)=>!product.archived).length} ta katalog mahsuloti`} tone="blue"/><StatCard icon={FiBox} label="Ombor qiymati" value={formatPrice(value)} hint="O‘rtacha tannarx bo‘yicha" tone="green"/><StatCard icon={FiAlertTriangle} label="Kam qolgan" value={low} hint="Minimal qoldiqdan past" tone="orange"/><StatCard icon={FiArchive} label="Tugagan" value={out} hint="Qoldiq 0" tone="red"/></div>

    <div className="inventory-tabs pro-tabs"><button className={tab==="stock"?"active":""} onClick={()=>changeTab("stock")}>Qoldiq</button><button className={tab==="receive"?"active":""} onClick={()=>changeTab("receive")}>Kirim</button>{businessFeatures.stockTransfers&&canViewTransfers&&<button className={tab==="transfers"?"active":""} onClick={()=>changeTab("transfers")}>Transferlar</button>}<button className={tab==="revision"?"active":""} onClick={()=>changeTab("revision")}>Inventarizatsiya</button><button className={tab==="history"?"active":""} onClick={()=>changeTab("history")}>Harakatlar</button></div>

    {tab==="stock"&&<section className="pro-card"><div className="pro-toolbar"><div className="pro-search"><FiSearch/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Mahsulot, SKU yoki shtrix-kod..."/></div><PremiumSelect className="pro-select" value={category} onChange={(event)=>setCategory(event.target.value)}><option value="all">Barcha kategoriyalar</option>{categories.map((item)=><option key={item}>{item}</option>)}</PremiumSelect><PremiumSelect className="pro-select" value={status} onChange={(event)=>setStatus(event.target.value)}><option value="all">Barcha holatlar</option><option value="ok">Mavjud</option><option value="low">Kam qolgan</option><option value="out">Tugagan</option></PremiumSelect></div><div className={`inventory-card-grid cols-${uiPreferences.inventoryColumns||3}`}>{filtered.length?filtered.map((product)=>{const tone=product.quantity<=0?"danger":product.quantity<=product.minStock?"warning":"success";return <article className="inventory-card-pro" key={product.id}><div className="inv-card-top"><div className="inv-icon"><FiPackage/></div><StatusBadge tone={tone}>{product.quantity<=0?"Tugagan":product.quantity<=product.minStock?"Kam qolgan":"Mavjud"}</StatusBadge></div><h3>{product.name}</h3><span className="inv-sku">{product.sku}{product.barcode?` · ${product.barcode}`:""}</span><div className="inv-qty"><strong>{product.quantity}</strong><span>{product.unit||"dona"}</span><div className="stock-mini"><i style={{width:`${Math.min(100,product.minStock?Math.round(product.quantity/(product.minStock*3)*100):100)}%`}}/></div></div><div className="inv-details"><span><small>O‘rtacha tannarx</small><b>{formatPrice(product.costPrice)}</b></span><span><small>Qoldiq qiymati</small><b>{formatPrice(product.costPrice*product.quantity)}</b></span><span><small>Minimal qoldiq</small><b>{product.minStock} {product.unit||"dona"}</b></span><span><small>Ta’minotchi</small><b>{product.supplier||"—"}</b></span></div><div className="inv-actions">{canAdjust&&<><button onClick={()=>openReceiveForm({productId:product.id,barcode:product.barcode||"",name:product.name,sku:product.sku||"",category:product.category||"",brand:product.brand||"",unit:product.unit||"dona",costPrice:String(product.costPrice||""),sellPrice:String(product.sellPrice||product.price||"")})}><FiPlus/> Kirim</button><button onClick={()=>openAdjustment(product)}><FiRefreshCw/> Tuzatish</button></>}</div></article>}):<div className="pro-empty full-grid"><FiPackage/><strong>Mahsulot topilmadi</strong><span>Filtr yoki qidiruvni o‘zgartiring.</span></div>}</div></section>}

    {tab==="receive"&&<section className="pro-card receive-hub"><div className="pro-card-head"><div><h2>Tovarni qabul qilish</h2><p>Yangi mahsulotni alohida katalogga kiritish shart emas — kirimning o‘zida yarating.</p></div></div><div className="receive-choice-grid"><button onClick={()=>openReceiveForm()} disabled={!canAdjust}><span className="receive-choice-icon"><FiPlus/></span><span><strong>Kirim</strong><small>Bitta mahsulotni qabul qilish. Shtrix-kod bilan toping yoki yangi mahsulot yarating.</small></span><FiArrowRight/></button><button onClick={()=>openQuickForm()} disabled={!canAdjust}><span className="receive-choice-icon"><FiPackage/></span><span><strong>Tezkor kirim</strong><small>Bir nechta mahsulotni bitta nakladnoy bilan tez qabul qiling.</small></span><FiArrowRight/></button><button onClick={()=>{setDocumentResults([]);setDocumentRows([]);setExpandedDocuments({});setDocumentNotice("");setDocumentOpen(true)}} disabled={!canAdjust}><span className="receive-choice-icon"><FiFileText/></span><span><strong>Hujjatdan import</strong><small>PDF, Excel, CSV, Word yoki rasmni yuklang. Avval ko‘rib chiqiladi, keyin kirimga o‘tadi.</small></span><FiArrowRight/></button></div><div className="receive-help"><FiTruck/><span><strong>Ta’minotchi va hisob-kitob ham shu yerda</strong><small>To‘liq, qisman yoki qarzga to‘lovni belgilang. Bitta nakladnoydagi mahsulotlar bitta hujjat sifatida saqlanadi.</small></span></div></section>}

    {tab==="transfers"&&canViewTransfers&&<div className="inventory-transfer-layout"><section className="pro-card transfer-builder"><div className="pro-card-head"><div><h2>Yangi transfer</h2><p>Bitta hujjatda bir nechta mahsulotni boshqa filialga jo‘nating.</p></div><StatusBadge tone="info">{currentStore?.name}</StatusBadge></div>{!canCreateTransfer&&<div className="pro-alert info">Siz transferlarni ko‘ra olasiz, lekin yangi transfer yaratish huquqi yo‘q.</div>}<div className="pro-form-grid"><label className="pro-field full"><span>Qabul qiluvchi filial</span><PremiumSelect disabled={!canCreateTransfer||!otherStores.length} value={transferForm.to} onChange={(event)=>setTransferForm({...transferForm,to:event.target.value})}><option value="">{otherStores.length?"Filialni tanlang":"Boshqa faol filial yo‘q"}</option>{otherStores.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</PremiumSelect></label><label className="pro-field"><span>Mahsulot</span><PremiumSelect disabled={!canCreateTransfer} value={transferForm.productId} onChange={(event)=>setTransferForm({...transferForm,productId:event.target.value})}><option value="">Tanlang</option>{inventory.filter((product)=>product.quantity>0&&!product.archived).map((product)=><option key={product.id} value={product.id}>{product.name} · {product.quantity} {product.unit||"dona"}</option>)}</PremiumSelect></label><label className="pro-field"><span>Miqdor</span><div className="transfer-qty-action"><input disabled={!canCreateTransfer} type="number" min="1" value={transferForm.qty} onChange={(event)=>setTransferForm({...transferForm,qty:event.target.value})}/><button className="pro-btn secondary" type="button" disabled={!transferForm.productId||Number(transferForm.qty)<=0} onClick={addTransferItem}>Qo‘shish</button></div></label></div>{(()=>{const product=inventory.find((item)=>item.id===transferForm.productId);const tracking=productTracking(product,currentStoreId);if(!product||(!tracking.isBatchTracked&&!tracking.isSerialTracked))return null;if(tracking.isBatchTracked){const allocation=previewBatchAllocation(tracking.batches,transferForm.qty);return <div className="pro-alert info tracked-stock-hint"><strong>Partiyali mahsulot</strong><span>Transfer FEFO/FIFO bo‘yicha avtomatik ajratiladi: {allocation.length?allocation.map((row)=>`${row.batchNo||"Partiya"}: ${row.take}`).join(" · "):"miqdorni kiriting"}.</span></div>}return <div className="pro-alert info tracked-stock-hint"><strong>Serial/IMEI mahsulot</strong><span>{Math.max(0,Math.floor(Number(transferForm.qty||0)))} ta birlik uchun mavjud seriallar avtomatik ajratiladi. Miqdor butun son bo‘lishi kerak.</span></div>})()}{workspaceSettings.inventory.transferApproval!==false&&!canApproveTransfer&&<div className="pro-alert info">Transfer tasdiqlash ruxsatiga ega foydalanuvchi tasdiqlagandan keyin ombordan chiqadi.</div>}{operationError&&<div className="pro-alert danger">{operationError}</div>}<div className="transfer-draft-items">{transferItems.length?transferItems.map((item)=><div key={item.productId}><span><strong>{item.product}</strong><small>{item.sku||"SKU yo‘q"}</small></span><b>{item.qty} {item.unit}</b><button className="pro-icon-btn" onClick={()=>setTransferItems((items)=>items.filter((row)=>row.productId!==item.productId))} aria-label="Transferdan olib tashlash"><FiX/></button></div>):<div className="transfer-draft-empty"><FiPackage/><span>Transferga mahsulot qo‘shing</span></div>}</div><div className="transfer-builder-footer"><span><small>Mahsulot</small><strong>{transferItems.length}</strong></span><span><small>Jami birlik</small><strong>{transferItems.reduce((sum,item)=>sum+Number(item.qty||0),0)}</strong></span><button className="pro-btn primary transfer-submit" disabled={!canCreateTransfer||!otherStores.length||!transferForm.to||!transferItems.length} onClick={submitTransfer}>Transfer yaratish</button></div></section><section className="pro-card transfer-list-card"><div className="pro-card-head"><div><h2>Transferlar</h2><p>Tasdiq → Yo‘lda → Qabul qilindi</p></div></div><div className="transfer-list">{transfers.length?transfers.map((transfer)=>{const items=transfer.items?.length?transfer.items:[{product:transfer.product,qty:transfer.qty}];return <div key={transfer.id} className="transfer-row transfer-row-pro"><div className="transfer-row-main"><div className="transfer-row-head"><span><strong>{transferDisplayLabel(transfer)}</strong><small>{transfer.from} → {transfer.to}</small></span><StatusBadge tone={statusTone(transfer.status)}>{statusLabel(transfer.status)}</StatusBadge></div><div className="transfer-item-summary">{items.slice(0,3).map((item,index)=><span key={`${transfer.id}-${item.productId||index}`}>{item.product} <b>× {item.qty}</b></span>)}{items.length>3&&<em>+{items.length-3} mahsulot</em>}</div><small className="transfer-meta">{formatWorkspaceDate(transfer.createdAt,workspaceSettings.organization,{withTime:true})} · {transfer.createdBy||"Foydalanuvchi"}</small></div><div className="transfer-row-actions">{["PENDING","Draft"].includes(transfer.status)&&canApproveTransfer&&transfer.fromStoreId===currentStoreId&&<button onClick={()=>updateTransfer(transfer.id,"IN_TRANSIT")}><FiCheck/> Tasdiqlash</button>}{["PENDING","Draft"].includes(transfer.status)&&canCancelTransfer&&transfer.fromStoreId===currentStoreId&&<button className="danger" onClick={()=>requestTransferReject(transfer)}><FiX/> Rad etish</button>}{["IN_TRANSIT","In Transit"].includes(transfer.status)&&canReceiveTransfer&&transfer.toStoreId===currentStoreId&&<button onClick={()=>openTransferReceipt(transfer)}>Qabul qilish</button>}{["IN_TRANSIT","In Transit"].includes(transfer.status)&&canCancelTransfer&&transfer.fromStoreId===currentStoreId&&<button className="danger" onClick={()=>requestTransferReject(transfer)}>Bekor qilish</button>}</div></div>}):<div className="pro-empty"><FiArchive/><strong>Transferlar yo‘q</strong><span>Yangi transferlar shu yerda saqlanadi.</span></div>}</div></section></div>}

    {tab==="revision"&&<section className="pro-card"><div className="pro-card-head"><div><h2>Inventarizatsiya</h2><p>Tizimdagi va real sanalgan qoldiqni solishtiring.</p></div>{canAdjust&&<button className="pro-btn primary" disabled={!Object.keys(counts).length} onClick={submitRevision}><FiCheckCircle/> {workspaceSettings.inventory.countApproval!==false&&!canApproveCount?"Tasdiqlashga yuborish":"Tasdiqlash"}</button>}</div>{pendingCounts.length>0&&<div className="pending-counts"><strong>Inventarizatsiya tekshiruvlari</strong>{pendingCounts.map((count)=><div key={count.id}><span><b>Inventarizatsiya tekshiruvi</b><small>{count.status==="CONFLICT"?`${count.conflicts?.length||0} ta qoldiq sanashdan keyin o‘zgargan`:`${count.createdBy} · ${count.changes.length} ta farq`}</small></span><StatusBadge tone={count.status==="CONFLICT"?"danger":"warning"}>{count.status==="CONFLICT"?"Qayta sanash kerak":"Kutilmoqda"}</StatusBadge>{canApproveCount&&<div>{count.status!=="CONFLICT"&&<button onClick={()=>approveCount(count)}><FiCheck/> Tasdiqlash</button>}<button className="danger" onClick={()=>rejectCount(count)}><FiX/> {count.status==="CONFLICT"?"Yopish":"Rad etish"}</button></div>}</div>)}</div>}{operationError&&<div className="pro-alert danger">{operationError}</div>}<div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Mahsulot</th><th>Tizimda</th><th>Real sanalgan</th><th>Farq</th></tr></thead><tbody>{inventory.filter((product)=>!product.archived).map((product)=>{const currentQty=getStoreStock(product.id,currentStoreId);const real=counts[product.id];const diff=real===""||real===undefined?0:Number(real)-currentQty;return <tr key={product.id}><td data-label="Mahsulot"><strong>{product.name}</strong><small>{product.sku}</small></td><td data-label="Tizimda">{currentQty} {product.unit||"dona"}</td><td data-label="Real sanalgan">{(()=>{const tracking=productTracking(product,currentStoreId);if(tracking.isBatchTracked||tracking.isSerialTracked)return <div className="tracked-count-note"><strong>{tracking.isBatchTracked?"Partiyalar bo‘yicha sanash kerak":"Serial/IMEI bo‘yicha sanash kerak"}</strong><small>{tracking.isBatchTracked?`${tracking.batches.length} ta partiya · jami ${tracking.batches.reduce((sum,row)=>sum+Number(row.remaining||0),0)} ${product.unit||"dona"}`:`${tracking.serials.length} ta serial omborda`}</small></div>;return <input disabled={!canAdjust} className="revision-input" type="number" min="0" value={real??""} onChange={(event)=>setCounts((state)=>({...state,[product.id]:event.target.value}))} placeholder={String(currentQty)}/>})()}</td><td data-label="Farq"><StatusBadge tone={diff===0?"neutral":Math.abs(diff)<=2?"warning":"danger"}>{diff>0?"+":""}{diff}</StatusBadge></td></tr>})}</tbody></table></div></section>}

    {tab==="history"&&<section className="pro-card"><div className="pro-card-head"><div><h2>Qoldiq harakatlari</h2><p>Kirim, tuzatish, transfer va inventarizatsiya izi.</p></div><ColumnPicker columns={movementColumnDefs} visible={movementColumns} onToggle={toggleMovementColumn} label="Ustunlar" menuTitle="Ko‘rinadigan ustunlar"/></div><div className="pro-toolbar inventory-movement-toolbar"><div className="pro-search"><FiSearch/><input value={movementSearch} onChange={(event)=>setMovementSearch(event.target.value)} placeholder="Mahsulot, sabab yoki xodim..."/></div><PremiumSelect className="pro-select" value={movementType} onChange={(event)=>setMovementType(event.target.value)}><option value="all">Barcha amallar</option>{movementTypes.map((type)=><option key={type} value={type}>{type}</option>)}</PremiumSelect></div><div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Sana</th><th>Mahsulot</th>{showMovementColumn("action")&&<th>Amal</th>}{showMovementColumn("before")&&<th>Oldin</th>}{showMovementColumn("after")&&<th>Keyin</th>}{showMovementColumn("reason")&&<th>Sabab</th>}{showMovementColumn("user")&&<th>Xodim</th>}</tr></thead><tbody>{visibleMovements.length?visibleMovements.map((movement)=><tr key={movement.id}><td data-label="Sana">{movement.date}</td><td data-label="Mahsulot"><strong>{movement.product}</strong></td>{showMovementColumn("action")&&<td data-label="Amal"><StatusBadge tone={movement.type.includes("Kirim")||movement.type==="Qo‘shish"?"success":movement.type==="Ayirish"?"danger":"info"}>{movement.type}</StatusBadge></td>}{showMovementColumn("before")&&<td data-label="Oldin">{movement.before??"—"}</td>}{showMovementColumn("after")&&<td data-label="Keyin">{movement.after??"—"}</td>}{showMovementColumn("reason")&&<td data-label="Sabab">{movement.reason||"—"}</td>}{showMovementColumn("user")&&<td data-label="Xodim">{movement.user||"—"}</td>}</tr>):<tr><td colSpan={2+movementColumns.length}><div className="pro-empty"><FiClipboard/><strong>{movements.length?"Harakat topilmadi":"Harakatlar hali yo‘q"}</strong><span>{movements.length?"Qidiruv yoki filtrni o‘zgartirib ko‘ring.":"Kirim va qoldiq o‘zgarishlari shu yerda saqlanadi."}</span></div></td></tr>}</tbody></table></div></section>}

    <BarcodeScannerModal open={receiveScannerOpen} onClose={()=>setReceiveScannerOpen(false)} title="Omborga kirim uchun shtrix-kod" onDetected={(code)=>{setReceive((state)=>({...state,barcode:String(code),productId:""}));lookupReceiveBarcode(code);setReceiveScannerOpen(false)}}/>
    <Modal open={receiveOpen} onClose={closeReceive} title="Omborga kirim" subtitle="Mavjud mahsulotni tanlang yoki barcode orqali yangi mahsulot yarating." size="lg" footer={<><button className="pro-btn secondary" onClick={closeReceive}>Bekor qilish</button><button className="pro-btn primary" onClick={submitReceive}>Kirimni tasdiqlash</button></>}>
      <div className="receive-product-picker"><label className="pro-field full"><span>Mavjud mahsulot</span><PremiumSelect value={receive.productId} onChange={(event)=>selectReceiveProduct(event.target.value)}><option value="">Yangi mahsulot / barcode bilan topish</option>{inventory.filter((product)=>!product.archived).map((product)=><option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</PremiumSelect></label><div className="barcode-receive"><div className="pro-field"><span>Shtrix-kod</span><div className="field-action-row"><input value={receive.barcode} onChange={(event)=>{setReceive({...receive,barcode:event.target.value,productId:""});setFormError("")}} onKeyDown={(event)=>event.key==="Enter"&&lookupReceiveBarcode()} placeholder="Skanerlang yoki kodni kiriting..."/><button type="button" className="pro-btn secondary" onClick={()=>setReceiveScannerOpen(true)}><FiCamera/> Skanerlash</button></div></div><div className="barcode-receive-actions"><button type="button" className="pro-btn secondary" onClick={()=>lookupReceiveBarcode()}><FiSearch/> Topish</button><button type="button" className="pro-btn secondary" onClick={generateReceiveBarcode}>Kod yaratish</button></div></div></div>
      {!receive.productId&&<div className="receive-new-product"><div className="receive-section-title"><strong>Yangi mahsulot</strong><span>Barcode bazada bo‘lmasa shu kirim bilan katalogga ham qo‘shiladi.</span></div><div className="pro-form-grid"><label className="pro-field full"><span>Mahsulot nomi *</span><input data-modal-autofocus value={receive.name} onChange={(event)=>setReceive({...receive,name:event.target.value})}/></label><label className="pro-field"><span>SKU</span><input value={receive.sku} onChange={(event)=>setReceive({...receive,sku:event.target.value})}/></label><label className="pro-field"><span>Brend</span><input value={receive.brand} onChange={(event)=>setReceive({...receive,brand:event.target.value})}/></label><label className="pro-field"><span>Kategoriya</span><input value={receive.category} onChange={(event)=>setReceive({...receive,category:event.target.value})}/></label><label className="pro-field"><span>Birlik</span><PremiumSelect value={receive.unit} onChange={(event)=>setReceive({...receive,unit:event.target.value})}><option>dona</option><option>kg</option><option>litr</option><option>metr</option><option>quti</option></PremiumSelect></label></div>{(businessFeatures.variants||businessFeatures.sizeColor||businessFeatures.weightVolume||businessFeatures.batchExpiry||businessFeatures.serialImei||businessFeatures.warranty)&&<details className="receive-advanced"><summary>Qo‘shimcha mahsulot ma’lumotlari</summary><div className="pro-form-grid">{businessFeatures.variants&&<label className="pro-field"><span>Variant</span><input value={receive.variant} onChange={(event)=>setReceive({...receive,variant:event.target.value})}/></label>}{businessFeatures.sizeColor&&<><label className="pro-field"><span>O‘lcham</span><input value={receive.size} onChange={(event)=>setReceive({...receive,size:event.target.value})}/></label><label className="pro-field"><span>Rang</span><input value={receive.color} onChange={(event)=>setReceive({...receive,color:event.target.value})}/></label></>}{businessFeatures.weightVolume&&<label className="pro-field"><span>Og‘irlik / hajm</span><input value={receive.weight} onChange={(event)=>setReceive({...receive,weight:event.target.value})}/></label>}{businessFeatures.batchExpiry&&<><label className="pro-field"><span>Partiya / batch raqami</span><input value={receive.batchNo} onChange={(event)=>setReceive({...receive,batchNo:event.target.value})}/></label><label className="pro-field"><span>Yaroqlilik muddati</span><PremiumDateInput value={receive.expiry} onChange={(event)=>setReceive({...receive,expiry:event.target.value})}/></label></>}{businessFeatures.serialImei&&<label className="pro-field"><span>Serial / IMEI</span><input placeholder="Bir nechta bo‘lsa vergul bilan" value={receive.serial} onChange={(event)=>setReceive({...receive,serial:event.target.value})}/></label>}{businessFeatures.warranty&&<label className="pro-field"><span>Kafolat</span><input value={receive.warranty} onChange={(event)=>setReceive({...receive,warranty:event.target.value})}/></label>}</div></details>}</div>}
      <div className="receive-section-title"><strong>Kirim ma’lumotlari</strong><span>Miqdor va narxlar</span></div><div className="pro-form-grid"><label className="pro-field"><span>Miqdor *</span><input type="number" min="0" value={receive.qty} onChange={(event)=>setReceive({...receive,qty:event.target.value})}/></label><label className="pro-field"><span>Tannarx *</span><input type="number" min="0" value={receive.costPrice} onChange={(event)=>setReceive({...receive,costPrice:event.target.value})}/></label><label className="pro-field"><span>Sotuv narxi</span><input type="number" min="0" value={receive.sellPrice} onChange={(event)=>setReceive({...receive,sellPrice:event.target.value})}/></label><label className="pro-field"><span>Nakladnoy / hujjat raqami</span><input value={receive.invoiceNo} onChange={(event)=>setReceive({...receive,invoiceNo:event.target.value})}/></label></div>
      {businessFeatures.supplierTracking&&<><div className="receive-section-title"><strong>Ta’minotchi va hisob-kitob</strong><span>Qarz bo‘lsa shu kirim bilan qarz tarixiga yoziladi.</span></div><div className="pro-form-grid"><label className="pro-field"><span>Ta’minotchi</span><PremiumSelect value={receive.supplierId} onChange={(event)=>setReceive({...receive,supplierId:event.target.value})}><option value="">Tanlanmagan</option>{suppliers.filter((supplier)=>!supplier.archived).map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}<option value="__new__">+ Yangi ta’minotchi</option></PremiumSelect></label><label className="pro-field"><span>Hisob-kitob</span><PremiumSelect value={receive.payment} onChange={(event)=>setReceive({...receive,payment:event.target.value,paidAmount:event.target.value==="partial"?receive.paidAmount:""})}><option value="paid">To‘liq to‘langan</option><option value="partial">Qisman to‘langan</option><option value="credit">Qarzga</option></PremiumSelect></label>{receive.payment==="partial"&&<label className="pro-field"><span>To‘langan summa *</span><input type="number" min="0" max={receiveTotal||undefined} value={receive.paidAmount} onChange={(event)=>setReceive({...receive,paidAmount:event.target.value})}/></label>}{receive.supplierId==="__new__"&&<><label className="pro-field"><span>Yangi ta’minotchi nomi *</span><input value={receive.newSupplierName} onChange={(event)=>setReceive({...receive,newSupplierName:event.target.value})}/></label><label className="pro-field"><span>Telefon</span><input value={receive.newSupplierPhone} onChange={(event)=>setReceive({...receive,newSupplierPhone:event.target.value})}/></label></>}{receiveSettlement.balance>0&&<label className="pro-field"><span>Qarz muddati</span><PremiumDateInput value={receive.dueDate} onChange={(event)=>setReceive({...receive,dueDate:event.target.value})}/></label>}</div><div className="receive-settlement-summary"><span><small>Jami</small><strong>{formatPrice(receiveTotal)}</strong></span><span><small>To‘langan</small><strong>{formatPrice(receiveSettlement.paidAmount)}</strong></span><span><small>Qarz</small><strong>{formatPrice(receiveSettlement.balance)}</strong></span></div></>}
      <label className="pro-field full receive-note"><span>Izoh</span><textarea value={receive.note} onChange={(event)=>setReceive({...receive,note:event.target.value})} placeholder="Ixtiyoriy..."/></label>{formError&&<div className="pro-alert danger">{formError}</div>}
    </Modal>

    <Modal open={!!receivingTransfer} onClose={()=>{setReceivingTransfer(null);setOperationError("")}} title="Transferni qabul qilish" subtitle={receivingTransfer?`${transferDisplayLabel(receivingTransfer)} · ${receivingTransfer.from} → ${receivingTransfer.to}`:""} size="lg" footer={<><button className="pro-btn secondary" onClick={()=>setReceivingTransfer(null)}>Bekor qilish</button><button className="pro-btn primary" onClick={submitTransferReceipt}>Qabul qilishni tasdiqlash</button></>}>
      <div className="transfer-receive-list">{(receivingTransfer?.items||[]).map((item)=>{const received=Math.max(0,Number(transferReceiveQty[item.productId]||0));const sent=Math.max(0,Number(item.qty||0));const diff=received-sent;return <div key={item.productId} className="transfer-receive-item"><span><strong>{item.product}</strong><small>Jo‘natilgan: {sent} {item.unit||"dona"}</small></span><label><small>Qabul qilindi</small><input type="number" min="0" value={transferReceiveQty[item.productId]??String(sent)} onChange={(event)=>setTransferReceiveQty((state)=>({...state,[item.productId]:event.target.value}))}/></label><StatusBadge tone={diff===0?"success":"warning"}>{diff===0?"To‘liq":`${diff>0?"+":""}${diff}`}</StatusBadge></div>})}</div>
      {(receivingTransfer?.items||[]).some((item)=>Math.max(0,Number(transferReceiveQty[item.productId]||0))!==Math.max(0,Number(item.qty||0)))&&<label className="pro-field full transfer-difference-reason"><span>Farq sababi *</span><textarea value={transferDifferenceReason} onChange={(event)=>setTransferDifferenceReason(event.target.value)} placeholder="Masalan: yo‘lda shikastlangan, kam jo‘natilgan..."/></label>}
      {operationError&&<div className="pro-alert danger">{operationError}</div>}
    </Modal>

    <Modal open={documentOpen} onClose={()=>setDocumentOpen(false)} title="Hujjatdan import" subtitle="Faylni yuklang — Zenix POS avval tahlil qiladi va ko‘rib chiqish oynasini ko‘rsatadi. Tasdiqsiz ombor o‘zgarmaydi." size="xl">
      <div className="document-import-drop">
        <MultiFilePicker
          busy={documentLoading}
          label="Hujjat yoki fayllarni tanlang"
          hint="PDF, Excel, CSV, Word, TXT, rasm yoki boshqa fayllarni tanlang yoki shu yerga tashlang."
          onChange={handleDocumentFiles}
        />
        <div className="document-import-safety"><FiCheckCircle/><span><strong>Avval ko‘rib chiqish</strong><small>Noaniq yoki yetishmayotgan qiymatlar omborga avtomatik yozilmaydi.</small></span></div>
      </div>
      {documentNotice&&<div className="pro-alert info">{documentNotice}</div>}
      {documentResults.length>0&&<div className="document-batch-summary">
        <span><small>Fayllar</small><strong>{documentResults.length}</strong></span>
        <span><small>O‘qildi</small><strong>{documentResults.filter((item)=>["parsed","parsed_text"].includes(item.status)).length}</strong></span>
        <span><small>Tekshirish</small><strong>{documentResults.reduce((sum,item)=>sum+(item.rows||[]).filter((row)=>row.importStatus==="review").length,0)}</strong></span>
        <span><small>Tashqi tahlil</small><strong>{documentResults.filter((item)=>["recognition_required","server_required"].includes(item.status)).length}</strong></span>
      </div>}
      <div className="document-import-results">{documentResults.length?documentResults.map((result)=>{
        const parsedStatus=["parsed","parsed_text"].includes(result.status);
        const tone=parsedStatus?"success":["recognition_required","review_text","needs_conversion","server_required"].includes(result.status)?"warning":"danger";
        const label=parsedStatus?"O‘qildi":result.status==="recognition_required"?"OCR kerak":result.status==="server_required"?"Server tahlili":result.status==="review_text"?"Matnni tekshiring":result.status==="needs_conversion"?"Konvertatsiya kerak":"O‘qilmadi";
        const rows=result.rows||[];
        const reviewRows=rows.filter((row)=>row.importStatus==="review");
        const visibleRows=expandedDocuments[result.id]?rows:rows.slice(0,8);
        return <article key={result.id} className={`document-import-result ${reviewRows.length?"has-review":""}`}>
          <div className="document-result-head"><span className="document-file-icon"><FiFileText/></span><span><strong>{result.fileName}</strong><small>{result.kind.toUpperCase()} · {Math.max(1,Math.round(result.size/1024))} KB</small></span><StatusBadge tone={tone}>{label}</StatusBadge><button type="button" className="document-remove-btn" onClick={()=>removeDocumentResult(result.id)} aria-label="Faylni ro‘yxatdan olib tashlash"><FiX/></button></div>
          {(result.meta?.supplier||result.meta?.invoiceNo||result.meta?.total||result.meta?.paid||result.meta?.debt)&&<div className="document-detected-meta">{result.meta?.supplier&&<span><small>Ta’minotchi</small><b>{result.meta.supplier}</b></span>}{result.meta?.invoiceNo&&<span><small>Hujjat</small><b>{result.meta.invoiceNo}</b></span>}{Number(result.meta?.total||0)>0&&<span><small>Jami</small><b>{formatPrice(result.meta.total)}</b></span>}{Number(result.meta?.paid||0)>0&&<span><small>To‘langan</small><b>{formatPrice(result.meta.paid)}</b></span>}{Number(result.meta?.debt||0)>0&&<span><small>Qarz</small><b>{formatPrice(result.meta.debt)}</b></span>}</div>}
          {parsedStatus?<>
            <div className="document-result-summary"><span><b>{rows.length}</b><small>qator</small></span><span><b>{rows.filter((row)=>row.importStatus==="matched").length}</b><small>katalogdan topildi</small></span><span><b>{rows.filter((row)=>row.importStatus==="new").length}</b><small>yangi</small></span><span><b>{reviewRows.length}</b><small>tekshirish kerak</small></span></div>
            {reviewRows.length>0&&<div className="document-file-warning"><FiAlertTriangle/><span><strong>{reviewRows.length} ta qator tekshirilishi kerak</strong><small>Noaniq qatorlar tasdiqlanmasdan omborga yozilmaydi. Tezkor kirimda ularni to‘ldiring.</small></span></div>}
            <div className="document-preview-list">{visibleRows.map((row)=><div key={row.id} className={row.importStatus==="review"?"review":""}><StatusBadge tone={row.importStatus==="review"?"warning":row.importStatus==="new"?"info":"success"}>{row.importStatus==="review"?"Tekshiring":row.importStatus==="new"?"Yangi":"Topildi"}</StatusBadge><span><strong>{row.name||row.barcode||row.sku||"Nomsiz qator"}{row.mergedRows>1?` · ${row.mergedRows} qator birlashtirildi`:""}</strong><small>{row.missing?.length?`Tekshiring: ${row.missing.join(", ")}`:`${row.qty||"—"} ${row.unit||"dona"} · ${formatPrice(row.costPrice||0)}`}</small></span></div>)}</div>
            {rows.length>8&&<button type="button" className="document-expand-btn" onClick={()=>toggleDocumentExpanded(result.id)}>{expandedDocuments[result.id]?"Qisqartirish":`Barcha ${rows.length} qatorni ko‘rish`}</button>}
            <div className="document-result-actions">{result.status==="parsed"&&<button type="button" className="pro-btn secondary" onClick={()=>openColumnMapping(result)}>{result.mappingRemembered?"Ustun mosligini o‘zgartirish":"Ustunlarni moslash"}</button>}<button type="button" className="pro-btn primary document-use-btn" disabled={!rows.length} onClick={()=>openDocumentInQuick(result)}>{reviewRows.length?"Tezkor kirimda tekshirish":"Kirimga tayyorlash"}</button></div>
          </>:<>
            <div className="document-recognition-message"><FiAlertTriangle/><span>{result.message}</span></div>
            {result.extractedText&&<details className="document-text-preview"><summary>Ajratilgan matnni ko‘rish</summary><pre>{String(result.extractedText).slice(0,6000)}</pre></details>}
          </>}
        </article>
      }):<div className="pro-empty"><FiUpload/><strong>Fayl yuklanmagan</strong><span>Bir yoki bir nechta hujjatni tanlang. Zenix POS formatini o‘zi aniqlaydi.</span></div>}</div>
    </Modal>

    <Modal open={!!mappingTarget} onClose={()=>{setMappingTarget(null);setMappingDraft({})}} title="Ustunlarni moslash" subtitle={`${mappingTarget?.meta?.supplier||mappingTarget?.fileName||"Hujjat"} · bir marta moslang, keyingi importlarda Zenix POS eslab qoladi.`} size="lg" footer={<><button className="pro-btn secondary" onClick={()=>{setMappingTarget(null);setMappingDraft({})}}>Bekor qilish</button><button className="pro-btn primary" onClick={saveColumnMapping}>Moslashni saqlash</button></>}>
      <div className="document-mapping-note"><FiCheckCircle/><span><strong>Ta’minotchi formatini eslab qolish</strong><small>Majburiy maydonlar: mahsulot (nom/SKU/shtrix-kod), miqdor va tannarx. Noma’lum ustunni “Tanlanmagan” qoldiring.</small></span></div>
      <div className="document-mapping-grid">{receiveMappingFields.map(([field,label])=><label className="pro-field" key={field}><span>{label}</span><PremiumSelect value={mappingDraft[field]??"-1"} onChange={(event)=>setMappingDraft((current)=>({...current,[field]:event.target.value}))}><option value="-1">Tanlanmagan</option>{(mappingTarget?.table?.headers||[]).map((header,index)=><option key={`${field}-${index}`} value={String(index)}>{header||`Ustun ${index+1}`}</option>)}</PremiumSelect></label>)}</div>
    </Modal>

    <Modal open={quickOpen} onClose={closeQuick} title="Tezkor kirim" subtitle="Bir nechta mahsulotni bitta operatsiyada qabul qiling." size="xl" footer={<><button className="pro-btn secondary" onClick={closeQuick}>Bekor qilish</button><button className="pro-btn primary" onClick={submitQuick}>Barchasini qabul qilish</button></>}>
      {quickImportNotice&&<div className="pro-alert success">{quickImportNotice}</div>}
      <div className="quick-receive-meta">{businessFeatures.supplierTracking&&<><label className="pro-field"><span>Ta’minotchi</span><PremiumSelect value={quickMeta.supplierId} onChange={(event)=>setQuickMeta({...quickMeta,supplierId:event.target.value})}><option value="">Tanlanmagan</option>{suppliers.filter((supplier)=>!supplier.archived).map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}<option value="__new__">+ Yangi ta’minotchi</option></PremiumSelect></label><label className="pro-field"><span>Hisob-kitob</span><PremiumSelect value={quickMeta.payment} onChange={(event)=>setQuickMeta({...quickMeta,payment:event.target.value,paidAmount:event.target.value==="partial"?quickMeta.paidAmount:""})}><option value="paid">To‘liq to‘langan</option><option value="partial">Qisman to‘langan</option><option value="credit">Qarzga</option></PremiumSelect></label></>}<label className="pro-field"><span>Nakladnoy / hujjat raqami</span><input value={quickMeta.invoiceNo} onChange={(event)=>setQuickMeta({...quickMeta,invoiceNo:event.target.value})}/></label>{businessFeatures.supplierTracking&&quickMeta.payment==="partial"&&<label className="pro-field"><span>To‘langan summa *</span><input type="number" min="0" max={quickDocumentTotal||undefined} value={quickMeta.paidAmount} onChange={(event)=>setQuickMeta({...quickMeta,paidAmount:event.target.value})}/></label>}{businessFeatures.supplierTracking&&quickSettlement.balance>0&&<label className="pro-field"><span>Qarz muddati</span><PremiumDateInput value={quickMeta.dueDate} onChange={(event)=>setQuickMeta({...quickMeta,dueDate:event.target.value})}/></label>}</div>{businessFeatures.supplierTracking&&quickMeta.supplierId==="__new__"&&<div className="quick-new-supplier"><label className="pro-field"><span>Yangi ta’minotchi *</span><input value={quickMeta.newSupplierName} onChange={(event)=>setQuickMeta({...quickMeta,newSupplierName:event.target.value})}/></label><label className="pro-field"><span>Telefon</span><input value={quickMeta.newSupplierPhone} onChange={(event)=>setQuickMeta({...quickMeta,newSupplierPhone:event.target.value})}/></label></div>}{businessFeatures.supplierTracking&&<div className="receive-settlement-summary quick-settlement"><span><small>Jami</small><strong>{formatPrice(quickDocumentTotal)}</strong></span><span><small>To‘langan</small><strong>{formatPrice(quickSettlement.paidAmount)}</strong></span><span><small>Qarz</small><strong>{formatPrice(quickSettlement.balance)}</strong></span></div>}
      <div className="quick-receive-table"><div className="quick-receive-head"><span>Mahsulot</span><span>Yangi nomi</span><span>Shtrix-kod</span><span>Miqdor / birlik</span><span>Tannarx</span><span>Sotuv</span><i/></div>{quickRows.map((row)=><div className="quick-receive-row" key={row.id}><PremiumSelect value={row.productId} onChange={(event)=>setQuickProduct(row.id,event.target.value)}><option value="">+ Yangi mahsulot</option>{inventory.filter((product)=>!product.archived).map((product)=><option key={product.id} value={product.id}>{product.name}</option>)}</PremiumSelect><input disabled={!!row.productId} value={row.name} onChange={(event)=>updateQuick(row.id,{name:event.target.value})} placeholder="Yangi mahsulot nomi"/><div className="quick-barcode-cell"><input disabled={!!row.productId} value={row.barcode} onChange={(event)=>updateQuick(row.id,{barcode:event.target.value,sku:event.target.value?`BC-${event.target.value}`:row.sku})} placeholder="Shtrix-kod"/><button type="button" disabled={!!row.productId} onClick={()=>generateQuickBarcode(row.id)}>Yaratish</button></div><div style={{display:"flex",gap:4,alignItems:"center",minWidth:0}}><input style={{minWidth:0,flex:1}} type="number" min="0" step="any" value={row.qty} onChange={(event)=>updateQuick(row.id,{qty:event.target.value})} placeholder="0"/><PremiumSelect aria-label="O‘lchov birligi" disabled={!!row.productId} style={{width:82,flexShrink:0}} value={row.unit||"dona"} onChange={(event)=>updateQuick(row.id,{unit:event.target.value})}>{["dona","kg","g","litr","ml","mg","metr","m²","quti","paket"].map(unit=><option key={unit} value={unit}>{unit}</option>)}</PremiumSelect></div><input type="number" min="0" value={row.costPrice} onChange={(event)=>updateQuick(row.id,{costPrice:event.target.value})} placeholder="0"/><input type="number" min="0" value={row.sellPrice} onChange={(event)=>updateQuick(row.id,{sellPrice:event.target.value})} placeholder="0"/><button disabled={quickRows.length===1} onClick={()=>setQuickRows((rows)=>rows.filter((item)=>item.id!==row.id))}><FiX/></button></div>)}</div><button className="pro-btn secondary quick-add-row" onClick={()=>setQuickRows((rows)=>[...rows,emptyQuickRow()])}><FiPlus/> Yana qator</button>{formError&&<div className="pro-alert danger">{formError}</div>}
    </Modal>

    <Modal open={!!adjustment} onClose={()=>setAdjustment(null)} title="Qoldiqni tuzatish" subtitle={adjustment?.name} size="sm"><div className="pro-form-grid"><label className="pro-field full"><span>Miqdor *</span><input data-modal-autofocus type="number" min="1" value={adjustQty} onChange={(event)=>setAdjustQty(event.target.value)}/></label><label className="pro-field full"><span>Sabab *</span><textarea value={adjustReason} onChange={(event)=>setAdjustReason(event.target.value)} placeholder="Masalan: buzilgan, qayta sanaldi..."/></label></div><div className="adjustment-actions"><button className="pro-btn secondary" onClick={()=>saveAdjustment("in")}>+ Qo‘shish</button><button className="pro-btn danger" onClick={()=>saveAdjustment("out")}>− Ayirish</button></div></Modal>
  </div>;
}

export default Inventory;
