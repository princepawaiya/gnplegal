  import { Routes, Route, Navigate } from "react-router-dom";
  import { useEffect } from "react";
  import WelcomeScreen from "./pages/WelcomeScreen";
  import { useNavigate } from "react-router-dom";

  // Pages
  import Dashboard from "./pages/Dashboard";
  import Matters from "./pages/Matters";
  import MatterDetail from "./pages/MatterDetail";
  import Clients from "./pages/Clients";
  import Login from "./pages/Login";
  import Alerts from "./pages/Alerts";
  import ClientDashboard from "./pages/ClientDashboard";
  import Roles from "./pages/Roles";
  import UserManagement from "./pages/UserManagement";
  import MatterTimeline from "./pages/MatterTimeline";
  import { getUserFromToken } from "./utils/permissions";
  import Signup from "./pages/Signup";
  import ClientDetail from "./pages/ClientDetail";
  import CreateMatter from "./pages/CreateMatter";
  import LocalCounsels from "./pages/LocalCounsels";
  import CreateCounsel from "./pages/CreateCounsel";
  import CauseList from "./pages/CauseList";
  import MIS from "./pages/MIS";
  import MISBuilder from "./pages/MISBuilder";
  import Invoices from "./pages/Invoices";
  import InvoiceTracker from "./pages/InvoiceTracker";
  import ImportMatters from "./pages/ImportMatters";

  // GNP Counsel Pages
  import GNPCounselDashboard from "./pages/GNPCounselDashboard";
  import GNPCounselCases from "./pages/GNPCounselCases";
  import GNPCounselHearings from "./pages/GNPCounselHearings";
  import GNPCounselDocuments from "./pages/GNPCounselDocuments";
  import GNPCounselPerformance from "./pages/GNPCounselPerformance";
  import GNPCounselKnowledgeHub from "./pages/GNPCounselKnowledgeHub";
  import GNPCounselSettings from "./pages/GNPCounselSettings";
  import StickyTasks from "./components/dashboard/StickyTasks";

  // ✅ NEW LAYOUT (IMPORTANT)
  import CounselLayout from "./components/dashboard/CounselLayout";

  // Layout
  import Layout from "./components/Layout";

  // Protected
  import Protected from "./components/Protected";

  /* ================= APP ================= */

  export default function App() {

    useEffect(() => {
      const saved = localStorage.getItem("theme") || "light";

      if (saved === "dark") {
        document.documentElement.style.setProperty("--bg", "#0f172a");
        document.documentElement.style.setProperty("--card", "#1e293b");
        document.documentElement.style.setProperty("--text", "#f1f5f9");
        document.documentElement.style.setProperty("--subtext", "#94a3b8");
      } else {
        document.documentElement.style.setProperty("--bg", "#f8fafc");
        document.documentElement.style.setProperty("--card", "#ffffff");
        document.documentElement.style.setProperty("--text", "#0f172a");
        document.documentElement.style.setProperty("--subtext", "#64748b");
      }
    }, []);

    return (
      <Routes>

        {/* PUBLIC */}
        <Route path="/welcome" element={<WelcomeScreenWrapper />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DefaultRedirect />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/admin/mis-builder" element={<MISBuilder />} />
        
        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >

        <Route
          path="import-matters"
          element={
            <Protected requiredPermission="matters:view">
              <ImportMatters />
            </Protected>
          }
        />  
          <Route path="matters/:id/timeline" element={<Protected requiredPermission="matters:view"><MatterTimeline /></Protected>} />
          <Route path="local-counsels" element={<Protected requiredPermission="matters:view"><LocalCounsels /></Protected>} />
          <Route path="local-counsels/create" element={<Protected requiredPermission="matters:view"><CreateCounsel /></Protected>} />
          <Route path="local-counsels/:id/edit" element={<Protected requiredPermission="matters:view"><CreateCounsel /></Protected>} />
          <Route path="users" element={<Protected requiredPermission="users:manage"><UserManagement /></Protected>} />

          <Route index element={<Protected requiredPermission="dashboard:view"><Dashboard /></Protected>} />

          <Route path="matters/new" element={<Protected><CreateMatter /></Protected>} />
          <Route path="matters" element={<Protected requiredPermission="matters:view"><Matters /></Protected>} />
          <Route path="matters/:id" element={<Protected requiredPermission="matters:view"><MatterDetail /></Protected>} />
          <Route path="clients" element={<Protected requiredPermission="clients:view"><Clients /></Protected>} />
          <Route path="alerts" element={<Protected requiredPermission="alerts:view"><Alerts /></Protected>} />
          <Route path="cause-list" element={<Protected requiredPermission="cause-list:view"><CauseList /></Protected>} />
          <Route path="mis" element={<Protected requiredPermission="mis:view"><MIS /></Protected>} />
          <Route path="invoices" element={<Protected requiredPermission="invoices:view"><Invoices /></Protected>} />
          <Route path="roles" element={<Protected requiredPermission="users:manage"><Roles /></Protected>} />
          <Route path="invoices/tracker" element={<Protected requiredPermission="invoices:view"><InvoiceTracker /></Protected>} />
        </Route>

        {/* LAWYER (LCMS SYSTEM - CLEAN) */}
        <Route
          path="/lawyer"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<Protected requiredPermission="dashboard:view"><Dashboard /></Protected>} />
          <Route path="matters" element={<Protected requiredPermission="matters:view"><Matters /></Protected>} />
          <Route path="matters/:id" element={<Protected requiredPermission="matters:view"><MatterDetail /></Protected>} />
          <Route path="matters/:id/timeline" element={<Protected requiredPermission="matters:view"><MatterTimeline /></Protected>} />
          <Route path="alerts" element={<Protected requiredPermission="alerts:view"><Alerts /></Protected>} />
        </Route>

        {/* ✅ GNP COUNSEL (SEPARATE — NOT NESTED) */}
        <Route
          path="/gnp"
          element={
            <Protected>
              <CounselLayout />
            </Protected>
          }
        >
          <Route path="dashboard" element={<GNPCounselDashboard />} />
          <Route path="cases" element={<GNPCounselCases />} />
          <Route path="matters/create" element={<CreateMatter />} />
          <Route path="local-counsels/create" element={<CreateCounsel />} />
          <Route path="local-counsels/:id/edit" element={<CreateCounsel />} />
          <Route path="matters/:id" element={<Protected requiredPermission="matters:view"><MatterDetail /></Protected>} />
          <Route path="cases/:id/timeline" element={<Protected requiredPermission="matters:view"><MatterTimeline /></Protected>} />
          <Route path="hearings" element={<GNPCounselHearings />} />
          <Route path="documents" element={<GNPCounselDocuments />} />
          <Route path="performance" element={<GNPCounselPerformance />} />
          <Route path="knowledge" element={<GNPCounselKnowledgeHub />} />
          <Route path="settings" element={<GNPCounselSettings />} />
          <Route path="tasks" element={<StickyTasks />} />
        </Route>

        {/* CLIENT */}
        <Route
          path="/client"
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<Protected requiredPermission="dashboard:view"><ClientDashboard /></Protected>} />
          <Route path="matters" element={<Protected requiredPermission="matters:view"><Matters /></Protected>} />
          <Route path="matters/:id" element={<Protected requiredPermission="matters:view"><MatterDetail /></Protected>} />
          <Route path="matters/:id/timeline" element={<Protected requiredPermission="matters:view"><MatterTimeline /></Protected>} />
        </Route>

        {/* GLOBAL */}
        <Route path="invoices/tracker" element={<Protected requiredPermission="invoices:view"><InvoiceTracker /></Protected>} />

        {/* DEFAULT */}
        <Route path="*" element={<DefaultRedirect />} />

      </Routes>
    );
  }

  /* ================= DEFAULT REDIRECT ================= */

  function DefaultRedirect() {
    const user = getUserFromToken();

    if (user === null) {
      return <Navigate to="/login" replace />;
    }

    if (user.role_id === 3) {
      return <Navigate to="/welcome" replace />;
    }

    if (user.role === "admin") {
      return <Navigate to="/admin" replace />;
    }

    if (user.role === "lawyer") {
      return <Navigate to="/lawyer" replace />;
    }

    if (user.role === "gnp_counsel" || user.role === "gnp counsel") {
      return <Navigate to="/gnp/dashboard" replace />;
    }

    if (user.role === "client") {
      return <Navigate to="/client" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  function WelcomeScreenWrapper() {
    const navigate = useNavigate();

    function handleContinue() {
      navigate("/gnp/dashboard", { replace: true });
    }

    return <WelcomeScreen onContinue={handleContinue} />;
  }