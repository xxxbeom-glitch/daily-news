import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ArchivePageWrapper } from "./components/ArchivePageWrapper";
import { SettingsPageWrapper } from "./components/SettingsPageWrapper";
import { SearchPageWrapper } from "./components/SearchPageWrapper";
import { AdminPage } from "./components/AdminPage";
import { LoginPage } from "./components/LoginPage";
import { TestPage } from "./components/TestPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ArchivePageWrapper /> },
      { path: "search", element: <SearchPageWrapper /> },
      { path: "test", element: <TestPage /> },
      { path: "keyword", element: <Navigate to="/" replace /> },
      { path: "scrap", element: <Navigate to="/" replace /> },
      { path: "admin", element: <Navigate to="/settings/admin" replace /> },
      {
        path: "settings",
        element: <Outlet />,
        children: [
          { index: true, element: <SettingsPageWrapper /> },
          { path: "login", element: <LoginPage /> },
          { path: "admin", element: <AdminPage /> },
        ],
      },
    ],
  },
]);
