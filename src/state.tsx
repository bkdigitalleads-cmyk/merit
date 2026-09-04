import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initPurchases, getIsPro } from './purchases';
import { getGoalPreset } from './goals';

export interface Settings {
  lockEnabled: boolean;
  /** Goal preset key from goals.ts, '' until chosen. */
  goalKey: string;
  /** Target hours; null = use the preset's suggestion. */
  goalHours: number | null;
  volunteerName: string;
  supervisorName: string;
}

const DEFAULT_SETTINGS: Settings = {
  lockEnabled: false,
  goalKey: '',
  goalHours: null,
  volunteerName: '',
  supervisorName: '',
};

const SETTINGS_KEY = 'merit.settings.v1';

/** Entries allowed on the free tier. */
export const FREE_ENTRY_LIMIT = 10;

export interface Goal {
  totalHours: number;
  /** Human label for UI copy ("National Honor Society"). */
  label: string;
  source: 'preset' | 'custom' | 'default';
}

/** Resolve the active goal from settings (preset suggestion or custom hours). */
export function resolveGoal(settings: Settings): Goal {
  const preset = getGoalPreset(settings.goalKey);
  if (settings.goalHours != null && settings.goalHours > 0) {
    return {
      totalHours: settings.goalHours,
      label: preset?.label ?? 'Custom goal',
      source: 'custom',
    };
  }
  if (preset) {
    return { totalHours: preset.hours, label: preset.label, source: 'preset' };
  }
  return { totalHours: 40, label: 'Volunteer goal', source: 'default' };
}

interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  goal: Goal;
  isPro: boolean;
  setIsPro: (v: boolean) => void;
  refreshPro: () => Promise<void>;
  paywallVisible: boolean;
  showPaywall: () => void;
  hidePaywall: () => void;
  ready: boolean;
  /** Bumped whenever entry data changes, so screens refetch. */
  dataVersion: number;
  bumpData: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isPro, setIsPro] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {
        // corrupted settings -> defaults
      }
      try {
        await initPurchases();
        setIsPro(await getIsPro());
      } catch {
        setIsPro(false);
      }
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // non-fatal
      }
    },
    [settings]
  );

  const refreshPro = useCallback(async () => {
    setIsPro(await getIsPro());
  }, []);

  const goal = useMemo(() => resolveGoal(settings), [settings]);

  const value = useMemo<AppState>(
    () => ({
      settings,
      updateSettings,
      goal,
      isPro,
      setIsPro,
      refreshPro,
      paywallVisible,
      showPaywall: () => setPaywallVisible(true),
      hidePaywall: () => setPaywallVisible(false),
      ready,
      dataVersion,
      bumpData: () => setDataVersion((v) => v + 1),
    }),
    [settings, updateSettings, goal, isPro, refreshPro, paywallVisible, ready, dataVersion]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
