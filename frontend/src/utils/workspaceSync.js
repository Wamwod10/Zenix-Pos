const noopListener=()=>()=>{};

export const createWorkspaceSyncController=({
  getVersion,
  refresh,
  getIdentity,
  isVisible=()=>true,
  addVisibilityListener=noopListener,
  addOnlineListener=noopListener,
  setTimer=(fn,delay)=>setTimeout(fn,delay),
  clearTimer=(timer)=>clearTimeout(timer),
  pollMs=1000,
  fallbackMs=60000,
})=>{
  let stopped=false;
  let started=false;
  let revision=null;
  let inFlight=null;
  let refreshInFlight=null;
  let dirty=false;
  let fallbackPending=false;
  let failures=0;
  let pollTimer=null;
  let fallbackTimer=null;
  let removeVisibility=noopListener();
  let removeOnline=noopListener();

  const sameIdentity=(identity)=>Boolean(identity)&&getIdentity()===identity&&!stopped;
  const clearPoll=()=>{if(pollTimer!==null)clearTimer(pollTimer);pollTimer=null};
  const clearFallback=()=>{if(fallbackTimer!==null)clearTimer(fallbackTimer);fallbackTimer=null};

  const performRefresh=async(identity)=>{
    if(!sameIdentity(identity))return;
    if(refreshInFlight)return refreshInFlight;
    refreshInFlight=(async()=>{
      if(!sameIdentity(identity))return;
      await refresh(identity);
    })();
    try{await refreshInFlight}finally{refreshInFlight=null}
  };

  const schedulePoll=(delay=pollMs)=>{
    if(!started||stopped)return;
    clearPoll();
    pollTimer=setTimer(()=>{pollTimer=null;void checkNow()},delay);
  };

  const scheduleFallback=()=>{
    if(!started||stopped)return;
    clearFallback();
    fallbackTimer=setTimer(async()=>{
      fallbackTimer=null;
      const identity=getIdentity();
      if(isVisible()&&identity){
        if(inFlight)fallbackPending=true;
        else await performRefresh(identity).catch(()=>{});
      }
      scheduleFallback();
    },fallbackMs);
  };

  const checkNow=()=>{
    if(stopped||!isVisible())return Promise.resolve();
    const identity=getIdentity();
    if(!identity)return Promise.resolve();
    if(inFlight){dirty=true;return inFlight}
    inFlight=(async()=>{
      let failed=false;
      try{
        const result=await getVersion(identity);
        if(!sameIdentity(identity))return;
        const nextRevision=Number(result?.revision||0);
        if(revision===null)revision=nextRevision;
        else if(nextRevision!==revision){
          revision=nextRevision;
          await performRefresh(identity);
        }
        failures=0;
      }catch{
        failed=true;
        failures=Math.min(failures+1,5);
      }finally{
        inFlight=null;
        if(fallbackPending&&!stopped){fallbackPending=false;await performRefresh(identity).catch(()=>{})}
        if(dirty&&!stopped){dirty=false;await checkNow();return}
        schedulePoll(failed?pollMs*(2**failures):pollMs);
      }
    })();
    return inFlight;
  };

  const start=()=>{
    if(started&&!stopped)return;
    stopped=false;started=true;
    removeVisibility=addVisibilityListener(()=>{if(isVisible())void checkNow()});
    removeOnline=addOnlineListener(()=>{if(isVisible())void checkNow()});
    scheduleFallback();
    void checkNow();
  };

  const stop=()=>{
    stopped=true;started=false;dirty=false;fallbackPending=false;
    clearPoll();clearFallback();removeVisibility();removeOnline();
    removeVisibility=noopListener();removeOnline=noopListener();
  };

  return {start,checkNow,stop};
};
