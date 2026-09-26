import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import { useAuth } from "./context/AuthContext";
import { useStore } from "./context/StoreContext";
import { ROLES } from "./config/roles";
import { workspaceAccessState } from "./utils/license";
import Forbidden from "./components/Forbidden";
import { PageSkeleton } from "./components/Ui";
import AppErrorBoundary from "./components/AppErrorBoundary";

const Login=lazy(()=>import("./pages/login/Login"));
const Register=lazy(()=>import("./pages/register/Register"));
const ChangePassword=lazy(()=>import("./pages/login/ChangePassword"));
const Dashboard=lazy(()=>import("./pages/dashboard/Dashboard"));
const Sales=lazy(()=>import("./pages/sales/Sales"));
const Products=lazy(()=>import("./pages/products/Products"));
const Inventory=lazy(()=>import("./pages/inventory/Inventory"));
const Suppliers=lazy(()=>import("./pages/suppliers/Suppliers"));
const History=lazy(()=>import("./pages/history/History"));
const Expenses=lazy(()=>import("./pages/expenses/Expenses"));
const Analytics=lazy(()=>import("./pages/analytics/Analytics"));
const SellerAnalytics=lazy(()=>import("./pages/sellerAnalytics/SellerAnalytics"));
const ActivityLog=lazy(()=>import("./pages/activityLog/ActivityLog"));
const Shifts=lazy(()=>import("./pages/shifts/Shifts"));
const Settings=lazy(()=>import("./pages/settings/Settings"));
const Billing=lazy(()=>import("./pages/billing/Billing"));
const PlatformAdmin=lazy(()=>import("./pages/platformAdmin/PlatformAdmin"));
const HelpCenter=lazy(()=>import("./pages/help/HelpCenter"));
const Profile=lazy(()=>import("./pages/profile/Profile"));

const management=[ROLES.OWNER,ROLES.ADMIN,ROLES.MANAGER];

function Protected({children,allowPasswordChange=false}){
  const{currentUser,authLoading}=useAuth();
  if(authLoading)return <Fallback/>;
  if(!currentUser)return <Navigate to="/login" replace/>;
  if(currentUser.forcePasswordChange&&!allowPasswordChange)return <Navigate to="/change-password" replace/>;
  return children;
}
function Access({children,roles}){
  const{currentUser,authLoading}=useAuth();
  if(authLoading)return <Fallback/>;
  if(!currentUser)return <Navigate to="/login" replace/>;
  if(!roles.includes(currentUser.appRole))return <Navigate to={currentUser.appRole===ROLES.PLATFORM_ADMIN?"/platform":[ROLES.CASHIER,ROLES.SALES].includes(currentUser.appRole)?"/sales":currentUser.appRole===ROLES.WAREHOUSE?"/inventory":"/"} replace/>;
  return children;
}

function PermissionAccess({children,permission}){
  const {currentUser,authLoading}=useAuth();
  const {hasPermission}=useStore();
  if(authLoading)return <Fallback/>;
  if(!currentUser)return <Navigate to="/login" replace/>;
  if(currentUser.appRole===ROLES.PLATFORM_ADMIN)return children;
  return hasPermission(permission,currentUser.appRole)?children:<Forbidden/>;
}

function FeatureAccess({children,feature}){
  const {currentUser,authLoading}=useAuth();
  const {businessFeatures}=useStore();
  if(authLoading)return <Fallback/>;
  if(!currentUser)return <Navigate to="/login" replace/>;
  if(businessFeatures?.[feature]===false)return <Forbidden/>;
  return children;
}

function WorkspaceAccess({children}){
  const { currentUser } = useAuth();
  const { organizations, payments, workspaceReady, branchAssignmentValid } = useStore();
  if (currentUser?.appRole === ROLES.PLATFORM_ADMIN) return children;
  if (!workspaceReady) return <Fallback/>;
  if (!branchAssignmentValid) return <Forbidden/>;
  const organization = organizations.find((item)=>item.id===currentUser?.organizationId);
  const orgPayments = payments.filter((item)=>item.organizationId===currentUser?.organizationId);
  const state = workspaceAccessState({ organization, payments: orgPayments });
  return state.allowed ? children : <Navigate to="/billing" replace/>;
}
const W=({children})=><WorkspaceAccess>{children}</WorkspaceAccess>;
const Fallback=()=> <PageSkeleton/>;

function App(){return <AppErrorBoundary><BrowserRouter><Suspense fallback={<Fallback/>}><Routes>
 <Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/change-password" element={<Protected allowPasswordChange><ChangePassword/></Protected>}/>
 <Route path="/activation" element={<Protected><Access roles={[ROLES.OWNER]}><Billing activation/></Access></Protected>}/>
 <Route path="/" element={<Protected><MainLayout/></Protected>}>
  <Route index element={<PermissionAccess permission="moduleDashboard"><W><Dashboard/></W></PermissionAccess>}/>
  <Route path="shifts" element={<PermissionAccess permission="moduleShifts"><W><Shifts/></W></PermissionAccess>}/>
  <Route path="sales" element={<PermissionAccess permission="moduleSales"><W><Sales/></W></PermissionAccess>}/>
  <Route path="products" element={<PermissionAccess permission="moduleProducts"><W><Products/></W></PermissionAccess>}/>
  <Route path="inventory" element={<PermissionAccess permission="moduleInventory"><W><Inventory/></W></PermissionAccess>}/>
  <Route path="suppliers" element={<PermissionAccess permission="moduleSuppliers"><FeatureAccess feature="supplierTracking"><W><Suppliers/></W></FeatureAccess></PermissionAccess>}/>
  <Route path="history" element={<PermissionAccess permission="moduleHistory"><W><History/></W></PermissionAccess>}/>
  <Route path="expenses" element={<PermissionAccess permission="moduleExpenses"><W><Expenses/></W></PermissionAccess>}/>
  <Route path="analytics" element={<PermissionAccess permission="moduleAnalytics"><W><Analytics/></W></PermissionAccess>}/>
  <Route path="activity-log" element={<PermissionAccess permission="moduleActivityLog"><W><ActivityLog/></W></PermissionAccess>}/>
  <Route path="seller-analytics" element={<PermissionAccess permission="moduleSellerAnalytics"><W><SellerAnalytics/></W></PermissionAccess>}/>
  <Route path="settings" element={<PermissionAccess permission="moduleSettings"><W><Settings/></W></PermissionAccess>}/>
  <Route path="billing" element={<PermissionAccess permission="moduleBilling"><Billing/></PermissionAccess>}/>
  <Route path="help" element={<W><HelpCenter/></W>}/>
  <Route path="profile" element={<Profile/>}/>
  <Route path="platform" element={<Access roles={[ROLES.PLATFORM_ADMIN]}><PlatformAdmin/></Access>}/>
 </Route>
 <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></Suspense></BrowserRouter></AppErrorBoundary>}
export default App;
