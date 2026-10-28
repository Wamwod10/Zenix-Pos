// Shared calendar-date rule for Sales and POS Pro.
// Always compare DATE strings from the organization's timezone, not the host clock.
export function isValidCalendarDateISO(value){
 if(typeof value!=='string'||!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00.000Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export const isAcceptableCreditDueDate=(value,todayISO)=>isValidCalendarDateISO(value)&&isValidCalendarDateISO(todayISO)&&value>=todayISO;
