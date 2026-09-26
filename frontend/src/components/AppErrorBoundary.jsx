import { Component } from "react";
import { FiAlertTriangle, FiHome, FiRefreshCw } from "react-icons/fi";

export default class AppErrorBoundary extends Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }
  static getDerivedStateFromError(){ return {hasError:true}; }
  componentDidCatch(error,info){
    console.error("ZENIX POS UI error",error,info);
  }
  render(){
    if(!this.state.hasError)return this.props.children;
    return <div className="app-crash-state"><div className="app-crash-card"><div className="app-crash-icon"><FiAlertTriangle/></div><h1>Sahifani ko‘rsatishda xato yuz berdi</h1><p>Ma’lumotlaringiz saqlangan. Sahifani qayta yuklang yoki boshqaruv paneliga qayting.</p><div><button onClick={()=>window.location.reload()}><FiRefreshCw/> Qayta yuklash</button><button onClick={()=>{window.location.href="/"}}><FiHome/> Boshqaruv paneli</button></div></div></div>;
  }
}
