import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { GameState, MissionBoard } from '../types';
import * as api from '../lib/api';
import { getPlayerScopedStorageKey } from '../lib/player-id';

export type ViewState = 'landing' | 'briefing' | 'case-board' | 'globe' | 'interrogation' | 'arrest-result';

type RestorableView = Extract<ViewState, 'briefing' | 'case-board' | 'globe'>;

const VIEW_STORAGE_KEY = 'atlas-cipher:active-view';

function getViewStorageKey(): string {
  return getPlayerScopedStorageKey(VIEW_STORAGE_KEY);
}

function clearStoredView(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getViewStorageKey());
}

function persistView(caseId: string, view: RestorableView): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getViewStorageKey(), JSON.stringify({ caseId, view }));
}

function readStoredView(): { caseId: string; view: RestorableView } | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(getViewStorageKey());
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { caseId?: string; view?: string };
    if (!parsed.caseId) return null;
    if (
      parsed.view !== 'briefing' &&
      parsed.view !== 'case-board' &&
      parsed.view !== 'globe'
    ) {
      return null;
    }
    return { caseId: parsed.caseId, view: parsed.view };
  } catch {
    return null;
  }
}

function resolveInitialView(state: GameState): RestorableView {
  const stored = readStoredView();

  if (stored?.caseId === state.caseId) {
    return stored.view;
  }

  const visitedCities = state.case.cities.filter(city => city.visited).length;
  const confirmedClueCount = state.discoveredClues.filter(clue => !!clue.discoveredAt).length;
  const isFreshCase =
    state.status === 'active' &&
    state.currentCityId !== null &&
    visitedCities <= 1 &&
    confirmedClueCount === 0;

  if (isFreshCase) {
    return 'briefing';
  }

  return state.currentCityId ? 'case-board' : 'briefing';
}

interface ArrestResult {
  correct: boolean;
  suspectName: string;
  narrationUrl: string | null;
}

interface GameContextValue {
  gameState: GameState | null;
  missionBoard: MissionBoard | null;
  view: ViewState;
  loading: boolean;
  error: string | null;
  arrestResult: ArrestResult | null;
  startNewGame: () => Promise<void>;
  acceptMission: (templateId: string) => Promise<void>;
  viewMissionDetail: (templateId: string) => Promise<void>;
  loadGameState: () => Promise<void>;
  refreshGameState: () => Promise<void>;
  travelToCity: (cityId: string) => Promise<void>;
  pendingWitnessId: string | null;
  requestWitness: (witnessId: string | null) => void;
  clearPendingWitness: () => void;
  activeWitnessId: string | null;
  openInterrogation: (witnessId: string) => void;
  closeInterrogation: () => void;
  discoverClue: (clueId: string) => Promise<void>;
  arrestSuspect: (suspectId: string) => Promise<ArrestResult | null>;
  dismissArrestResult: () => void;
  abandonCase: () => Promise<void>;
  resetGame: () => Promise<void>;
  setView: (view: ViewState) => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [missionBoard, setMissionBoard] = useState<MissionBoard | null>(null);
  const [view, setViewState] = useState<ViewState>('landing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrestResult, setArrestResult] = useState<ArrestResult | null>(null);
  const [pendingWitnessId, setPendingWitnessId] = useState<string | null>(null);
  const [activeWitnessId, setActiveWitnessId] = useState<string | null>(null);

  const requestWitness = useCallback((witnessId: string | null) => {
    if (gameState?.status !== 'active') return;
    setPendingWitnessId(witnessId);
  }, [gameState?.status]);

  const clearPendingWitness = useCallback(() => {
    setPendingWitnessId(null);
  }, []);

  const openInterrogation = useCallback((witnessId: string) => {
    if (gameState?.status !== 'active') return;
    setActiveWitnessId(witnessId);
    setViewState('interrogation');
  }, [gameState?.status]);

  const closeInterrogation = useCallback(() => {
    setActiveWitnessId(null);
    setViewState('case-board');
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const setView = useCallback((nextView: ViewState) => {
    setViewState(nextView);

    if (nextView === 'landing') {
      clearStoredView();
      return;
    }

    if (!gameState) return;

    if (
      nextView === 'briefing' ||
      nextView === 'case-board' ||
      nextView === 'globe'
    ) {
      persistView(gameState.caseId, nextView);
    }
  }, [gameState]);

  const fetchFullState = useCallback(async (): Promise<GameState> => {
    return await api.getGameState() as GameState;
  }, []);

  const startNewGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const board = await api.getMissionBoard() as MissionBoard;
      setMissionBoard(board);
      setGameState(null);
      setArrestResult(null);
      setViewState('briefing');
      clearStoredView();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start new game');
    } finally {
      setLoading(false);
    }
  }, [fetchFullState]);

