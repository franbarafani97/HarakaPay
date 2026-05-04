import { type ReactElement } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useMe } from "./hooks/useAuth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NewBill from "./pages/NewBill";
import BillsInbox from "./pages/BillsInbox";
import BillDetail from "./pages/BillDetail";

function RequireAuth({ children }: { children: ReactElement }) {
  const { data: user, isLoading } = useMe();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }: { children: ReactElement }) {
  const { data: user, isLoading } = useMe();
  if (isLoading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthed>
              <Signup />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/bills"
          element={
            <RequireAuth>
              <BillsInbox />
            </RequireAuth>
          }
        />
        <Route
          path="/bills/new"
          element={
            <RequireAuth>
              <NewBill />
            </RequireAuth>
          }
        />
        <Route
          path="/bills/:id"
          element={
            <RequireAuth>
              <BillDetail />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
