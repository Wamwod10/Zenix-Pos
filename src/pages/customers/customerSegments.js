import {safeCsvCell} from '../../utils/safeCsvCell.js';
export const customerSegmentOptions=[
 ['all','Barcha mijozlar'],['debtors','Qarzdorlar'],['overdue','Muddati o‘tgan qarzlar'],
 ['vip','VIP'],['regular','Oddiy mijozlar'],['wholesale','Ulgurji mijozlar'],
 ['tier-standard','Loyalty — Standard'],['tier-silver','Loyalty — Silver'],['tier-gold','Loyalty — Gold'],['tier-vip','Loyalty — VIP'],
 ['loyalty-points','Bonus balli mavjud'],['new-30','Yangi mijozlar (30 kun)'],['never-purchased','Hali xarid qilmagan'],['lapsed-30','30+ kun xarid qilmagan'],['lapsed-60','60+ kun xarid qilmagan'],['lapsed-90','90+ kun xarid qilmagan'],['active','Faol'],['inactive','Nofaol']
];
export const normalizeCustomerSegment=value=>customerSegmentOptions.some(([id])=>id===value)?value:'all';
export function customerExportCsv(items=[]){
 const rows=[['Ism','Telefon','Email','Turi','Loyalty darajasi','Bonus ballari','Qarz','Jami xarid','Taglar'],...items.map(c=>[c.name,c.phone,c.email,c.customerType,c.loyaltyTier||'STANDARD',c.loyaltyPoints??0,c.balance,c.totalPurchases,(c.tags||[]).join(', ')])];
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}
