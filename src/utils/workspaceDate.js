const DATE_FORMATS = {
  "DD.MM.YYYY": { day:"2-digit", month:"2-digit", year:"numeric" },
  "MM/DD/YYYY": { month:"2-digit", day:"2-digit", year:"numeric" },
  "YYYY-MM-DD": { year:"numeric", month:"2-digit", day:"2-digit" },
};

export const workspaceDateISO = (value = new Date(), timezone = "Asia/Tashkent") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year:"numeric", month:"2-digit", day:"2-digit",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part)=>[part.type,part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};


const shiftISODate = (key, amount) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return "";
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(amount || 0));
  return date.toISOString().slice(0, 10);
};

const workspaceDateTimeParts = (value = new Date(), timezone = "Asia/Tashkent") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part)=>[part.type,part.value]));
};

export const workspaceBusinessDateISO = (value = new Date(), organization = {}, businessDay = {}) => {
  const timezone = organization?.timezone || "Asia/Tashkent";
  const parts = workspaceDateTimeParts(value, timezone);
  const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
  const [startHourRaw,startMinuteRaw] = String(businessDay?.startTime || "00:00").split(":");
  const startHour = Math.max(0, Math.min(23, Number(startHourRaw || 0)));
  const startMinute = Math.max(0, Math.min(59, Number(startMinuteRaw || 0)));
  const currentMinutes = Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
  const startMinutes = startHour * 60 + startMinute;
  return currentMinutes < startMinutes ? shiftISODate(calendarDate, -1) : calendarDate;
};

export const formatWorkspaceDate = (value, organization = {}, { withTime = false, short = false } = {}) => {
  if (!value) return "—";
  const timezone = organization.timezone || "Asia/Tashkent";
  const dateFormat = organization.dateFormat || "DD.MM.YYYY";
  const hour12 = organization.timeFormat === "12";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  if (short) return new Intl.DateTimeFormat("uz-UZ", { timeZone:timezone, day:"2-digit", month:"short" }).format(date);
  const opts = { timeZone:timezone, ...(DATE_FORMATS[dateFormat] || DATE_FORMATS["DD.MM.YYYY"]) };
  if (withTime) Object.assign(opts,{hour:"2-digit",minute:"2-digit",hour12});
  const locale = dateFormat === "MM/DD/YYYY" ? "en-US" : dateFormat === "YYYY-MM-DD" ? "en-CA" : "uz-UZ";
  return new Intl.DateTimeFormat(locale,opts).format(date);
};

export const workspaceTime = (value = new Date(), organization = {}) => new Intl.DateTimeFormat("uz-UZ", {
  timeZone:organization.timezone || "Asia/Tashkent", hour:"2-digit", minute:"2-digit", hour12:organization.timeFormat === "12",
}).format(new Date(value));
