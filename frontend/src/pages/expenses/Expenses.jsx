import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiCreditCard, FiEdit2, FiEye, FiFileText, FiPlus, FiSearch, FiTrash2, FiTrendingDown, FiUsers } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { ROLES } from "../../config/roles";
import { formatPrice } from "../../utils/formatPrice";
import { workspaceDateISO, workspaceTime } from "../../utils/workspaceDate";
import { deleteLocalFile, readLocalFile, saveLocalFile } from "../../services/fileStore";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, FilePicker, PremiumDateInput, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { useFeedback } from "../../context/FeedbackContext";
import "./expenses.scss";

const categories=["Ijara","Kommunal","Transport","Reklama","Ish haqi","Logistika","Mayda xarajat","Boshqa"];
const empty={title:"",category:"Mayda xarajat",amount:"",dateISO:"",employee:"",paymentMethod:"cash",note:"",receiptName:"",receiptKey:""};
function Expenses(){
  const {currentUser}=useAuth();const {expenses,activeShift,currentStore,currentStoreId,employees,commitExpenseTransaction,hasPermission,effectiveWorkspaceSettings:workspaceSettings}=useStore();const {confirm,notify}=useFeedback();const location=useLocation();const canWrite=hasPermission("expensesWrite",currentUser?.appRole);
  const [search,setSearch]=useState("");const [category,setCategory]=useState("all");const [modal,setModal]=useState(null);const [editing,setEditing]=useState(null);const [form,setForm]=useState({...empty,dateISO:workspaceDateISO(new Date(),workspaceSettings.organization.timezone),employee:currentUser?.name||""});const [error,setError]=useState("");const [receiptFile,setReceiptFile]=useState(null);const [receiptView,setReceiptView]=useState(null);const [receiptUrl,setReceiptUrl]=useState("");const [receiptLoading,setReceiptLoading]=useState(false);const formBaselineRef=useRef("");
  const expenseColumnDefs=[{id:"category",label:"Kategoriya"},{id:"employee",label:"Xodim / Smena"},{id:"payment",label:"To‘lov"},{id:"amount",label:"Summa"}];
  const expenseColumnsControl=usePersistentColumns("zenix_expense_columns",expenseColumnDefs,{required:["amount"]});
  const {visible:expenseColumns,toggle:toggleExpenseColumn,orderedVisibleDefinitions:orderedExpenseColumns,columnStyle:expenseColumnStyle}=expenseColumnsControl;
  const formSnapshot=(value)=>JSON.stringify({title:value.title||"",category:value.category||"",amount:String(value.amount||""),dateISO:value.dateISO||"",employee:value.employee||"",paymentMethod:value.paymentMethod||"",note:value.note||"",receiptName:value.receiptName||"",receiptKey:value.receiptKey||""});
  const formDirty=modal==="edit"&&(formSnapshot(form)!==formBaselineRef.current||Boolean(receiptFile));
  const guardFormClose=useUnsavedGuard(formDirty);
  const closeEditModal=()=>guardFormClose(()=>{setModal(null);setEditing(null);setReceiptFile(null);setError("")});
  const isCashier=currentUser?.appRole===ROLES.CASHIER;
  const openCreate=()=>{if(!canWrite)return;const next={...empty,dateISO:workspaceDateISO(new Date(),workspaceSettings.organization.timezone),employee:currentUser?.name||"",shiftId:activeShift?.id||"",store:currentStore?.name||"",storeId:currentStoreId};setEditing(null);setReceiptFile(null);setForm(next);formBaselineRef.current=formSnapshot(next);setError("");setModal("edit")};
  useEffect(()=>{if(new URLSearchParams(location.search).get("new")==="1")openCreate()},[location.search]);
  const storeExpenses=useMemo(()=>expenses.filter((expense)=>expense.storeId?String(expense.storeId)===String(currentStoreId):expense.store===currentStore?.name),[expenses,currentStoreId,currentStore?.name]);
  const visible=useMemo(()=>storeExpenses.filter(e=>(!isCashier||String(e.employeeId||"")===String(currentUser?.id||"")||(!e.employeeId&&e.employee===currentUser?.name))&&`${e.title||e.name} ${e.category} ${e.employee}`.toLowerCase().includes(search.toLowerCase())&&(category==="all"||e.category===category)),[storeExpenses,isCashier,currentUser?.id,currentUser?.name,search,category]);
  const todayKey=workspaceDateISO(new Date(),workspaceSettings.organization.timezone);const thisMonth=todayKey.slice(0,7);const todayTotal=storeExpenses.filter(e=>e.dateISO===todayKey).reduce((s,e)=>s+Number(e.amount),0);const monthTotal=storeExpenses.filter(e=>String(e.dateISO||"").startsWith(thisMonth)).reduce((s,e)=>s+Number(e.amount),0);const topCat=Object.entries(storeExpenses.reduce((a,e)=>({...a,[e.category]:(a[e.category]||0)+Number(e.amount)}),{})).sort((a,b)=>b[1]-a[1])[0];

  const save=async()=>{
    if(!canWrite)return;
    if(!form.title.trim()){setError("Xarajat nomini kiriting");return}
    if(Number(form.amount)<=0){setError("Summa 0 dan katta bo‘lishi kerak");return}
    let receiptKey=form.receiptKey||"",receiptName=form.receiptName||"",receiptType=form.receiptType||"";
    let uploadedReceiptKey="";
    try{
      if(receiptFile){
        uploadedReceiptKey=await saveLocalFile(receiptFile);
        receiptKey=uploadedReceiptKey;receiptName=receiptFile.name;receiptType=receiptFile.type;
      }else if(editing?.receiptKey&&!receiptKey){receiptName="";receiptType=""}
    }catch{setError("Chek faylini saqlab bo‘lmadi. Qayta urinib ko‘ring.");return}
    const payload={...form,id:editing?.id||crypto.randomUUID(),amount:Number(form.amount),date:formatWorkspaceDate(new Date(`${form.dateISO}T12:00:00Z`),workspaceSettings.organization),shiftId:form.shiftId||activeShift?.id||"",store:form.store||currentStore?.name||"",storeId:form.storeId||currentStoreId,receiptKey,receiptName,receiptType};
    const result=await commitExpenseTransaction({expense:payload,activity:{type:"expense",title:editing?"Xarajat tahrirlandi":"Xarajat qo‘shildi",description:`${payload.title}: ${formatPrice(payload.amount)}`}});
    if(!result?.success){
      if(uploadedReceiptKey)await deleteLocalFile(uploadedReceiptKey).catch(()=>{});
      setError(result?.message||"Xarajatni saqlab bo‘lmadi. Qayta urinib ko‘ring.");
      return;
    }
    if(editing?.receiptKey&&editing.receiptKey!==receiptKey)await deleteLocalFile(editing.receiptKey).catch(()=>{});
    formBaselineRef.current=formSnapshot(payload);setReceiptFile(null);setModal(null);setEditing(null);
    notify({tone:"success",title:editing?"Xarajat yangilandi":"Xarajat qo‘shildi",message:`${payload.title} · ${formatPrice(payload.amount)}`});
  };
  const edit=e=>{if(!canWrite)return;const next={...empty,...e,title:e.title||e.name,amount:String(e.amount)};setEditing(e);setReceiptFile(null);setForm(next);formBaselineRef.current=formSnapshot(next);setError("");setModal("edit")};
  const remove=async(item)=>{if(!canWrite||!item)return;const accepted=await confirm({title:"Xarajatni o‘chirish",message:`${item.title||item.name} · ${formatPrice(item.amount||0)}. Bu moliyaviy yozuv o‘chiriladi.`,confirmLabel:"O‘chirish",cancelLabel:"Bekor qilish",tone:"danger"});if(!accepted)return;const result=await commitExpenseTransaction({expense:item,remove:true,activity:{type:"expense",title:"Xarajat o‘chirildi",description:item.title||item.name}});if(!result?.success){notify({tone:"danger",title:"Xarajat o‘chirilmadi",message:result?.message||"Qayta urinib ko‘ring."});return}if(item.receiptKey)await deleteLocalFile(item.receiptKey).catch(()=>{});notify({tone:"success",title:"Xarajat o‘chirildi",message:item.title||item.name})};
  const openReceipt=async expense=>{setReceiptView(expense);setReceiptLoading(true);if(receiptUrl&&!receiptUrl.startsWith("data:"))URL.revokeObjectURL(receiptUrl);setReceiptUrl("");try{if(expense.receiptKey){const file=await readLocalFile(expense.receiptKey);if(file)setReceiptUrl(URL.createObjectURL(file))}}catch{}setReceiptLoading(false)};
  const closeReceipt=()=>{if(receiptUrl&&!receiptUrl.startsWith("data:"))URL.revokeObjectURL(receiptUrl);setReceiptUrl("");setReceiptView(null)};
  return <div className="pro-page expenses-pro"><PageHeader title="Xarajatlar" subtitle="Operatsion xarajatlarni kategoriya, xodim, filial va smena bilan nazorat qiling." actions={canWrite&&<button className="pro-btn primary" onClick={openCreate}><FiPlus/> Xarajat qo‘shish</button>}/>
    <div className="pro-stat-grid"><StatCard icon={FiCreditCard} label="Bugungi xarajat" value={formatPrice(todayTotal)} hint={currentStore?.name||"Joriy filial"} tone="red"/><StatCard icon={FiTrendingDown} label="Bu oy" value={formatPrice(monthTotal)} hint="Sof foydada hisoblanadi" tone="orange"/><StatCard icon={FiFileText} label="Eng katta kategoriya" value={topCat?.[0]||"—"} hint={topCat?formatPrice(topCat[1]):"Xarajat yo‘q"} tone="purple"/><StatCard icon={FiUsers} label="Yozuvlar" value={visible.length} hint={isCashier?"Sizning xarajatlaringiz":"Filtr natijasi"} tone="blue"/></div>
    <section className="pro-card"><div className="pro-toolbar"><div className="pro-search"><FiSearch/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Xarajat, kategoriya yoki xodim..."/></div><PremiumSelect className="pro-select" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Barcha kategoriyalar</option>{categories.map(c=><option key={c}>{c}</option>)}</PremiumSelect><ColumnPicker columns={expenseColumnDefs} visible={expenseColumns} order={expenseColumnsControl.order} widths={expenseColumnsControl.widths} views={expenseColumnsControl.views} onToggle={toggleExpenseColumn} onMove={expenseColumnsControl.move} onWidth={expenseColumnsControl.setWidth} onReset={expenseColumnsControl.reset} onSaveView={expenseColumnsControl.saveView} onApplyView={expenseColumnsControl.applyView} onDeleteView={expenseColumnsControl.deleteView}/></div><div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Sana</th><th>Xarajat</th>{orderedExpenseColumns.map((column)=><th key={column.id} style={expenseColumnStyle(column.id)}>{column.label}</th>)}<th/></tr></thead><tbody>{visible.length?visible.map(e=><tr key={e.id}><td data-label="Sana">{e.date||formatWorkspaceDate(new Date(`${e.dateISO}T12:00:00Z`),workspaceSettings.organization)}</td><td data-label="Xarajat"><strong>{e.title||e.name}</strong><small>{e.note||e.store||""}</small></td>{orderedExpenseColumns.map((column)=>{
        if(column.id==="category")return <td key={column.id} style={expenseColumnStyle(column.id)} data-label={column.label}><StatusBadge>{e.category}</StatusBadge></td>;
        if(column.id==="employee")return <td key={column.id} style={expenseColumnStyle(column.id)} data-label={column.label}><strong>{e.employee||"—"}</strong><small>{e.shiftId||"Smenaga bog‘lanmagan"}</small></td>;
        if(column.id==="payment")return <td key={column.id} style={expenseColumnStyle(column.id)} data-label={column.label}>{e.paymentMethod==="cash"?"Naqd":e.paymentMethod==="card"?"Karta":"O‘tkazma"}</td>;
        if(column.id==="amount")return <td key={column.id} style={expenseColumnStyle(column.id)} data-label={column.label}><strong>{formatPrice(e.amount)}</strong></td>;
        return null;
      })}<td data-label="Amallar"><div className="pro-row-actions">{e.receiptName&&<button className="pro-icon-btn" onClick={()=>openReceipt(e)} aria-label="Chekni ko‘rish" title="Chekni ko‘rish"><FiEye/></button>}{canWrite&&<><button className="pro-icon-btn" onClick={()=>edit(e)} aria-label="Tahrirlash"><FiEdit2/></button><button className="pro-icon-btn expense-delete" onClick={()=>remove(e)} aria-label="O‘chirish"><FiTrash2/></button></>}</div></td></tr>):<tr><td colSpan={orderedExpenseColumns.length+3}><div className="pro-empty"><FiCreditCard/><strong>Xarajat topilmadi</strong><span>Yangi xarajat qo‘shishingiz mumkin.</span></div></td></tr>}</tbody></table></div></section>
    <Modal open={modal==="edit"} onClose={closeEditModal} title={editing?"Xarajatni tahrirlash":"Yangi xarajat"} subtitle="Xarajatlar Boshqaruv paneli va Analitikadagi sof foyda hisobiga avtomatik kiradi." footer={<><button className="pro-btn secondary" onClick={closeEditModal}>Bekor qilish</button><button className="pro-btn primary" onClick={save}>Saqlash</button></>}><div className="pro-form-grid"><label className="pro-field full"><span>Xarajat nomi *</span><input data-modal-autofocus value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label className="pro-field"><span>Kategoriya</span><PremiumSelect value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</PremiumSelect></label><label className="pro-field"><span>Summa *</span><input type="number" min="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label className="pro-field"><span>Sana</span><PremiumDateInput value={form.dateISO} onChange={e=>setForm({...form,dateISO:e.target.value})}/></label><label className="pro-field"><span>Xodim</span>{isCashier?<input value={currentUser?.name||""} disabled/>:<PremiumSelect value={form.employee} onChange={e=>setForm({...form,employee:e.target.value})}><option value="">Tanlang</option>{employees.filter(x=>x.active).map(x=><option key={x.id}>{x.name}</option>)}</PremiumSelect>}</label><label className="pro-field"><span>To‘lov turi</span><PremiumSelect value={form.paymentMethod} onChange={e=>setForm({...form,paymentMethod:e.target.value})}><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">O‘tkazma</option></PremiumSelect></label><label className="pro-field"><span>Smena</span><input value={form.shiftId||activeShift?.id||"Smena ochilmagan"} disabled/></label><label className="pro-field full"><span>Izoh</span><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label><label className="pro-field full"><span>Chek / hujjat (ixtiyoriy)</span><FilePicker file={receiptFile} existingName={form.receiptName} accept=".jpg,.jpeg,.png,.pdf,application/pdf,image/*" label="Chek yoki hujjat tanlash" hint="JPG, PNG yoki PDF" onChange={(file)=>setReceiptFile(file)} onClear={()=>{setReceiptFile(null);setForm({...form,receiptName:"",receiptKey:""})}}/></label>{error&&<div className="pro-alert danger full">{error}</div>}</div></Modal>
    <Modal open={!!receiptView} onClose={closeReceipt} title="Xarajat cheki" subtitle={receiptView?.title||receiptView?.name} size="sm"><div className="expense-receipt-preview">{receiptLoading?<FiFileText/>:receiptUrl&&receiptView?.receiptType?.startsWith("image/")?<img src={receiptUrl} alt="Xarajat cheki"/>:receiptUrl&&receiptView?.receiptType==="application/pdf"?<iframe title="Xarajat cheki PDF" src={receiptUrl}/>:<FiFileText/>}<strong>{receiptView?.receiptName||"Chek topilmadi"}</strong><span>{formatPrice(receiptView?.amount||0)}</span></div></Modal>
  </div>;
}
export default Expenses;
