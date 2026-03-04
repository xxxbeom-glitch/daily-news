import { Navigate } from "react-router-dom";
import { useAdminSettings } from "../context/AdminSettingsContext";
import { SearchPage } from "./SearchPage";

export function SearchPageWrapper() {
  const { showNewsTab } = useAdminSettings();
  if (!showNewsTab) return <Navigate to="/" replace />;
  return <SearchPage />;
}
