import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ReportPageWrapper } from "./components/ReportPageWrapper";
import { SettingsPageWrapper } from "./components/SettingsPageWrapper";
import { SearchPageWrapper } from "./components/SearchPageWrapper";
import { AdminPage } from "./components/AdminPage";
import { LoginPage } from "./components/LoginPage";
import { TestPage } from "./components/TestPage";
import { UploadPage } from "./components/UploadPage";
import { MarketDashboardPage } from "./components/MarketDashboardPage";
import { ScrapPage } from "./components/ScrapPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ReportPageWrapper /> },
      { path: "market", element: <MarketDashboardPage /> },
      { path: "search", element: <SearchPageWrapper /> },
      { path: "test", element: <TestPage /> },
      { path: "upload", element: <UploadPage /> },
      { path: "keyword", element: <Navigate to="/" replace /> },
      { path: "scrap", element: <Navigate to="/" replace /> },
      { path: "admin", element: <Navigate to="/settings/admin" replace /> },
      {
        path: "settings",
        element: <Outlet />,
        children: [
          { index: true, element: <SettingsPageWrapper /> },
          { path: "scrap", element: <ScrapPage /> },
          { path: "login", element: <LoginPage /> },
          { path: "admin", element: <AdminPage /> },
        ],
      },
    ],
  },
]);
