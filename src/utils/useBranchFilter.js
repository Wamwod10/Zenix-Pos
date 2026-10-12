import {useState} from 'react';

// Derive the new scope during render so old totals never flash on a new branch.
export default function useBranchFilter(currentStoreId){
  const [selection,setSelection]=useState({branch:currentStoreId,value:currentStoreId});
  if(selection.branch!==currentStoreId){
    setSelection({branch:currentStoreId,value:currentStoreId});
  }
  const value=selection.branch===currentStoreId?selection.value:currentStoreId;
  const setValue=value=>setSelection({branch:currentStoreId,value});
  return [value,setValue];
}
