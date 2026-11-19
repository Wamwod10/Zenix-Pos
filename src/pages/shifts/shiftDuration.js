// Presentation only: absent or invalid server timestamps must not become a fake duration.
export function shiftDurationMs(openedAtISO,now=Date.now()){
  if(typeof openedAtISO!=='string'||!openedAtISO.trim()||!Number.isFinite(now))return null;
  const opened=Date.parse(openedAtISO);
  return Number.isFinite(opened)?Math.max(0,now-opened):null;
}
export function shiftDurationLabel(duration){
  return Number.isFinite(duration)&&duration>=0
    ? `${Math.floor(duration/3600000)} soat ${Math.floor((duration%3600000)/60000)} daqiqa`
    : '—';
}
