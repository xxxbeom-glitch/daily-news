import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ArchivePageWrapper } from "./components/ArchivePageWrapper";
import { SettingsPageWrapper } from "./components/SettingsPageWrapper";
import { SearchPage } from "./components/SearchPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ArchivePageWrapper /> },
      { path: "search", element: <SearchPage /> },
      { path: "keyword", element: <Navigate to="/" replace /> },
      { path: "scrap", element: <Navigate to="/" replace /> },
      { path: "settings", element: <SettingsPageWrapper /> },
    ],
  },
]);
