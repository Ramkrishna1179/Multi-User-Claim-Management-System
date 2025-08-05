import React, { memo, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreatePost from "./pages/CreatePost";
import ClaimForm from "./pages/ClaimForm";
import ReviewClaim from "./pages/ReviewClaim";
import FinalApproval from "./pages/FinalApproval";
import Reports from "./pages/Reports";
import AdminSettings from "./pages/AdminSettings";

import "./App.css";

const MemoizedDashboard = memo(Dashboard);
const MemoizedCreatePost = memo(CreatePost);
const MemoizedClaimForm = memo(ClaimForm);
const MemoizedReviewClaim = memo(ReviewClaim);
const MemoizedFinalApproval = memo(FinalApproval);
const MemoizedReports = memo(Reports);
const MemoizedLogin = memo(Login);
const MemoizedAdminSettings = memo(AdminSettings);

const App: React.FC = () => {
  const toastOptions = useMemo(() => ({
            duration: 2000,
    style: {
      background: "#363636",
      color: "#fff",
    },
    success: {
              duration: 2500,
      iconTheme: {
        primary: "#28a745",
        secondary: "#fff",
      },
    },
    error: {
              duration: 3000,
      iconTheme: {
        primary: "#dc3545",
        secondary: "#fff",
      },
    },
  }), []);

  const AppContent: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    
    const shouldShowNavbar = isAuthenticated && location.pathname !== '/login';

    return (
      <div className="App">
        <Toaster
          position="top-right"
          toastOptions={toastOptions}
        />

        {shouldShowNavbar && <Navbar />}

        <main className="main-content">
          <Routes>
            <Route path="/login" element={<MemoizedLogin />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MemoizedDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/create-post"
              element={
                <ProtectedRoute>
                  <MemoizedCreatePost />
                </ProtectedRoute>
              }
            />

            <Route
              path="/submit-claim"
              element={
                <ProtectedRoute allowedRoles={["user"]}>
                  <MemoizedClaimForm />
                </ProtectedRoute>
              }
            />

            <Route
              path="/review-claims"
              element={
                <ProtectedRoute allowedRoles={["account", "admin"]}>
                  <MemoizedReviewClaim />
                </ProtectedRoute>
              }
            />

            <Route
              path="/final-approval"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <MemoizedFinalApproval />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <MemoizedReports />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin-settings"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <MemoizedAdminSettings />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    );
  };

  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
};

export default memo(App);
