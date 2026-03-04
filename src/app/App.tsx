import { RouterProvider } from "react-router-dom";
import { FirebaseProvider } from "./context/FirebaseContext";
import { ArchiveProvider } from "./context/ArchiveContext";
import { AdminSettingsProvider } from "./context/AdminSettingsContext";
import { router } from "./routes";

export function App() {
  return (
    <FirebaseProvider>
      <ArchiveProvider>
        <AdminSettingsProvider>
          <RouterProvider router={router} />
        </AdminSettingsProvider>
      </ArchiveProvider>
    </FirebaseProvider>
  );
}
