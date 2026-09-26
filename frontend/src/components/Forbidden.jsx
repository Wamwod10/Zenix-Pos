import { FiArrowLeft, FiLock } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

export default function Forbidden({ title="Bu bo‘lim uchun ruxsat yo‘q", description="Sizning rolingiz ushbu modulni ko‘rishga ruxsat bermaydi." }){
  const navigate=useNavigate();
  return <div className="permission-state"><div className="permission-state-icon"><FiLock/></div><span>403 · Ruxsat cheklangan</span><h1>{title}</h1><p>{description}</p><button className="pro-btn secondary" onClick={()=>navigate(-1)}><FiArrowLeft/> Orqaga qaytish</button></div>;
}
