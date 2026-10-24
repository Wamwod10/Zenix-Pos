import { useEffect, useState } from "react";
import { modulePage } from "./modulePage";
export default function useModulePage(items,scope){
 const [cursor,setCursor]=useState({scope,page:1});
 const result=modulePage(items,cursor.scope===scope?cursor.page:1);
 useEffect(()=>{setCursor(previous=>previous.scope===scope&&previous.page===result.page?previous:{scope,page:result.page})},[scope,result.page]);
 return {...result,setPage:page=>setCursor({scope,page})};
}
