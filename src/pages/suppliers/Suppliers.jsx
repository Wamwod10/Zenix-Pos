import { useMemo, useRef, useState } from "react";
import {
  FiArchive, FiCheckCircle, FiCreditCard, FiDollarSign, FiEdit2, FiFileText,
  FiPlus, FiSearch, FiShoppingBag, FiTruck, FiUsers,
} from "react-icons/fi";
import { useStore } from "../../context/StoreContext";
import { useFeedback } from "../../context/FeedbackContext";
import { formatPrice } from "../../utils/formatPrice";
import { invoiceBalance, invoiceStatus, supplierOpenDebt } from "../../utils/supplierLedger";
import { workspaceDateISO } from "../../utils/workspaceDate";
import { PageHeader, StatCard, StatusBadge, PremiumSelect, PremiumDateInput, PremiumCheckbox, ColumnPicker } from "../../components/Ui";
import Modal from "../../components/Modal";
import useUnsavedGuard from "../../utils/useUnsavedGuard";
import usePersistentColumns from "../../utils/usePersistentColumns";
import { buildFieldChanges } from "../../utils/auditChanges";
import { formatUzPhone, isValidUzPhone, sameUzPhone } from "../../utils/phone";
import "./supplier.scss";

const supplierAuditFields=[
  {key:"name",label:"Nomi"},{key:"phone",label:"Telefon"},{key:"contact",label:"Aloqa vakili"},
  {key:"telegram",label:"Telegram"},{key:"deadline",label:"To‘lov muddati"},{key:"notes",label:"Izoh"},
];
const empty={name:"",phone:"",contact:"",telegram:"",deadline:"",notes:""};
const isPast=(iso,today)=>Boolean(iso&&iso<today);
const invoiceItems=(row)=>Array.isArray(row?.items)&&row.items.length?row.items:[{
  productId:row?.productId||"",product:row?.product||"Mahsulot",quantity:Number(row?.quantity||0),
  unitCost:Number(row?.unitCost||0),previousUnitCost:Number(row?.previousUnitCost||row?.unitCost||0),total:Number(row?.total||0),
}];
const invoiceProductsLabel=(row)=>{
  const items=invoiceItems(row);
  if(items.length===1)return items[0].product||"Mahsulot";
  const names=items.slice(0,2).map((item)=>item.product).filter(Boolean).join(", ");
  return `${items.length} ta mahsulot${names?` · ${names}${items.length>2?"…":""}`:""}`;
};

const supplierInvoiceColumnDefs=[
  {id:"products",label:"Mahsulot"},
  {id:"total",label:"Jami"},
  {id:"paid",label:"To‘langan"},
  {id:"balance",label:"Qoldiq"},
  {id:"dueDate",label:"Muddat"},
];

