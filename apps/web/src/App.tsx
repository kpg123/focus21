import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ViewerDashboard } from "./pages/ViewerDashboard";
import { ChannelPortal } from "./pages/ChannelPortal";
import { SurveyTakePage } from "./pages/SurveyTakePage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="section muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route
          path="dashboard"
          element={
            <Protected>
              <ViewerDashboard />
            </Protected>
          }
        />
        <Route
          path="portal"
          element={
            <Protected>
              <ChannelPortal />
            </Protected>
          }
        />
        <Route
          path="surveys/:id"
          element={
            <Protected>
              <SurveyTakePage />
            </Protected>
          }
        />
      </Route>
    </Routes>
  );
}
