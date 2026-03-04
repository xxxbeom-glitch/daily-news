import { RouterProvider } from "react-router-dom";
import { ArchiveProvider } from "./context/ArchiveContext";
import { router } from "./routes";

export function App() {
  return (
    <ArchiveProvider>
      <RouterProvider router={router} />
    </ArchiveProvider>
  );
}