function Suppliers(){
  const {confirm,undo,notify}=useFeedback();
  const {suppliers,inventory,hasPermission,effectiveWorkspaceSettings:workspaceSettings,activeShift,commitSupplierPayment,saveSupplier,setSupplierArchived}=useStore();
  const canWrite=hasPermission("supplierWrite");
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("active");
  const [modal,setModal]=useState(null);
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(empty);
  const [selected,setSelected]=useState(null);
  const [payAmount,setPayAmount]=useState("");
  const [payMethod,setPayMethod]=useState("cash");
  const [payNote,setPayNote]=useState("");
  const [payInvoiceId,setPayInvoiceId]=useState("");
  const [payFromRegister,setPayFromRegister]=useState(false);
  const [errors,setErrors]=useState({});
  const [selectedIds,setSelectedIds]=useState([]);
  const {visible:invoiceColumns,toggle:toggleInvoiceColumn,show:showInvoiceColumn}=usePersistentColumns("zenix_supplier_invoice_columns",supplierInvoiceColumnDefs);
  const editBaselineRef=useRef(JSON.stringify(empty));
  const payBaselineRef=useRef("");
  const supplierFormDirty=modal==="edit"&&JSON.stringify(form)!==editBaselineRef.current;
  const paymentDraft=JSON.stringify({payAmount,payMethod,payNote,payInvoiceId,payFromRegister});
  const supplierPaymentDirty=modal==="pay"&&payBaselineRef.current!==""&&paymentDraft!==payBaselineRef.current;
  const guardEditClose=useUnsavedGuard(supplierFormDirty,"Ta’minotchi ma’lumotlarida saqlanmagan o‘zgarishlar bor. Chiqsangiz, ular yo‘qoladi.");
  const guardPaymentClose=useUnsavedGuard(supplierPaymentDirty,"To‘lov ma’lumotlari saqlanmagan. Chiqsangiz, kiritilgan summa va izoh yo‘qoladi.");
  const todayISO=workspaceDateISO(new Date(),workspaceSettings.organization.timezone);
  const monthKey=todayISO.slice(0,7);

  const activeSuppliers=suppliers.filter((supplier)=>!supplier.archived);
  const totalDebt=suppliers.reduce((sum,supplier)=>sum+supplierOpenDebt(supplier),0);
  const overdue=suppliers.reduce((sum,supplier)=>{
    const invoiceOverdue=(supplier.purchaseHistory||[]).reduce((subtotal,row)=>subtotal+(invoiceBalance(row)>0&&isPast(row.dueDate,todayISO)?invoiceBalance(row):0),0);
    if(invoiceOverdue>0)return sum+invoiceOverdue;
    return sum+(supplierOpenDebt(supplier)>0&&isPast(supplier.deadline,todayISO)?supplierOpenDebt(supplier):0);
  },0);
  const monthPurchases=suppliers.reduce((sum,supplier)=>sum+(supplier.purchaseHistory||[]).filter((row)=>String(row.dateISO||"").startsWith(monthKey)).reduce((subtotal,row)=>subtotal+Number(row.total||0),0),0);

  const filtered=useMemo(()=>suppliers.filter((supplier)=>{
    const debt=supplierOpenDebt(supplier);
    const invoiceOverdue=(supplier.purchaseHistory||[]).some((row)=>invoiceBalance(row)>0&&isPast(row.dueDate,todayISO));
    const overdueState=invoiceOverdue||(debt>0&&isPast(supplier.deadline,todayISO));
    const matches=`${supplier.name} ${supplier.phone} ${supplier.contact||""}`.toLowerCase().includes(search.toLowerCase());
    return matches&&(filter==="all"||(filter==="active"&&!supplier.archived)||(filter==="archived"&&supplier.archived)||(filter==="debt"&&!supplier.archived&&debt>0)||(filter==="overdue"&&!supplier.archived&&overdueState));
  }),[suppliers,search,filter,todayISO]);

  const openCreate=()=>{if(!canWrite)return;const next={...empty};setEditing(null);setForm(next);editBaselineRef.current=JSON.stringify(next);setErrors({});setModal("edit")};
  const openEdit=(supplier)=>{if(!canWrite)return;const next={...empty,...supplier};setEditing(supplier);setForm(next);editBaselineRef.current=JSON.stringify(next);setErrors({});setModal("edit")};
  const closeEdit=()=>guardEditClose(()=>{setModal(null);setEditing(null);setErrors({})});
  const save=async()=>{
    if(!canWrite)return;
    const nextErrors={};
    const normalizedPhone=formatUzPhone(form.phone);
    if(form.name.trim().length<2)nextErrors.name="Nomini kiriting";
    if(!isValidUzPhone(normalizedPhone))nextErrors.phone="Telefon raqamini +998 XX XXX XX XX formatida kiriting";
    if(suppliers.some((supplier)=>supplier.id!==editing?.id&&sameUzPhone(supplier.phone,normalizedPhone)))nextErrors.phone="Bu telefon boshqa ta’minotchida mavjud";
    setErrors(nextErrors);if(Object.keys(nextErrors).length)return;
    const payload={...form,name:form.name.trim(),phone:normalizedPhone};
    const result=await saveSupplier({id:editing?.id||null,payload});
    if(!result.success){notify({tone:"danger",title:"Saqlab bo‘lmadi",message:result.message});return}
    editBaselineRef.current=JSON.stringify(payload);
    setModal(null);setEditing(null);
    notify({tone:"success",title:editing?"Ta’minotchi yangilandi":"Ta’minotchi qo‘shildi",message:payload.name});
  };
  const archive=async(supplier)=>{
    if(!canWrite)return;
    const nextArchived=!supplier.archived;
    if(nextArchived){
      const debt=supplierOpenDebt(supplier);
      if(debt>0){notify({tone:"warning",title:"Ta’minotchini arxivlab bo‘lmaydi",message:`Ochiq qarz ${formatPrice(debt)}. Avval qarzni yoping.`});return}
      const accepted=await confirm({title:"Ta’minotchini arxivlaysizmi?",message:`${supplier.name} faol ro‘yxatdan yashiriladi. Qarz va nakladnoy tarixi saqlanadi.`,confirmLabel:"Arxivlash",cancelLabel:"Bekor qilish",tone:"danger"});
      if(!accepted)return;
    }
    const result=await setSupplierArchived(supplier.id,nextArchived);
    if(!result.success){notify({tone:"danger",title:"Amal bajarilmadi",message:result.message});return}
    notify({tone:"success",title:nextArchived?"Ta’minotchi arxivlandi":"Ta’minotchi tiklandi",message:supplier.name});
    undo({title:nextArchived?"Ta’minotchi arxivlandi":"Ta’minotchi tiklandi",message:supplier.name,onUndo:async()=>{await setSupplierArchived(supplier.id,!nextArchived)}});
  };
  const selectedSuppliers=useMemo(()=>suppliers.filter((supplier)=>selectedIds.includes(supplier.id)),[suppliers,selectedIds]);
  const allFilteredSelected=filtered.length>0&&filtered.every((supplier)=>selectedIds.includes(supplier.id));
  const toggleSupplierSelection=(supplierId,checked)=>setSelectedIds((ids)=>checked?[...new Set([...ids,supplierId])]:ids.filter((id)=>id!==supplierId));
  const toggleFilteredSelection=()=>setSelectedIds((ids)=>{
    const visibleIds=filtered.map((supplier)=>supplier.id);
    if(allFilteredSelected)return ids.filter((id)=>!visibleIds.includes(id));
    return [...new Set([...ids,...visibleIds])];
  });
  const bulkArchive=async(nextArchived)=>{
    if(!canWrite)return;
    const targets=selectedSuppliers.filter((supplier)=>Boolean(supplier.archived)!==Boolean(nextArchived));
    if(!targets.length){notify({tone:"info",title:"O‘zgaradigan ta’minotchi yo‘q",message:nextArchived?"Tanlanganlar allaqachon arxivda.":"Tanlanganlar allaqachon faol."});return}
    if(nextArchived){
      const debtTargets=targets.filter((supplier)=>supplierOpenDebt(supplier)>0);
      if(debtTargets.length){notify({tone:"warning",title:"Qarzi bor ta’minotchi arxivlanmaydi",message:`${debtTargets[0].name}${debtTargets.length>1?` va yana ${debtTargets.length-1} ta ta’minotchi`:""}: avval ochiq qarzni yoping.`});return}
      const accepted=await confirm({title:`${targets.length} ta ta’minotchini arxivlaysizmi?`,message:"Qarz, nakladnoy va to‘lov tarixi saqlanadi. Faqat faol ro‘yxatdan yashiriladi.",confirmLabel:"Arxivlash",cancelLabel:"Bekor qilish",tone:"danger"});
      if(!accepted)return;
    }
    let completed=0;
    for(const supplier of targets){const result=await setSupplierArchived(supplier.id,nextArchived);if(!result.success){notify({tone:"danger",title:"Amal to‘liq bajarilmadi",message:`${completed}/${targets.length} ta yangilandi. ${result.message}`});return}completed+=1}
    notify({tone:"success",title:nextArchived?"Ta’minotchilar arxivlandi":"Ta’minotchilar tiklandi",message:`${completed} ta ta’minotchi`});
    setSelectedIds([]);
  };

  const supplierProducts=(supplier)=>inventory.filter((product)=>String(product.supplierId||"")===String(supplier.id)||(product.supplier&&!product.supplierId&&product.supplier===supplier.name));
  const openInvoices=(supplier)=>(supplier?.purchaseHistory||[]).filter((row)=>invoiceBalance(row)>0).sort((a,b)=>String(a.dueDate||a.dateISO||"").localeCompare(String(b.dueDate||b.dateISO||"")));

  const openPay=(supplier,invoice=null)=>{
    if(!canWrite)return;
    const invoiceId=invoice?.id||"";
    setSelected(supplier);setPayAmount("");setPayNote("");setPayMethod("cash");setPayInvoiceId(invoiceId);setPayFromRegister(false);
    payBaselineRef.current=JSON.stringify({payAmount:"",payMethod:"cash",payNote:"",payInvoiceId:invoiceId,payFromRegister:false});
    setModal("pay");
  };
  const closePay=()=>guardPaymentClose(()=>{setModal(null);setPayInvoiceId("");setPayFromRegister(false);payBaselineRef.current=""});
  const payment=async()=>{
    if(!canWrite||!selected)return;
    const targetInvoice=(selected.purchaseHistory||[]).find((row)=>row.id===payInvoiceId);
    const maxAmount=targetInvoice?invoiceBalance(targetInvoice):supplierOpenDebt(selected);
    const amount=Math.min(Math.max(0,Number(payAmount||0)),maxAmount);
    if(amount<=0)return;
    const result=await commitSupplierPayment({supplierId:selected.id,invoiceId:payInvoiceId,amount,method:payMethod,note:payNote,payFromRegister:payMethod==="cash"&&payFromRegister});
    if(!result.success){notify({tone:"danger",title:"To‘lov saqlanmadi",message:result.message||"Ma’lumotlarni tekshiring"});return}
    payBaselineRef.current="";setModal(null);setPayInvoiceId("");setPayFromRegister(false);
    notify({tone:"success",title:"To‘lov saqlandi",message:`${selected.name} · ${formatPrice(result.amount)}`});
  };


  const compareRows=useMemo(()=>suppliers.flatMap((supplier)=>(supplier.purchaseHistory||[]).flatMap((row)=>invoiceItems(row).map((item)=>({product:item.product,current:Number(item.unitCost||0),previous:Number(item.previousUnitCost||item.unitCost||0),supplier:supplier.name,dateISO:row.dateISO,date:row.date})))).sort((a,b)=>String(b.dateISO||b.date||"").localeCompare(String(a.dateISO||a.date||""))).slice(0,8),[suppliers]);
  const selectedDebt=selected?supplierOpenDebt(selected):0;
  const selectedInvoice=selected?.purchaseHistory?.find((row)=>row.id===payInvoiceId);
  const payMax=selectedInvoice?invoiceBalance(selectedInvoice):selectedDebt;

  return <div className="pro-page suppliers-pro">
    <PageHeader title="Ta’minotchilar" subtitle="Kirimlar, nakladnoylar, ochiq qarz va to‘lovlarni bir joyda boshqaring." actions={canWrite&&<button className="pro-btn primary" onClick={openCreate}><FiPlus/> Ta’minotchi qo‘shish</button>}/>
    <div className="pro-stat-grid">
      <StatCard icon={FiUsers} label="Faol ta’minotchilar" value={activeSuppliers.length} hint="Hamkorlar" tone="blue"/>
      <StatCard icon={FiDollarSign} label="Ochiq qarz" value={formatPrice(totalDebt)} hint="To‘lanmagan nakladnoylar" tone="orange"/>
      <StatCard icon={FiCreditCard} label="Muddati o‘tgan" value={formatPrice(overdue)} hint="E’tibor talab qiladi" tone="red"/>
      <StatCard icon={FiShoppingBag} label="Bu oy kirim" value={formatPrice(monthPurchases)} hint="Nakladnoylar bo‘yicha" tone="green"/>
    </div>

    <section className="pro-card">
      <div className="pro-toolbar supplier-toolbar"><div className="pro-search"><FiSearch/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Nomi, telefon yoki kontakt..."/></div><PremiumSelect className="pro-select" value={filter} onChange={(event)=>setFilter(event.target.value)}><option value="active">Faol</option><option value="debt">Qarzi bor</option><option value="overdue">Muddati o‘tgan</option><option value="archived">Arxiv</option><option value="all">Barchasi</option></PremiumSelect>{canWrite&&<button type="button" className="pro-btn secondary compact-action" onClick={toggleFilteredSelection}>{allFilteredSelected?"Tanlovni bekor qilish":"Ko‘rinayotganlarni tanlash"}</button>}</div>{canWrite&&selectedSuppliers.length>0&&<div className="supplier-bulk-bar"><span><strong>{selectedSuppliers.length} ta</strong> tanlandi</span><div><button type="button" className="pro-btn secondary compact-action" onClick={()=>bulkArchive(false)}>Tiklash</button><button type="button" className="pro-btn secondary compact-action supplier-bulk-danger" onClick={()=>bulkArchive(true)}>Arxivlash</button><button type="button" className="pro-btn ghost compact-action" onClick={()=>setSelectedIds([])}>Bekor qilish</button></div></div>}
      <div className="supplier-table-grid">{filtered.length?filtered.map((supplier)=>{
        const products=supplierProducts(supplier);const debt=supplierOpenDebt(supplier);const invoices=openInvoices(supplier);const overdueState=invoices.some((row)=>isPast(row.dueDate,todayISO))||(debt>0&&isPast(supplier.deadline,todayISO));
        return <article className="supplier-card-pro" key={supplier.id}>
          <div className="supplier-head">{canWrite&&<PremiumCheckbox className="supplier-card-select" checked={selectedIds.includes(supplier.id)} onChange={(event)=>toggleSupplierSelection(supplier.id,event.target.checked)}/>}<div className="supplier-avatar"><FiTruck/></div><div className="supplier-identity"><h3>{supplier.name}</h3><span>{supplier.phone}</span></div><StatusBadge tone={supplier.archived?"neutral":debt>0?(overdueState?"danger":"warning"):"success"}>{supplier.archived?"Arxiv":debt>0?(overdueState?"Muddati o‘tgan":"Qarz bor"):"Hisob yopiq"}</StatusBadge></div>
          <div className="supplier-kpis"><span><small>Ochiq qarz</small><strong>{formatPrice(debt)}</strong></span><span><small>Ochiq nakladnoy</small><strong>{invoices.length}</strong></span><span><small>Mahsulotlar</small><strong>{products.length}</strong></span><span><small>Yaqin muddat</small><strong>{invoices.find((row)=>row.dueDate)?.dueDate||supplier.deadline||"—"}</strong></span></div>
          <div className="supplier-contact">{supplier.contact&&<span>Kontakt: <b>{supplier.contact}</b></span>}{supplier.telegram&&<span>Telegram: <b>{supplier.telegram}</b></span>}</div>
          <div className="supplier-actions"><button onClick={()=>{setSelected(supplier);setModal("detail")}}><FiFileText/> Batafsil</button>{canWrite&&!supplier.archived&&<button onClick={()=>openPay(supplier)} disabled={!debt}><FiCreditCard/> To‘lov</button>}{canWrite&&<><button onClick={()=>openEdit(supplier)}><FiEdit2/> Tahrirlash</button><button onClick={()=>archive(supplier)}><FiArchive/> {supplier.archived?"Tiklash":"Arxiv"}</button></>}</div>
        </article>
      }):<div className="pro-empty full-grid"><FiTruck/><strong>Ta’minotchi topilmadi</strong><span>Filtr yoki qidiruvni o‘zgartiring.</span></div>}</div>
    </section>

    {compareRows.length>0&&<section className="pro-card supplier-price-compare"><div className="pro-card-head"><div><h2>Xarid narxi o‘zgarishi</h2><p>Oxirgi tannarx oldingi kirimga nisbatan qanday o‘zgarganini ko‘ring.</p></div></div><div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Mahsulot</th><th>Ta’minotchi</th><th>Oldingi narx</th><th>Oxirgi narx</th><th>O‘zgarish</th></tr></thead><tbody>{compareRows.map((row,index)=>{const change=row.current-row.previous;return <tr key={`${row.product}-${index}`}><td data-label="Mahsulot"><strong>{row.product}</strong></td><td data-label="Ta’minotchi">{row.supplier}</td><td data-label="Oldingi narx">{formatPrice(row.previous)}</td><td data-label="Oxirgi narx">{formatPrice(row.current)}</td><td data-label="O‘zgarish"><StatusBadge tone={change<=0?"success":"warning"}>{change>0?"+":""}{row.previous?Math.round(change/row.previous*100):0}%</StatusBadge></td></tr>})}</tbody></table></div></section>}

    <Modal open={modal==="edit"} onClose={closeEdit} title={editing?"Ta’minotchini tahrirlash":"Yangi ta’minotchi"} subtitle="Kontakt ma’lumotlari. Qarz esa Ombor → Kirim orqali avtomatik yuritiladi." footer={<><button className="pro-btn secondary" onClick={closeEdit}>Bekor qilish</button><button className="pro-btn primary" onClick={save}>Saqlash</button></>}><div className="pro-form-grid"><label className="pro-field full"><span>Nomi *</span><input data-modal-autofocus value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})}/>{errors.name&&<small className="field-error">{errors.name}</small>}</label><label className="pro-field"><span>Telefon *</span><input value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value})}/>{errors.phone&&<small className="field-error">{errors.phone}</small>}</label><label className="pro-field"><span>Kontakt shaxs</span><input value={form.contact} onChange={(event)=>setForm({...form,contact:event.target.value})}/></label><label className="pro-field"><span>Telegram</span><input value={form.telegram} onChange={(event)=>setForm({...form,telegram:event.target.value})}/></label><label className="pro-field"><span>Standart to‘lov muddati</span><PremiumDateInput value={form.deadline} onChange={(event)=>setForm({...form,deadline:event.target.value})}/></label><label className="pro-field full"><span>Izoh</span><textarea value={form.notes} onChange={(event)=>setForm({...form,notes:event.target.value})}/></label></div></Modal>

    <Modal open={modal==="pay"} onClose={closePay} title="Ta’minotchiga to‘lov" subtitle={selected?`${selected.name} · ochiq qarz ${formatPrice(selectedDebt)}`:""} size="sm" footer={<><button className="pro-btn secondary" onClick={closePay}>Bekor qilish</button><button className="pro-btn primary" disabled={!payAmount||Number(payAmount)<=0||Number(payAmount)>payMax} onClick={payment}>To‘lovni saqlash</button></>}><div className="pro-form-grid">{selectedInvoice&&<div className="supplier-pay-target full"><FiFileText/><span><small>Nakladnoy</small><strong>{selectedInvoice.invoiceNo||"Raqamsiz nakladnoy"}</strong></span><b>{formatPrice(invoiceBalance(selectedInvoice))}</b></div>}<label className="pro-field full"><span>Summa</span><input data-modal-autofocus type="number" min="0" max={payMax} value={payAmount} onChange={(event)=>setPayAmount(event.target.value)} placeholder={String(payMax)}/><small className="field-hint">Maksimum: {formatPrice(payMax)}</small></label><label className="pro-field full"><span>To‘lov turi</span><PremiumSelect value={payMethod} onChange={(event)=>{setPayMethod(event.target.value);if(event.target.value!=="cash")setPayFromRegister(false)}}><option value="cash">Naqd</option><option value="card">Karta</option><option value="transfer">O‘tkazma</option></PremiumSelect></label>{payMethod==="cash"&&activeShift&&<PremiumCheckbox className="supplier-register-payment full" checked={payFromRegister} onChange={(event)=>setPayFromRegister(event.target.checked)} title="Joriy kassadan to‘lash" description="Yoqilsa bu summa smenada kassa chiqimi sifatida qayd qilinadi."/>}<label className="pro-field full"><span>Izoh</span><textarea value={payNote} onChange={(event)=>setPayNote(event.target.value)}/></label></div></Modal>

    <Modal open={modal==="detail"&&!!selected} onClose={()=>{setModal(null);setSelected(null)}} title={selected?.name||"Ta’minotchi"} subtitle="Nakladnoylar, ochiq qarz, mahsulotlar va to‘lovlar." size="xl">
      <div className="supplier-detail-kpis"><div><span>Ochiq qarz</span><strong>{formatPrice(selectedDebt)}</strong></div><div><span>Jami to‘langan</span><strong>{formatPrice(selected?.paid||0)}</strong></div><div><span>Mahsulotlar</span><strong>{selected?supplierProducts(selected).length:0}</strong></div></div>
      <div className="supplier-detail-head"><div><h3>Nakladnoylar</h3><p>Kirimlar, to‘lovlar va ochiq qarz har bir hujjat bo‘yicha kuzatiladi.</p></div><div className="supplier-detail-actions"><ColumnPicker columns={supplierInvoiceColumnDefs} visible={invoiceColumns} onToggle={toggleInvoiceColumn}/>{canWrite&&selectedDebt>0&&<button className="pro-btn secondary" onClick={()=>openPay(selected)}><FiCreditCard/> Umumiy to‘lov</button>}</div></div>
      <div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Sana</th><th>Nakladnoy</th>{showInvoiceColumn("products")&&<th>Mahsulot</th>}{showInvoiceColumn("total")&&<th>Jami</th>}{showInvoiceColumn("paid")&&<th>To‘langan</th>}{showInvoiceColumn("balance")&&<th>Qoldiq</th>}{showInvoiceColumn("dueDate")&&<th>Muddat</th>}<th/></tr></thead><tbody>{selected?.purchaseHistory?.length?selected.purchaseHistory.map((row)=>{const balance=invoiceBalance(row);const status=invoiceStatus(row);return <tr key={row.id}><td data-label="Sana">{row.date||row.dateISO||"—"}</td><td data-label="Nakladnoy"><strong>{row.invoiceNo||"—"}</strong><small>{row.storeName||""}</small></td>{showInvoiceColumn("products")&&<td data-label="Mahsulot"><strong>{invoiceProductsLabel(row)}</strong>{invoiceItems(row).length>1&&<small>{invoiceItems(row).reduce((sum,item)=>sum+Number(item.quantity||0),0)} jami birlik</small>}</td>}{showInvoiceColumn("total")&&<td data-label="Jami">{formatPrice(row.total)}</td>}{showInvoiceColumn("paid")&&<td data-label="To‘langan">{formatPrice(row.paidAmount??(status==="paid"?row.total:0))}</td>}{showInvoiceColumn("balance")&&<td data-label="Qoldiq">{balance>0?<strong>{formatPrice(balance)}</strong>:<StatusBadge tone="success"><FiCheckCircle/> To‘langan</StatusBadge>}</td>}{showInvoiceColumn("dueDate")&&<td data-label="Muddat">{row.dueDate?<StatusBadge tone={balance>0&&isPast(row.dueDate,todayISO)?"danger":"neutral"}>{row.dueDate}</StatusBadge>:"—"}</td>}<td data-label="Amal">{canWrite&&balance>0&&<button className="pro-icon-text" onClick={()=>openPay(selected,row)}>To‘lash</button>}</td></tr>}):<tr><td colSpan={invoiceColumns.length+3}><div className="pro-empty"><span>Nakladnoylar hali yo‘q. Kirimlar Ombor modulidan qo‘shiladi.</span></div></td></tr>}</tbody></table></div>

      <h3 className="detail-subtitle">Ta’minotchi mahsulotlari</h3><div className="pro-table-wrap mobile-card-wrap"><table className="pro-table mobile-card-table"><thead><tr><th>Mahsulot</th><th>Qoldiq</th><th>Tannarx</th><th>Sotuv narxi</th></tr></thead><tbody>{selected&&supplierProducts(selected).length?supplierProducts(selected).map((product)=><tr key={product.id}><td data-label="Mahsulot"><strong>{product.name}</strong><small>{product.sku}</small></td><td data-label="Qoldiq">{product.quantity} {product.unit||"dona"}</td><td data-label="Tannarx">{formatPrice(product.costPrice)}</td><td data-label="Sotuv narxi">{formatPrice(product.sellPrice)}</td></tr>):<tr><td colSpan="4"><div className="pro-empty"><strong>Mahsulot biriktirilmagan</strong></div></td></tr>}</tbody></table></div>

      <h3 className="detail-subtitle">Hisob-kitob tarixi</h3><div className="ledger-list">{selected?.transactions?.length?selected.transactions.map((transaction)=><div key={transaction.id}><span><strong>{transaction.type==="payment"?"To‘lov":"Kirim"}</strong><small>{transaction.date} · {transaction.method==="credit"?"Qarzga":transaction.method==="paid"?"To‘langan":transaction.method||""}{transaction.invoiceNo?` · ${transaction.invoiceNo}`:""}</small></span><b className={transaction.type==="payment"?"ledger-payment":""}>{transaction.type==="payment"?"−":"+"}{formatPrice(transaction.amount)}</b></div>):<div className="pro-empty"><span>Tranzaksiyalar hali yo‘q</span></div>}</div>
    </Modal>
  </div>;
}

export default Suppliers;
