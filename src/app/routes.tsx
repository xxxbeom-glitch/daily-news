import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SearchPageWrapper } from "./components/SearchPageWrapper";
import { ArchivePageWrapper } from "./components/ArchivePageWrapper";
import { SettingsPageWrapper } from "./components/SettingsPageWrapper";
import { WatchlistSearchPage } from "./components/WatchlistSearchPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <SearchPageWrapper /> },
      { path: "archive", element: <ArchivePageWrapper /> },
      { path: "settings", element: <SettingsPageWrapper /> },
      { path: "settings/watchlist-search", element: <WatchlistSearchPage /> },
    ],
  },
]);
