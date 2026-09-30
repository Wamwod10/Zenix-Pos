import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiArchive, FiBox, FiDownload, FiEdit2, FiGrid, FiList, FiPackage, FiPlus,
  FiRotateCcw, FiSearch, FiZap, FiEye, FiImage,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { useFeedback } from "../../context/FeedbackContext";
import { ROLES } from "../../config/roles";
import { formatPrice } from "../../utils/formatPrice";
import { isBarcodeDuplicate } from "../../utils/barcode";
import { ColumnPicker, EmptyState, FilePicker, PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumCheckbox } from "../../components/Ui";
import Modal from "../../components/Modal";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { buildFieldChanges } from "../../utils/auditChanges";
import { deleteLocalFile, readLocalFile, saveLocalFile } from "../../services/fileStore";
import "./product.scss";

const productAuditFields = [
  {key:"name",label:"Nomi"},{key:"sku",label:"SKU"},{key:"barcode",label:"Shtrix-kod"},
  {key:"category",label:"Kategoriya"},{key:"unit",label:"Birlik"},{key:"minStock",label:"Minimal qoldiq"},
  {key:"sellPrice",label:"Sotuv narxi"},{key:"wholesalePrice",label:"Ulgurji narx"},{key:"brand",label:"Brend"},
  {key:"variant",label:"Variant"},{key:"size",label:"O‘lcham"},{key:"color",label:"Rang"},
  {key:"weight",label:"Og‘irlik"},{key:"warranty",label:"Kafolat"},{key:"imageName",label:"Rasm"},
];

const emptyForm = {
  name:"", sku:"", barcode:"", category:"", unit:"dona", minStock:"5",
  sellPrice:"", wholesalePrice:"", brand:"", variant:"", size:"",
  color:"", weight:"", warranty:"",
  imageKey:"", imageName:"",
};

