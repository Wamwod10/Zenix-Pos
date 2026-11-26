export const SETTINGS_TAB_NAMES = [
  "Tashkilot","Filiallar","Xodimlar","Ruxsatlar","Chek","POS","Ombor","Ish kuni",
  "Bildirishnomalar","Telegram","Interfeys","Funksiyalar","Eksport","Diagnostika","Tarix","Xavfsizlik",
];

export const settingsTabFromSearch = (search = "") => {
  const requested=new URLSearchParams(search).get("tab");
  return SETTINGS_TAB_NAMES.includes(requested)?requested:"Tashkilot";
};

export const settingsSearchForTab = (search = "", tab = "Tashkilot") => {
  const params=new URLSearchParams(search);
  params.set("tab",SETTINGS_TAB_NAMES.includes(tab)?tab:"Tashkilot");
  const next=params.toString();
  return next?`?${next}`:"";
};

export const SETTINGS_GROUPS=[
 {id:"business",label:"Biznes boshqaruvi",tabs:["Tashkilot","Filiallar","Xodimlar","Ruxsatlar","Funksiyalar"]},
 {id:"sales",label:"Savdo va kassa",tabs:["POS","Chek","Ombor","Ish kuni"]},
 {id:"automation",label:"Aloqa va avtomatlashtirish",tabs:["Bildirishnomalar","Telegram"]},
 {id:"system",label:"Tizim va xavfsizlik",tabs:["Interfeys","Xavfsizlik","Eksport","Diagnostika","Tarix"]},
];
export const normalizeSettingsSearch=value=>String(value??"").toLowerCase().normalize("NFKD").replace(/[‘’ʻʼ`']/g,"").replace(/[–—_-]/g," ").replace(/\s+/g," ").trim();
export function searchSettingsTabs(index,query){
 const tokens=normalizeSettingsSearch(query).split(" ").filter(Boolean);
 if(!tokens.length)return SETTINGS_TAB_NAMES.slice();
 return SETTINGS_TAB_NAMES.filter(name=>{
  const group=SETTINGS_GROUPS.find(item=>item.tabs.includes(name));
  const hay=normalizeSettingsSearch([name,group?.label,...index.filter(row=>row[1]===name).map(row=>row[0])].join(" "));
  return tokens.every(token=>hay.includes(token));
 });
}
export function settingsAuditQuery({query="",page=0,from="",to=""}={}){
 const params=new URLSearchParams({type:"settings",q:String(query).trim().slice(0,100),limit:"20",offset:String(Math.max(0,Math.min(50000,Math.floor(Number(page)||0)))*20)});
 if(/^\d{4}-\d{2}-\d{2}$/.test(from))params.set("from",from);
 if(/^\d{4}-\d{2}-\d{2}$/.test(to))params.set("to",to);
 return params.toString();
}
