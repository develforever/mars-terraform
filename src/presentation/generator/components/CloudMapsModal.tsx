import { useEffect, useState, useCallback } from "react";
import { authClient } from "../../../application/service/authService";
import { mapApiService, type MapSummaryResponse } from "../../../application/service/mapApiService";
import { useMapEditorStore } from "../../../application/store/useMapEditorStore";
import { parseMapJSON } from "../schema/mapSchema";

interface CloudMapsModalProps {
  onClose: () => void;
}

export const CloudMapsModal = ({ onClose }: CloudMapsModalProps) => {
  const loadFromJSON = useMapEditorStore((s) => s.loadFromJSON);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authClient.isAuthenticated());
  const [maps, setMaps] = useState<MapSummaryResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMapId, setLoadingMapId] = useState<number | null>(null);
  const [deletingMapId, setDeletingMapId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMaps = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await mapApiService.listMaps();
      setMaps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się pobrać listy map.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setIsAuthenticated(authClient.isAuthenticated());
    if (authClient.isAuthenticated()) {
      fetchMaps();
    }
  }, [fetchMaps]);

  const handleLoadMap = async (id: number) => {
    setLoadingMapId(id);
    setError(null);
    try {
      const detail = await mapApiService.getMap(id);
      let rawData: unknown;
      try {
        rawData = typeof detail.data === "string" ? JSON.parse(detail.data) : detail.data;
      } catch {
        setError("Błąd dekodowania pliku JSON mapy.");
        setLoadingMapId(null);
        return;
      }

      const parsed = parseMapJSON(rawData);
      if (!parsed.ok || !parsed.data) {
        setError(`Nieprawidłowy format mapy:\n${parsed.error}`);
        setLoadingMapId(null);
        return;
      }

      loadFromJSON(parsed.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się załadować mapy z chmury.");
      setLoadingMapId(null);
    }
  };

  const handleDeleteMap = async (id: number) => {
    setDeletingMapId(id);
    setError(null);
    try {
      await mapApiService.deleteMap(id);
      setMaps((prev) => prev.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się usunąć mapy.");
    } finally {
      setDeletingMapId(null);
    }
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleString("pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700/80 rounded-xl p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] text-zinc-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2 tracking-wide uppercase">
              <span className="text-[#e74c3c]">☁</span> Cloud Maps Browser
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Przeglądaj, wczytuj i zarządzaj swoimi mapami zapisanymi w chmurze Mars.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="text-zinc-400 hover:text-zinc-100 transition-colors text-lg p-1 rounded hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto my-4 pr-1 flex flex-col gap-2.5 min-h-[160px]">
          {!isAuthenticated ? (
            <div className="flex flex-col items-center justify-center text-center p-6 bg-zinc-950/50 rounded-lg border border-zinc-800/80 my-auto">
              <span className="text-3xl mb-2">🔒</span>
              <p className="text-sm font-medium text-zinc-300">Wymagane zalogowanie</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Musisz być zalogowany, aby przeglądać i pobierać swoje mapy z chmury.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center text-center p-8 my-auto text-zinc-400">
              <div className="w-6 h-6 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin mb-2" />
              <span className="text-xs">Ładowanie map z chmury...</span>
            </div>
          ) : maps.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-950/40 rounded-lg border border-zinc-800/60 my-auto text-zinc-400">
              <span className="text-3xl mb-2">🗺️</span>
              <p className="text-sm font-medium text-zinc-300">Brak zapisanych map</p>
              <p className="text-xs text-zinc-500 mt-1">
                Nie masz jeszcze żadnych map w chmurze. Użyj przycisku &quot;Save Cloud&quot;, aby zapisać bieżącą mapę.
              </p>
            </div>
          ) : (
            maps.map((map) => {
              const isConfirming = confirmDeleteId === map.id;
              const isDeleting = deletingMapId === map.id;
              const isLoading = loadingMapId === map.id;
              const isBusy = loadingMapId !== null || deletingMapId !== null;

              return (
                <div
                  key={map.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 transition-colors gap-3"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-100 truncate">{map.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        v{map.version || "2.0"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-900/60">
                        👥 {map.players} graczy
                      </span>
                    </div>
                    {map.description && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{map.description}</p>
                    )}
                    <span className="text-[10px] text-zinc-500 mt-1">
                      Modyfikacja: {formatDate(map.updatedAt || map.createdAt)}
                    </span>
                    {isConfirming && (
                      <span className="text-xs text-red-400 mt-1 font-medium">
                        Czy na pewno usunąć tę mapę z chmury?
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isConfirming ? (
                      <>
                        <button
                          onClick={() => handleLoadMap(map.id)}
                          disabled={isBusy}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-[#c0392b] hover:bg-[#e74c3c] disabled:opacity-50 text-white transition-colors"
                        >
                          {isLoading ? "Ładowanie..." : "Load"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(map.id)}
                          disabled={isBusy}
                          className="px-2.5 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 border border-zinc-700 hover:border-red-900/80 disabled:opacity-50 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDeleteMap(map.id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 text-xs font-medium rounded bg-red-800 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                        >
                          {isDeleting ? "Usuwanie..." : "Tak, usuń"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isDeleting}
                          className="px-2.5 py-1.5 text-xs font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        >
                          Anuluj
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-3 p-2.5 bg-red-950/80 border border-red-800 text-red-300 rounded text-xs whitespace-pre-wrap">
            ⚠ {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
