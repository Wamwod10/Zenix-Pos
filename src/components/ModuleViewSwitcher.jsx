import { FiGrid, FiList } from "react-icons/fi";
import "./moduleViewSwitcher.scss";
export default function ModuleViewSwitcher({view,onChange,label}){return <div className="module-view-switch" role="group" aria-label={label}>{[["grid","Kartalar",FiGrid],["list","Jadval",FiList]].map(([value,title,Icon])=><button key={value} type="button" title={title} aria-label={title} aria-pressed={view===value} className={view===value?"active":""} onClick={()=>onChange(value)}><Icon/></button>)}</div>}

export function ModulePagination({page,totalPages,total,onChange}){return totalPages>1&&<div className="platform-pagination"><span>{total} ta · {page}/{totalPages} sahifa</span><div><button className="pro-btn secondary" disabled={page===1} onClick={()=>onChange(page-1)}>Oldingi</button><button className="pro-btn secondary" disabled={page===totalPages} onClick={()=>onChange(page+1)}>Keyingi</button></div></div>}
