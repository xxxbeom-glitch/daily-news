import { RouterProvider } from "react-router-dom";
import { ArchiveProvider } from "./context/ArchiveContext";
import { WatchlistProvider } from "./context/WatchlistContext";
import { router } from "./routes";

export function App() {
  return (
    <ArchiveProvider>
      <WatchlistProvider>
        <RouterProvider router={router} />
      </WatchlistProvider>
    </ArchiveProvider>
  );
}