  const acceptMission = useCallback(async (templateId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.acceptMission(templateId);
      const state = await fetchFullState();
      setMissionBoard(null);
      setGameState(state);
      setArrestResult(null);
      setViewState('briefing');
      persistView(state.caseId, 'briefing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept mission');
    } finally {
      setLoading(false);
    }
  }, [fetchFullState]);

  const viewMissionDetail = useCallback(async (templateId: string) => {
    setLoading(true);
    setError(null);
    try {
      const state = await api.getMissionDetail(templateId);
      setGameState(state);
      setPendingWitnessId(null);
      setActiveWitnessId(null);
      setArrestResult(null);
      setViewState('briefing');
      persistView(state.caseId, 'briefing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open archived mission detail');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGameState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchFullState();
      setMissionBoard(null);
      setGameState(state);

      if (state.status === 'solved') {
        setArrestResult({
          correct: true,
          suspectName: '',
          narrationUrl: null,
        });
        setViewState('arrest-result');
        return;
      }

      // Note: do NOT seed arrestResult on failed-status loads. The full-screen
      // failure debrief should only appear immediately after the wrong arrest
      // (when arrestSuspect populates arrestResult). On reload we drop straight
      // into the compact in-mission failed view via the warrant button.

      const nextView = resolveInitialView(state);
      setViewState(nextView);
      persistView(state.caseId, nextView);
    } catch {
      setMissionBoard(null);
      setGameState(null);
      clearStoredView();
      setViewState('landing');
    } finally {
      setLoading(false);
    }
  }, [fetchFullState]);

  const refreshGameState = useCallback(async () => {
    try {
      const state = await fetchFullState();
      setGameState(state);
      // Only seed arrestResult on solved status (legacy success flow).
      // For failed status we keep arrestResult untouched so the full-screen
      // debrief only renders right after the wrong arrest.
      if (state.status === 'solved') {
        setArrestResult(prev => prev ?? {
          correct: true,
          suspectName: '',
          narrationUrl: null,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh game state');
    }
  }, [fetchFullState]);

  const travelToCity = useCallback(async (cityId: string) => {
    if (gameState?.status !== 'active') {
      const message = 'This case is already closed.';
      setError(message);
      throw new Error(message);
    }
    setLoading(true);
    setError(null);
    try {
      await api.travel(cityId);
      const state = await fetchFullState();
      setGameState(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to travel');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [fetchFullState, gameState?.status]);

  const discoverClue = useCallback(async (clueId: string) => {
    if (gameState?.status !== 'active') {
      setError('This case is already closed.');
      return;
    }
    try {
      await api.recordClue(clueId);
      const state = await fetchFullState();
      setGameState(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record clue');
    }
  }, [fetchFullState, gameState?.status]);

  const arrestSuspect = useCallback(async (suspectId: string) => {
    if (gameState?.status !== 'active') {
      setError('This case is already closed.');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.arrest(suspectId) as ArrestResult;
      const nextState = await fetchFullState().catch(() => null);
      setMissionBoard(null);
      setPendingWitnessId(null);
      setActiveWitnessId(null);
      if (nextState) {
        setGameState(nextState);
      } else {
        setGameState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: result.correct ? 'solved' : 'failed',
          };
        });
      }
      setArrestResult({
        correct: result.correct,
        suspectName: result.suspectName,
        narrationUrl: result.narrationUrl,
      });
      if (result.correct) {
        setViewState('arrest-result');
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit arrest');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchFullState, gameState?.status]);

  const dismissArrestResult = useCallback(() => {
    setArrestResult(null);
  }, []);

  const abandonCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.abandonMission();
      const board = await api.getMissionBoard() as MissionBoard;
      setGameState(null);
      setMissionBoard(board);
      setArrestResult(null);
      clearStoredView();
      setViewState('briefing');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to abandon case');
    } finally {
      setLoading(false);
    }
  }, []);

  const resetGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await api.resetGame();
    } catch {
      // ignore — we still want to reset client state
    } finally {
      setGameState(null);
      setMissionBoard(null);
      setArrestResult(null);
      clearStoredView();
      setViewState('landing');
      setLoading(false);
    }
  }, []);

  return (
    <GameContext.Provider
      value={{
        gameState,
        missionBoard,
        view,
        loading,
        error,
        arrestResult,
        startNewGame,
        acceptMission,
        viewMissionDetail,
        loadGameState,
        refreshGameState,
        travelToCity,
        pendingWitnessId,
        requestWitness,
        clearPendingWitness,
        activeWitnessId,
        openInterrogation,
        closeInterrogation,
        discoverClue,
        arrestSuspect,
        dismissArrestResult,
        abandonCase,
        resetGame,
        setView,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
}
