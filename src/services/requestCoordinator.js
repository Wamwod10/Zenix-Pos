export const createRequestCoordinator = () => {
  let generation=0;
  const inflightGets=new Map();

  const invalidate=()=>{
    generation+=1;
    inflightGets.clear();
  };

  const get=(key,start)=>{
    const scopedKey=`${generation}:${key}`;
    const existing=inflightGets.get(scopedKey);
    if(existing)return existing;
    const request=Promise.resolve().then(start);
    inflightGets.set(scopedKey,request);
    request.finally(()=>{
      if(inflightGets.get(scopedKey)===request)inflightGets.delete(scopedKey);
    }).catch(()=>undefined);
    return request;
  };

  const mutate=async(start)=>{
    invalidate();
    try{return await start()}
    finally{invalidate()}
  };

  return {get,mutate};
};
