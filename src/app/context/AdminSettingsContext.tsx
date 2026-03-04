import { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  getAdminHideMarket,
  getAdminShowNewsTab,
  getAdminTestRunAt,
  getAdminTestExpectedReadyAt,
  type AdminSchedule,
  getAdminSchedule,
  getAdminMovers,
  getAdminModelId,
} from "../utils/adminSettings";

const ADMIN_SETTINGS_EVENT = "admin_settings_changed";

interface AdminSettingsState {
  hideMarket: boolean;
  showNewsTab: boolean;
  schedule: AdminSchedule;
  movers: Record<string, string>;
  modelId: string | null;
  testRunAt: number | null;
  testExpectedReadyAt: number | null;
}

const AdminSettingsContext = createContext<{
  hideMarket: boolean;
  showNewsTab: boolean;
  schedule: AdminSchedule;
  movers: Record<string, string>;
  modelId: string | null;
  testRunAt: number | null;
  testExpectedReadyAt: number | null;
  refresh: () => void;
} | null>(null);

function readState(): AdminSettingsState {
  return {
    hideMarket: getAdminHideMarket(),
    showNewsTab: getAdminShowNewsTab(),
    schedule: getAdminSchedule(),
    movers: getAdminMovers(),
    modelId: getAdminModelId(),
    testRunAt: getAdminTestRunAt(),
    testExpectedReadyAt: getAdminTestExpectedReadyAt(),
  };
}

export function AdminSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(readState);

  const refresh = useCallback(() => {
    setState(readState());
    window.dispatchEvent(new CustomEvent(ADMIN_SETTINGS_EVENT));
  }, []);

  useEffect(() => {
    const handler = () => setState(readState());
    window.addEventListener(ADMIN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(ADMIN_SETTINGS_EVENT, handler);
  }, []);

  return (
    <AdminSettingsContext.Provider
      value={{
        hideMarket: state.hideMarket,
        showNewsTab: state.showNewsTab,
        schedule: state.schedule,
        movers: state.movers,
        modelId: state.modelId,
        testRunAt: state.testRunAt,
        testExpectedReadyAt: state.testExpectedReadyAt,
        refresh,
      }}
    >
      {children}
    </AdminSettingsContext.Provider>
  );
}

export function useAdminSettings() {
  const ctx = useContext(AdminSettingsContext);
  if (!ctx) throw new Error("useAdminSettings must be used within AdminSettingsProvider");
  return ctx;
}
