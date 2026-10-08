export const SETTINGS_TAB_NAMES = [
  "Tashkilot","Filiallar","Xodimlar","Ruxsatlar","Chek","POS","Ombor","Ish kuni",
  "Bildirishnomalar","Telegram","Interfeys","Funksiyalar","Eksport","Diagnostika","Tarix",
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
