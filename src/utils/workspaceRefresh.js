export const createWorkspaceRefreshScheduler = ({
  refresh,
  currentIdentity,
  delay=1200,
}) => {
  let timer=null;
  let running=false;
  let dirty=false;
  let dirtyIdentity=null;
  let disposed=false;

  const cancel=()=>{
    if(timer!==null)clearTimeout(timer);
    timer=null;
    dirty=false;
    dirtyIdentity=null;
    disposed=true;
  };

  const schedule=(scheduledIdentity)=>{
    if(disposed)return;
    if(running){dirty=true;dirtyIdentity=scheduledIdentity;return}
    if(timer!==null)return;
    timer=setTimeout(async()=>{
      timer=null;
      if(disposed||currentIdentity()!==scheduledIdentity)return;
      running=true;
      try{await refresh(scheduledIdentity)}catch{}
      finally{
        running=false;
        if(dirty&&!disposed){
          const nextIdentity=dirtyIdentity;
          dirty=false;
          dirtyIdentity=null;
          schedule(nextIdentity);
        }
      }
    },delay);
  };

  return {schedule,cancel};
};

export const normalizeOpenedShift = (serverShift = {}, optimisticShift = {}) => ({
  ...optimisticShift,
  ...serverShift,
  storeId:serverShift.store_id||serverShift.storeId||optimisticShift.storeId,
  cashierId:serverShift.cashier_id||serverShift.cashierId||optimisticShift.cashierId,
  openingCash:Number(serverShift.opening_cash??serverShift.openingCash??optimisticShift.openingCash??0),
  openedAtISO:serverShift.opened_at||serverShift.openedAtISO||optimisticShift.openedAtISO,
});

export const withOpenedShift = (activeShifts, openedShift, fallbackStoreId) => {
  const storeId=openedShift?.store_id||openedShift?.storeId||fallbackStoreId;
  if(!storeId||!openedShift)return activeShifts;
  return {...(activeShifts||{}),[storeId]:openedShift};
};
