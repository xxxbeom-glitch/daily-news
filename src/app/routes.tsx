import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ArchivePageWrapper } from "./components/ArchivePageWrapper";
import { SettingsPageWrapper } from "./components/SettingsPageWrapper";
import { SearchPageWrapper } from "./components/SearchPageWrapper";
import { AdminPage } from "./components/AdminPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ArchivePageWrapper /> },
      { path: "search", element: <SearchPageWrapper /> },
      { path: "keyword", element: <Navigate to="/" replace /> },
      { path: "scrap", element: <Navigate to="/" replace /> },
      { path: "admin", element: <Navigate to="/settings/admin" replace /> },
      {
        path: "settings",
        element: <Outlet />,
        children: [
          { index: true, element: <SettingsPageWrapper /> },
          { path: "admin", element: <AdminPage /> },
        ],
      },
    ],
  },
]);
