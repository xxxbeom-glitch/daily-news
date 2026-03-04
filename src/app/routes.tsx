import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SearchPageWrapper } from "./components/SearchPageWrapper";
import { KeywordNewsPageWrapper } from "./components/KeywordNewsPageWrapper";
import { ScrapPageWrapper } from "./components/ScrapPageWrapper";
import { ArchivePageWrapper } from "./components/ArchivePageWrapper";
import { SettingsPageWrapper } from "./components/SettingsPageWrapper";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ArchivePageWrapper /> },
      { path: "search", element: <SearchPageWrapper /> },
      { path: "keyword", element: <KeywordNewsPageWrapper /> },
      { path: "scrap", element: <ScrapPageWrapper /> },
      { path: "settings", element: <SettingsPageWrapper /> },
    ],
  },
]);
