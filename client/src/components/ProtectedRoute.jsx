import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { LoadingState } from "./LoadingState.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <LoadingState message="Checking your session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