function ProductThumb({ product, className="" }){
  const [src,setSrc]=useState("");
  useEffect(()=>{
    let active=true;
    let objectUrl="";
    if(!product?.imageKey){setSrc("");return()=>{};}
    readLocalFile(product.imageKey).then((file)=>{
      if(!active||!file)return;
      objectUrl=URL.createObjectURL(file);
      setSrc(objectUrl);
    }).catch(()=>setSrc(""));
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[product?.imageKey]);
  return <span className={`product-thumb ${src?"has-image":""} ${className}`.trim()}>{src?<img src={src} alt=""/>:<FiPackage/>}</span>;
}

function Products(){
  const { confirm, undo, notify } = useFeedback();
  const { currentUser } = useAuth();
  const {
    inventory, generateBarcode, saveProduct, setProductArchived, patchProducts, businessFeatures, uiPreferences, setUiPreferences, effectiveWorkspaceSettings:workspaceSettings,
    hasPermission, addActivityLog, stores, currentStoreId, getStoreStock, stockMovements,
  } = useStore();
  const location=useLocation();
  const navigate=useNavigate();
  const formBaselineRef=useRef(JSON.stringify(emptyForm));

  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("active");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(emptyForm);
  const [errors,setErrors]=useState({});
  const [saving,setSaving]=useState(false);
  const [imageFile,setImageFile]=useState(null);
  const [imageRemoved,setImageRemoved]=useState(false);
  const [imagePreview,setImagePreview]=useState("");

  const [scanOpen,setScanOpen]=useState(false);
  const [scanCode,setScanCode]=useState("");
  const [scanResult,setScanResult]=useState(null);
  const [detailProduct,setDetailProduct]=useState(null);
  const [selectedIds,setSelectedIds]=useState([]);

  const canEdit=hasPermission("productWrite",currentUser?.appRole);
  const canReceive=hasPermission("inventoryAdjust",currentUser?.appRole);
  const branchLocked=[ROLES.CASHIER,ROLES.SALES,ROLES.WAREHOUSE].includes(currentUser?.appRole);
  const stockVisibleStores=stores.filter((store)=>store.active!==false&&(!branchLocked||store.id===currentStoreId));
  const hasAnyStock=(productId)=>stores.some((store)=>getStoreStock(productId,store.id)>0);
  const formDirty=Boolean(modal)&&(JSON.stringify(form)!==formBaselineRef.current||Boolean(imageFile)||imageRemoved);
  const guardFormClose=useUnsavedGuard(formDirty);
  const closeForm=()=>guardFormClose(()=>setModal(false));

  const openCreate=(prefill={})=>{
    if(!canEdit)return;
    const nextForm={...emptyForm,minStock:String(workspaceSettings.inventory.defaultLowStock??5),...prefill};
    setEditing(null);
    setForm(nextForm);
    setImageFile(null);setImageRemoved(false);setImagePreview("");
    formBaselineRef.current=JSON.stringify(nextForm);
    setErrors({});
    setModal(true);
  };
  const openEdit=(product)=>{
    if(!canEdit)return;
    const nextForm={
      ...emptyForm,
      name:product.name||"", sku:product.sku||"", barcode:String(product.barcode??""),
      category:product.category||"", unit:product.unit||"dona", minStock:String(product.minStock??5),
      sellPrice:String(product.sellPrice??product.price??0), wholesalePrice:String(product.wholesalePrice??0),
      brand:product.brand||"", variant:product.variant||"", size:product.size||"", color:product.color||"",
      weight:product.weight||"", warranty:product.warranty||"", imageKey:product.imageKey||"", imageName:product.imageName||"",
    };
    setEditing(product);
    setForm(nextForm);
    setImageFile(null);setImageRemoved(false);setImagePreview("");
    formBaselineRef.current=JSON.stringify(nextForm);
    setErrors({});
    setModal(true);
  };

  useEffect(()=>{
    let active=true;
    let objectUrl="";
    if(!modal||imageRemoved){setImagePreview("");return()=>{};}
    if(imageFile){
      objectUrl=URL.createObjectURL(imageFile);
      setImagePreview(objectUrl);
      return()=>{if(objectUrl)URL.revokeObjectURL(objectUrl)};
    }
    if(!form.imageKey){setImagePreview("");return()=>{};}
    readLocalFile(form.imageKey).then((file)=>{
      if(!active||!file)return;
      objectUrl=URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }).catch(()=>setImagePreview(""));
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[modal,form.imageKey,imageFile,imageRemoved]);

  useEffect(()=>{
    if(new URLSearchParams(location.search).get("new")==="1"&&canEdit)openCreate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[location.search]);

  const filtered=useMemo(()=>inventory.filter((product)=>(status==="archived"?product.archived:!product.archived)
    && `${product.name} ${product.sku} ${product.barcode} ${product.category} ${product.brand}`.toLowerCase().includes(search.toLowerCase())),[inventory,status,search]);
  const categories=useMemo(()=>[...new Set(inventory.map((product)=>String(product.category||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"uz")),[inventory]);
  const categoryCount=categories.length;
  const low=inventory.filter((product)=>!product.archived&&product.quantity>0&&product.quantity<=product.minStock).length;
  const out=inventory.filter((product)=>!product.archived&&product.quantity<=0).length;
  const productColumnDefs=[
    {id:"sku",label:"SKU / Shtrix-kod"},{id:"category",label:"Kategoriya"},{id:"price",label:"Sotuv narxi"},{id:"stock",label:"Qoldiq"},{id:"status",label:"Holat"},
  ];
  const productColumnsControl=usePersistentColumns("zenix_product_columns",productColumnDefs,{initialVisible:uiPreferences.productColumns||productColumnDefs.map((column)=>column.id)});
  const {visible:productColumns,toggle:toggleProductColumn,orderedVisibleDefinitions:orderedProductColumns,columnStyle:productColumnStyle}=productColumnsControl;
  const allVisibleSelected=filtered.length>0&&filtered.every((product)=>selectedIds.includes(product.id));
  const toggleSelectAll=()=>setSelectedIds(allVisibleSelected?selectedIds.filter((id)=>!filtered.some((product)=>product.id===id)):[...new Set([...selectedIds,...filtered.map((product)=>product.id)])]);
  const toggleSelected=(id)=>setSelectedIds((ids)=>ids.includes(id)?ids.filter((item)=>item!==id):[...ids,id]);
  const selectedIdSet=useMemo(()=>new Set(selectedIds),[selectedIds]);
  const selectedProducts=useMemo(()=>inventory.filter((product)=>selectedIdSet.has(product.id)),[inventory,selectedIdSet]);
  const bulkSetCategory=async(nextCategory)=>{
    if(!canEdit||!selectedProducts.length)return;
    const category=nextCategory==="__none__"?"":nextCategory;
    const before=selectedProducts.map((product)=>({id:product.id,category:product.category||""}));
    const ids=before.map((item)=>item.id);
    const result=await patchProducts(ids,{category});
    if(!result.success){notify({tone:"danger",title:"Kategoriya yangilanmadi",message:result.message});return}
    setSelectedIds([]);
    addActivityLog({type:"product",title:"Mahsulotlar kategoriyasi o‘zgartirildi",description:`${ids.length} ta mahsulot · ${category||"Kategoriyasiz"}`});
    undo({title:"Kategoriya yangilandi",message:`${ids.length} ta mahsulot · ${category||"Kategoriyasiz"}`,onUndo:async()=>{for(const row of before)await patchProducts([row.id],{category:row.category})}});
  };
  const bulkArchive=async()=>{
    if(!canEdit||!selectedProducts.length)return;
    const nextArchived=status!=="archived";
    if(nextArchived){
      const stocked=selectedProducts.filter((product)=>hasAnyStock(product.id));
      if(stocked.length){notify({tone:"warning",title:"Qoldig‘i bor mahsulot arxivlanmaydi",message:`${stocked[0].name}${stocked.length>1?` va yana ${stocked.length-1} ta mahsulot`:""}: avval filiallar bo‘yicha qoldiqni nolga tushiring.`});return}
    }
    const accepted=await confirm({title:nextArchived?"Tanlangan mahsulotlarni arxivlaysizmi?":"Tanlangan mahsulotlarni tiklaysizmi?",message:`${selectedProducts.length} ta mahsulot ${nextArchived?"savdo katalogidan yashiriladi":"yana katalogda ko‘rinadi"}.`,confirmLabel:nextArchived?"Arxivlash":"Tiklash",cancelLabel:"Bekor qilish",tone:nextArchived?"danger":"primary"});
    if(!accepted)return;
    const ids=selectedProducts.map((product)=>product.id);
    const before=selectedProducts.map((product)=>({id:product.id,archived:product.archived}));
    const result=await patchProducts(ids,{archived:nextArchived});
    if(!result.success){notify({tone:"danger",title:"Mahsulotlar yangilanmadi",message:result.message});return}
    setSelectedIds([]);
    addActivityLog({type:"product",title:nextArchived?"Mahsulotlar arxivlandi":"Mahsulotlar tiklandi",description:`${ids.length} ta mahsulot`});
    undo({title:nextArchived?"Mahsulotlar arxivlandi":"Mahsulotlar tiklandi",message:`${ids.length} ta mahsulot`,onUndo:async()=>{for(const row of before)await setProductArchived(row.id,row.archived)}});
  };
  const lastReceiveByProduct=useMemo(()=>{
    const map=new Map();
    for(const item of stockMovements){
      if(!String(item.type||"").includes("Kirim"))continue;
      const key=String(item.productId||"");
      const current=map.get(key);
      const at=Date.parse(item.createdAt||item.dateISO||0)||0;
      if(!current||at>current.at)map.set(key,{item,at});
    }
    return map;
  },[stockMovements]);
  const productById=useMemo(()=>new Map(inventory.map((item)=>[String(item.id),item])),[inventory]);
  const productLastReceive=(productId)=>lastReceiveByProduct.get(String(productId))?.item||null;
  const productLastSale=(productId)=>{
    const product=productById.get(String(productId));
    if(!product?.lastSaleAt)return null;
    const soldAt=new Date(product.lastSaleAt);
    return {createdAt:product.lastSaleAt,dateISO:Number.isNaN(soldAt.getTime())?String(product.lastSaleAt).slice(0,10):soldAt.toISOString().slice(0,10)};
  };

  const validate=()=>{
    const nextErrors={};
    const sku=form.sku.trim();
    const barcode=String(form.barcode??"").trim();
    if(form.name.trim().length<2)nextErrors.name="Mahsulot nomini kiriting";
    if(!sku)nextErrors.sku="SKU majburiy";
    if(inventory.some((product)=>product.id!==editing?.id&&String(product.sku||"").toLowerCase()===sku.toLowerCase()))nextErrors.sku="Bu SKU katalogda allaqachon mavjud";
    if(isBarcodeDuplicate(inventory,barcode,editing?.id))nextErrors.barcode="Bu shtrix-kod allaqachon mavjud";
    if(Number(form.sellPrice)<0)nextErrors.sellPrice="Narx noto‘g‘ri";
    setErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };
  const generateProductBarcode=async()=>{
    const result=await generateBarcode();
    if(!result.success){setErrors((current)=>({...current,barcode:result.message}));return}
    const barcode=result.barcode;
    setErrors((current)=>({...current,barcode:""}));
    setForm((state)=>({...state,barcode,sku:state.sku?.trim()?state.sku:`BC-${barcode}`}));
  };

  const save=async()=>{
    if(saving||!validate())return;
    setSaving(true);
    let nextImageKey=form.imageKey||"";
    let nextImageName=form.imageName||"";
    try{
      if(imageRemoved&&form.imageKey){
        nextImageKey="";nextImageName="";
      }
      if(imageFile){
        nextImageKey=await saveLocalFile(imageFile);
        nextImageName=imageFile.name||"Mahsulot rasmi";
      }
    }catch{
      setErrors((current)=>({...current,image:"Rasmni saqlab bo‘lmadi. Boshqa rasm tanlab ko‘ring."}));
      setSaving(false);
      return;
    }
    const payload={
      name:form.name.trim(), sku:form.sku.trim(), barcode:String(form.barcode??"").trim(),
      category:String(form.category||"").trim(), unit:form.unit||"dona", minStock:Number(form.minStock||0),
      sellPrice:Number(form.sellPrice||0), wholesalePrice:Number(form.wholesalePrice||0), price:Number(form.sellPrice||0),
      brand:String(form.brand||"").trim(), variant:String(form.variant||"").trim(), size:String(form.size||"").trim(),
      color:String(form.color||"").trim(), weight:String(form.weight||"").trim(), warranty:String(form.warranty||"").trim(),
      imageKey:nextImageKey,imageName:nextImageName,archived:editing?.archived??false,
      ...(editing?{}:{quantity:0,stock:0,costPrice:0,stockByStore:{}}),
    };
    const changes=editing?buildFieldChanges(editing,payload,productAuditFields):[];
    const result=await saveProduct({id:editing?.id||null,payload:{...payload,costPrice:editing?.costPrice||0}});
    if(!result.success){
      if(imageFile&&nextImageKey&&nextImageKey!==form.imageKey)deleteLocalFile(nextImageKey).catch(()=>{});
      setSaving(false);setErrors((current)=>({...current,form:result.message}));notify({tone:"danger",title:"Mahsulot saqlanmadi",message:result.message});return;
    }
    if(form.imageKey&&(imageRemoved||imageFile))deleteLocalFile(form.imageKey).catch(()=>{});
    addActivityLog({type:"product",title:editing?"Katalog yozuvi tahrirlandi":"Katalogga mahsulot qo‘shildi",description:payload.name,changes,metadata:{productId:result.product?.id||editing?.id||null}});
    setSaving(false);setImageFile(null);setImageRemoved(false);setImagePreview("");setModal(false);
  };

  const archive=async(product)=>{
    if(!canEdit)return;
    const nextArchived=!product.archived;
    if(nextArchived){
      if(hasAnyStock(product.id)){notify({tone:"warning",title:"Mahsulotni arxivlab bo‘lmaydi",message:"Filiallardan birida qoldiq mavjud. Avval qoldiqni transfer, sotuv yoki inventarizatsiya orqali nolga tushiring."});return}
      const accepted=await confirm({title:"Mahsulotni arxivlaysizmi?",message:`${product.name} savdo katalogidan yashiriladi. Kerak bo‘lsa keyin qayta tiklash mumkin.`,confirmLabel:"Arxivlash",cancelLabel:"Bekor qilish",tone:"danger"});
      if(!accepted)return;
    }
    const result=await setProductArchived(product.id,nextArchived);
    if(!result.success){notify({tone:"danger",title:"Mahsulot holati o‘zgarmadi",message:result.message});return}
    addActivityLog({type:"product",title:nextArchived?"Mahsulot arxivlandi":"Mahsulot tiklandi",description:product.name,before:product.archived?"Arxivda":"Faol",after:nextArchived?"Arxivda":"Faol",changes:[{field:"archived",label:"Holat",before:product.archived?"Arxivda":"Faol",after:nextArchived?"Arxivda":"Faol"}]});
    if(nextArchived)undo({title:"Mahsulot arxivlandi",message:product.name,onUndo:async()=>{await setProductArchived(product.id,false);addActivityLog({type:"product",title:"Arxivlash bekor qilindi",description:product.name})}});
  };

  const exportCsv=()=>{
    const rows=[
      ["Nomi","SKU","Shtrix-kod","Kategoriya","Brend","Birlik","Qoldiq (ma’lumot uchun)","Sotuv narxi","Ulgurji narx"],
      ...inventory.map((product)=>[product.name,product.sku,product.barcode,product.category,product.brand,product.unit,product.quantity,product.sellPrice,product.wholesalePrice]),
    ];
    const csv="\ufeff"+rows.map((row)=>row.map((value)=>`"${String(value??"").replaceAll('"','""')}"`).join(",")).join("\n");
    const link=document.createElement("a");
    link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    link.download="zenix-products.csv";link.click();URL.revokeObjectURL(link.href);
  };

  const lookupBarcode=()=>{
    const barcode=String(scanCode??"").trim();if(!barcode)return;
    const local=inventory.find((product)=>String(product.barcode||"")===barcode);
    if(local){setScanResult({type:"local",product:local});return;}
    setScanResult({type:"new",product:{barcode,sku:`BC-${barcode}`}});
  };
  const createFromScan=()=>{
    const product=scanResult?.product||{};setScanOpen(false);setScanCode("");setScanResult(null);
    openCreate({barcode:String(product.barcode||""),sku:product.sku||`BC-${product.barcode||""}`,name:product.name||"",brand:product.brand||"",category:product.category||"",unit:product.unit||"dona",variant:product.variant||"",size:product.size||"",color:product.color||"",weight:product.weight||""});
  };

  return <div className="pro-page products-pro">
    <PageHeader title="Mahsulotlar" subtitle="Katalogni ko‘ring va boshqaring. Yangi tovar kelganda qoldiq Ombor → Kirim orqali qo‘shiladi." actions={<>
      <button className="pro-btn secondary" onClick={exportCsv}><FiDownload/> CSV eksport</button>
      {canEdit&&<><button className="pro-btn secondary" onClick={()=>setScanOpen(true)}><FiZap/> Shtrix-kod</button><button className="pro-btn secondary" onClick={()=>openCreate()}><FiPlus/> Katalog yozuvi</button></>}
      {canReceive&&<button className="pro-btn primary" onClick={()=>navigate("/inventory?receive=1")}><FiPlus/> Omborga kirim</button>}
    </>}/>

    <div className="product-onboarding-strip"><div><FiGrid/><span><strong>Yangi tovar keldimi?</strong><small>Mahsulot yaratish, tannarx, ta’minotchi va hujjatdan import Ombor → Kirim orqali boshqariladi. Qoldiq Ombor → Kirim orqali boshqariladi.</small></span></div>{canReceive&&<button onClick={()=>navigate("/inventory?receive=1")}>Omborga kirim</button>}</div>

    <div className="pro-stat-grid"><StatCard icon={FiPackage} label="Aktiv mahsulotlar" value={inventory.filter((product)=>!product.archived).length} hint={`${categoryCount} ta kategoriya`} tone="blue"/><StatCard icon={FiBox} label="Qoldiqdagi pozitsiyalar" value={inventory.filter((product)=>!product.archived&&Number(product.quantity||0)>0).length} hint="Joriy filial" tone="green"/><StatCard icon={FiArchive} label="Kam qolgan" value={low} hint="Minimal qoldiqdan past" tone="orange"/><StatCard icon={FiPackage} label="Tugagan" value={out} hint="Qoldiq 0" tone="red"/></div>

    <section className="pro-card"><div className="pro-toolbar product-toolbar"><div className="pro-search"><FiSearch/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Nomi, SKU, shtrix-kod, brend yoki kategoriya..."/></div><div className="product-toolbar-actions"><div className="pro-tabs"><button className={status==="active"?"active":""} onClick={()=>{setStatus("active");setSelectedIds([])}}>Faol</button><button className={status==="archived"?"active":""} onClick={()=>{setStatus("archived");setSelectedIds([])}}>Arxiv</button></div>{uiPreferences.productView==="list"&&<ColumnPicker columns={productColumnDefs} visible={productColumns} order={productColumnsControl.order} widths={productColumnsControl.widths} views={productColumnsControl.views} onToggle={toggleProductColumn} onMove={productColumnsControl.move} onWidth={productColumnsControl.setWidth} onReset={productColumnsControl.reset} onSaveView={productColumnsControl.saveView} onApplyView={productColumnsControl.applyView} onDeleteView={productColumnsControl.deleteView}/>}<div className="product-view-switch" aria-label="Mahsulot ko‘rinishi"><button className={(uiPreferences.productView||"grid")==="grid"?"active":""} onClick={()=>{setUiPreferences({productView:"grid"});setSelectedIds([])}} title="Kartalar"><FiGrid/></button><button className={uiPreferences.productView==="list"?"active":""} onClick={()=>setUiPreferences({productView:"list"})} title="Jadval"><FiList/></button></div></div></div>
      {uiPreferences.productView==="list"&&selectedIds.length>0&&<div className="product-bulk-bar"><span><strong>{selectedIds.length}</strong> ta mahsulot tanlandi</span>{status!=="archived"&&<PremiumSelect className="bulk-category-select" value="" onChange={(event)=>event.target.value&&bulkSetCategory(event.target.value)}><option value="" disabled>Kategoriya o‘zgartirish</option><option value="__none__">Kategoriyasiz</option>{categories.map((category)=><option key={category} value={category}>{category}</option>)}</PremiumSelect>}<button className={`pro-btn ${status==="archived"?"secondary":"danger"}`} onClick={bulkArchive}>{status==="archived"?<><FiRotateCcw/> Tiklash</>:<><FiArchive/> Arxivlash</>}</button><button className="pro-btn ghost" onClick={()=>setSelectedIds([])}>Tanlovni bekor qilish</button></div>}
      {!filtered.length?<EmptyState icon={FiPackage} title={status==="archived"?"Arxiv bo‘sh":"Mahsulot topilmadi"} message="Qidiruvni o‘zgartiring yoki yangi tovarni Ombor → Kirim orqali qo‘shing." action={canReceive&&status!=="archived"?<button className="pro-btn primary" onClick={()=>navigate("/inventory?receive=1")}>Omborga kirim</button>:null}/>:uiPreferences.productView==="list"?<div className="pro-table-wrap product-table-wrap mobile-card-wrap"><table className="pro-table product-table mobile-card-table"><thead><tr><th className="product-select-col"><PremiumCheckbox checked={allVisibleSelected} onChange={toggleSelectAll}/></th><th>Mahsulot</th>{orderedProductColumns.map((column)=><th key={column.id} style={productColumnStyle(column.id)}>{column.label}</th>)}{canEdit&&<th/>}</tr></thead><tbody>{filtered.map((product)=>{const stockTone=product.quantity<=0?"danger":product.quantity<=product.minStock?"warning":"success";return <tr key={product.id} className={selectedIds.includes(product.id)?"selected":""}><td className="product-select-col" data-label="Tanlash"><PremiumCheckbox checked={selectedIds.includes(product.id)} onChange={()=>toggleSelected(product.id)}/></td><td data-label="Mahsulot"><button className="product-table-name product-name-button" onClick={()=>setDetailProduct(product)}><ProductThumb product={product} className="product-soft-icon"/><span><strong>{product.name}</strong><small>{product.brand||"Katalog mahsuloti"}</small></span></button></td>{orderedProductColumns.map((column)=>{
          if(column.id==="sku")return <td key={column.id} style={productColumnStyle(column.id)} data-label={column.label}><strong>{product.sku||"—"}</strong><small className="mono-cell">{product.barcode||"Shtrix-kod yo‘q"}</small></td>;
          if(column.id==="category")return <td key={column.id} style={productColumnStyle(column.id)} data-label={column.label}>{product.category||"—"}</td>;
          if(column.id==="price")return <td key={column.id} style={productColumnStyle(column.id)} data-label={column.label}><strong>{formatPrice(product.sellPrice)}</strong></td>;
          if(column.id==="stock")return <td key={column.id} style={productColumnStyle(column.id)} data-label={column.label}><strong>{product.quantity} {product.unit||"dona"}</strong></td>;
          if(column.id==="status")return <td key={column.id} style={productColumnStyle(column.id)} data-label={column.label}><StatusBadge tone={stockTone}>{product.quantity<=0?"Tugagan":product.quantity<=product.minStock?"Kam qolgan":"Mavjud"}</StatusBadge></td>;
          return null;
        })}{canEdit&&<td data-label="Amallar"><div className="pro-row-actions">{canReceive&&<button className="pro-icon-btn" onClick={()=>navigate(`/inventory?receive=1&product=${encodeURIComponent(product.id)}`)} aria-label="Kirim qilish"><FiPlus/></button>}<button className="pro-icon-btn" onClick={()=>setDetailProduct(product)} aria-label="Ko‘rish"><FiEye/></button><button className="pro-icon-btn" onClick={()=>openEdit(product)} aria-label="Tahrirlash"><FiEdit2/></button><button className="pro-icon-btn" onClick={()=>archive(product)} aria-label={product.archived?"Tiklash":"Arxivlash"}>{product.archived?<FiRotateCcw/>:<FiArchive/>}</button></div></td>}</tr>})}</tbody></table></div>:<div className="product-grid-pro view-grid">{filtered.map((product)=>{const stockTone=product.quantity<=0?"danger":product.quantity<=product.minStock?"warning":"success";return <article className="product-card-pro" key={product.id}><div className="product-card-main" role="button" tabIndex="0" onClick={()=>setDetailProduct(product)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setDetailProduct(product)}}}><div className="product-title-row"><div><ProductThumb product={product} className="product-soft-icon"/><h3>{product.name}</h3><span>{product.sku}{product.barcode?` · ${product.barcode}`:""}</span></div><StatusBadge tone={stockTone}>{product.quantity<=0?"Tugagan":product.quantity<=product.minStock?"Kam qolgan":"Mavjud"}</StatusBadge></div><div className="product-meta"><span><small>Kategoriya</small><b>{product.category||"—"}</b></span><span><small>Sotuv narxi</small><b>{formatPrice(product.sellPrice)}</b></span><span><small>Qoldiq</small><b>{product.quantity} {product.unit||"dona"}</b></span></div></div>{canEdit&&<div className="product-actions"><div className="product-actions-main">{canReceive&&<button onClick={()=>navigate(`/inventory?receive=1&product=${encodeURIComponent(product.id)}`)}><FiPlus/> Kirim</button>}<button onClick={()=>openEdit(product)}><FiEdit2/> Tahrirlash</button></div><button className="product-archive-action" onClick={()=>archive(product)}>{product.archived?<><FiRotateCcw/> Tiklash</>:<><FiArchive/> Arxivlash</>}</button></div>}</article>})}</div>}</section>

    <Modal open={!!detailProduct} onClose={()=>setDetailProduct(null)} title={detailProduct?.name||"Mahsulot"} subtitle="Katalog va filiallar bo‘yicha qoldiq" size="lg" footer={<><button className="pro-btn secondary" onClick={()=>setDetailProduct(null)}>Yopish</button>{canReceive&&detailProduct&&<button className="pro-btn primary" onClick={()=>{setDetailProduct(null);navigate(`/inventory?receive=1&product=${encodeURIComponent(detailProduct.id)}`)}}><FiPlus/> Omborga kirim</button>}</>}>
      {detailProduct&&<div className="product-detail"><div className="product-detail-hero"><ProductThumb product={detailProduct} className="product-detail-image"/><div><strong>{detailProduct.name}</strong><span>{detailProduct.brand||detailProduct.category||"Katalog mahsuloti"}</span></div></div><div className="product-detail-summary"><span><small>SKU</small><strong>{detailProduct.sku||"—"}</strong></span><span><small>Shtrix-kod</small><strong>{detailProduct.barcode||"—"}</strong></span><span><small>Sotuv narxi</small><strong>{formatPrice(detailProduct.sellPrice)}</strong></span><span><small>Jami qoldiq</small><strong>{detailProduct.quantity} {detailProduct.unit||"dona"}</strong></span></div><div className="product-detail-section"><div className="receive-section-title"><strong>Filiallar bo‘yicha qoldiq</strong><span>{branchLocked?"Joriy filialdagi real qoldiq":"Har bir faol filialdagi real qoldiq"}</span></div><div className="product-store-stock">{stockVisibleStores.map((store)=><div key={store.id}><span><strong>{store.name}</strong><small>{store.id===currentStoreId?"Joriy filial":"Filial"}</small></span><b>{getStoreStock(detailProduct.id,store.id)} {detailProduct.unit||"dona"}</b></div>)}</div></div><div className="product-detail-timeline"><span><small>Oxirgi kirim</small><strong>{productLastReceive(detailProduct.id)?.date||productLastReceive(detailProduct.id)?.dateISO||"Hali kirim bo‘lmagan"}</strong></span><span><small>Oxirgi sotuv</small><strong>{productLastSale(detailProduct.id)?.date||productLastSale(detailProduct.id)?.dateISO||"Hali sotilmagan"}</strong></span></div></div>}
    </Modal>

    <Modal open={scanOpen} onClose={()=>{setScanOpen(false);setScanResult(null)}} title="Shtrix-kod bilan tez qo‘shish" subtitle="Scanner bilan shtrix-kodni o‘qing yoki raqamni kiriting." size="sm" footer={<><button className="pro-btn secondary" onClick={()=>setScanOpen(false)}>Yopish</button>{scanResult&&scanResult.type!=="local"&&<button className="pro-btn primary" onClick={createFromScan}>Mahsulot yaratish</button>}</>}>
      <div className="scan-add-box"><label className="pro-field"><span>Shtrix-kod / GTIN</span><input autoFocus value={scanCode} onChange={(event)=>{setScanCode(event.target.value);setScanResult(null)}} onKeyDown={(event)=>event.key==="Enter"&&lookupBarcode()} placeholder="Scanner bilan o‘qing..." inputMode="numeric"/></label><button className="pro-btn secondary" onClick={lookupBarcode}>Tekshirish</button></div>
      {scanResult&&<div className={`catalog-result ${scanResult.type}`}><FiPackage/><span><strong>{scanResult.type==="local"?scanResult.product.name:scanResult.type==="catalog"?scanResult.product.name:"Yangi shtrix-kod"}</strong><small>{scanResult.type==="local"?"Bu mahsulot joriy katalogda allaqachon bor.":scanResult.type==="catalog"?"Zenix POS katalogidan topildi. Narx va qoldiqni kiriting.":"Katalogda topilmadi. Shtrix-kod avtomatik to‘ldiriladi."}</small></span></div>}
    </Modal>

    <Modal open={modal} onClose={closeForm} title={editing?"Katalog yozuvini tahrirlash":"Katalogga mahsulot qo‘shish"} subtitle="Faqat kerakli ma’lumotlarni kiriting. Qo‘shimcha maydonlar biznes turiga qarab yoqiladi." size="lg" footer={<><button className="pro-btn secondary" onClick={closeForm}>Bekor qilish</button><button className="pro-btn primary" disabled={saving} onClick={save}>{saving?"Saqlanmoqda...":"Saqlash"}</button></>}>
      <div className="pro-form-grid"><div className="product-media-field full"><div className="product-media-preview">{imagePreview?<img src={imagePreview} alt="Mahsulot rasmi"/>:<FiImage/>}</div><div className="product-media-picker"><strong>Mahsulot rasmi</strong><span>Ixtiyoriy. JPG, PNG yoki WebP, 5 MB gacha.</span><FilePicker file={imageFile} existingName={imageRemoved?"":form.imageName} accept="image/jpeg,image/png,image/webp" label="Rasm tanlash" hint="JPG, PNG yoki WebP" onChange={(file)=>{if(file&&file.size>5*1024*1024){setErrors((current)=>({...current,image:"Rasm hajmi 5 MB dan oshmasin."}));return;}setErrors((current)=>({...current,image:""}));setImageFile(file);setImageRemoved(false)}} onClear={()=>{setImageFile(null);setImageRemoved(Boolean(form.imageKey));setImagePreview("")}}/>{errors.image&&<small className="field-error">{errors.image}</small>}</div></div><label className="pro-field full"><span>Mahsulot nomi *</span><input autoFocus value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/>{errors.name&&<small className="field-error">{errors.name}</small>}</label><label className="pro-field"><span>SKU *</span><input value={form.sku} onChange={(event)=>setForm({...form,sku:event.target.value})}/>{errors.sku&&<small className="field-error">{errors.sku}</small>}</label><div className="pro-field"><span>Shtrix-kod</span><div className="field-action-row"><input value={form.barcode} onChange={(event)=>setForm({...form,barcode:event.target.value})}/><button type="button" className="pro-btn secondary" onClick={generateProductBarcode}>Yaratish</button></div>{errors.barcode&&<small className="field-error">{errors.barcode}</small>}</div><label className="pro-field"><span>Kategoriya</span><input value={form.category} onChange={(event)=>setForm({...form,category:event.target.value})}/></label><label className="pro-field"><span>Brend</span><input value={form.brand} onChange={(event)=>setForm({...form,brand:event.target.value})}/></label><label className="pro-field"><span>O‘lchov birligi</span><PremiumSelect value={form.unit} onChange={(event)=>setForm({...form,unit:event.target.value})}><option>dona</option><option>kg</option><option>metr</option><option>litr</option><option>quti</option></PremiumSelect></label><label className="pro-field"><span>Minimal qoldiq</span><input type="number" min="0" value={form.minStock} onChange={(event)=>setForm({...form,minStock:event.target.value})}/></label><label className="pro-field"><span>Sotuv narxi *</span><input type="number" min="0" value={form.sellPrice} onChange={(event)=>setForm({...form,sellPrice:event.target.value})}/>{errors.sellPrice&&<small className="field-error">{errors.sellPrice}</small>}</label><label className="pro-field"><span>Ulgurji narx</span><input type="number" min="0" value={form.wholesalePrice} onChange={(event)=>setForm({...form,wholesalePrice:event.target.value})}/></label>
      {businessFeatures.variants&&<label className="pro-field"><span>Variant</span><input value={form.variant} onChange={(event)=>setForm({...form,variant:event.target.value})}/></label>}{businessFeatures.sizeColor&&<><label className="pro-field"><span>O‘lcham</span><input value={form.size} onChange={(event)=>setForm({...form,size:event.target.value})}/></label><label className="pro-field"><span>Rang</span><input value={form.color} onChange={(event)=>setForm({...form,color:event.target.value})}/></label></>}{businessFeatures.weightVolume&&<label className="pro-field"><span>Og‘irlik / Hajm</span><input value={form.weight} onChange={(event)=>setForm({...form,weight:event.target.value})}/></label>}{businessFeatures.warranty&&<label className="pro-field"><span>Kafolat</span><input value={form.warranty} onChange={(event)=>setForm({...form,warranty:event.target.value})}/></label>}</div>
    </Modal>
  </div>;
}

export default Products;
