import { RouterProvider } from "react-router-dom";
import { ArchiveProvider } from "./context/ArchiveContext";
import { AdminSettingsProvider } from "./context/AdminSettingsContext";
import { router } from "./routes";

export function App() {
  return (
    <ArchiveProvider>
      <AdminSettingsProvider>
        <RouterProvider router={router} />
      </AdminSettingsProvider>
    </ArchiveProvider>
  );
}
