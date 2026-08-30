import { useState, useEffect, lazy, Suspense } from "react";
import { Route, Routes, useSearchParams, useNavigate, useLocation } from "react-router";
import TopMenu from "../presentation/components/ui/TopMenu";
import ModalManager from "../presentation/components/ui/ModalManager";
import { useAuthStore } from "../application/store/useAuthStore";
import { useModalStore } from "../ui/ModalManager/store";
import { useGameStore } from "../application/store/useGameStore";
import { authClient } from "../application/service/authService";
import { useUIStore } from "../application/store/useUIStore";
import { useEconomy } from "../application/hooks/useEconomy";

const StartView = lazy(() => import("../presentation/pages/StartView"));
const MarsView = lazy(() => import("../presentation/pages/MarsView"));
const GeneratorPage = lazy(() => import("../presentation/generator/GeneratorPage"));

function MarsLoadingFallback() {
    return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[300px] bg-[#050608] text-white p-6 select-none">
            <div className="relative flex items-center justify-center w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full bg-red-600/20 animate-ping opacity-75" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-red-500 via-orange-600 to-amber-700 shadow-[0_0_25px_rgba(239,68,68,0.6)] animate-pulse" />
                <div className="absolute inset-0 border-2 border-dashed border-red-500/40 rounded-full animate-[spin_8s_linear_infinite]" />
            </div>
            <div className="font-mono text-sm tracking-widest text-red-400 uppercase animate-pulse">
                INITIALIZING MARS SYSTEM...
            </div>
        </div>
    );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const colonyName = useGameStore(state => state.colonyName);
    const resumeLocalGame = useGameStore(state => state.resumeLocalGame);
    const { open } = useModalStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [fixtureError, setFixtureError] = useState<{ notFoundId: string; available: { id: string; label: string }[] } | null>(null);
    const [appliedFixtureKey, setAppliedFixtureKey] = useState<string | null>(null);
    const [resumeAttempted, setResumeAttempted] = useState(false);

    const fixtureParam = searchParams.get("fixture");
    const currentFixtureKey = fixtureParam ? `${fixtureParam}:${searchParams.get("seed") ?? ""}:${searchParams.get("speed") ?? ""}:${searchParams.get("paused") ?? ""}` : null;

    const isFixtureHydrating = Boolean(import.meta.env.DEV && currentFixtureKey !== null && appliedFixtureKey !== currentFixtureKey);
    const isPlayerResuming = Boolean(!fixtureParam && !colonyName && !resumeAttempted);
    const isHydrating = isFixtureHydrating || isPlayerResuming;

    useEffect(() => {
        if (import.meta.env.DEV && fixtureParam) {
            if (currentFixtureKey && appliedFixtureKey !== currentFixtureKey) {
                import("../domain/fixtures").then(({ getFixtureById, STATE_FIXTURES }) => {
                    const fixture = getFixtureById(fixtureParam);
                    if (fixture) {
                        const seedParam = searchParams.get("seed");
                        const speedParam = searchParams.get("speed");
                        const pausedParam = searchParams.get("paused");

                        const seed = seedParam ? Number(seedParam) : undefined;
                        const speed = (speedParam === "1" || speedParam === "2" || speedParam === "4") ? Number(speedParam) as 1 | 2 | 4 : undefined;
                        const paused = pausedParam !== null ? (pausedParam === "1" || pausedParam === "true") : undefined;

                        fixture.apply(useGameStore, { seed, speed, paused });
                        useGameStore.setState({ isDevFixture: true });
                        setFixtureError(null);
                        setAppliedFixtureKey(currentFixtureKey);
                    } else {
                        setFixtureError({
                            notFoundId: fixtureParam,
                            available: STATE_FIXTURES.map(f => ({ id: f.id, label: f.label })),
                        });
                        setAppliedFixtureKey(currentFixtureKey);
                    }
                }).catch((err: unknown) => {
                    console.error("Failed to load fixtures:", err);
                    setAppliedFixtureKey(currentFixtureKey);
                });
            }
            return;
        }

        if (!fixtureParam && !colonyName && !resumeAttempted) {
            setResumeAttempted(true);
            const resumed = resumeLocalGame();
            if (!resumed) {
                navigate("/", { replace: true });
                open("colony-name");
            }
        }
    }, [colonyName, navigate, open, resumeLocalGame, fixtureParam, searchParams, currentFixtureKey, appliedFixtureKey, resumeAttempted]);

    if (fixtureError) {
        return (
            <div data-testid="fixture-error-screen" className="flex flex-col items-center justify-center w-full h-full min-h-screen bg-[#0d1117] text-white p-8 font-mono select-none">
                <div className="max-w-md w-full bg-[#161b22] border border-red-500/50 rounded-xl p-6 shadow-2xl space-y-4">
                    <div className="flex items-center gap-3 text-red-400 font-bold text-lg">
                        <span>⚠️</span>
                        <span>Nieznany fixture stanu gry</span>
                    </div>
                    <p className="text-sm text-zinc-300">
                        Nie odnaleziono fixture'a o ID: <span className="px-2 py-0.5 bg-red-950/60 border border-red-500/40 rounded text-red-300 font-semibold">{fixtureError.notFoundId}</span>
                    </p>
                    <div className="text-xs text-zinc-400 pt-2 border-t border-zinc-700/60">
                        Dostępne ID fixture'ów:
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {fixtureError.available.map((f) => (
                            <a
                                key={f.id}
                                href={`/mars?fixture=${f.id}`}
                                className="px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded text-xs flex justify-between items-center text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                <span className="font-semibold">{f.id}</span>
                                <span className="text-zinc-400">{f.label}</span>
                            </a>
                        ))}
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors cursor-pointer"
                        >
                            Wróć do menu głównego
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isHydrating || !colonyName) {
        return <MarsLoadingFallback />;
    }

    return <>{children}</>;
}

function AutoPauseToast() {
    const autoPauseToast = useUIStore(state => state.autoPauseToast);
    if (!autoPauseToast) return null;
    return (
        <div
            role="status"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#161b22]/95 border border-[#30363d] rounded-lg text-[#e6edf3] text-xs font-mono tracking-wide shadow-2xl flex items-center gap-2 pointer-events-none"
        >
            <span>⏸️</span>
            <span>Gra wstrzymana na czas nieobecności — symulacja wznowiona</span>
        </div>
    );
}


function AuthRouteHandler() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { open } = useModalStore();
    const { fetchUser } = useAuthStore();

    useEffect(() => {
        const token = searchParams.get("token");
        const path = window.location.pathname;

        if (token && path !== "/reset-password" && path !== "/verify-email") {
            authClient.setToken(token);
            fetchUser();
            navigate("/", { replace: true });
            return;
        }

        if (path === "/reset-password" && token) {
            open("reset-password", { token });
            navigate("/", { replace: true });
            return;
        }

        if (path === "/verify-email" && token) {
            open("verify-email", { token });
            navigate("/", { replace: true });
            return;
        }
    }, [searchParams, navigate, open, fetchUser]);

    return null;
}

export default function App() {
    const { fetchUser } = useAuthStore();
    const alive = useGameStore(state => state.alive);
    const { start, stop } = useEconomy();
    const location = useLocation();
    const isGenerator = location.pathname === '/generate';

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        if (alive) {
            start();
        } else {
            stop();
        }
        return () => stop();
    }, [alive, start, stop]);

    useEffect(() => {
        if (import.meta.env.DEV && typeof window !== "undefined") {
            import("../domain/fixtures").then(({ getFixtureById, listFixtures, STATE_FIXTURES }) => {
                (window as unknown as { __listFixtures: typeof listFixtures }).__listFixtures = () => listFixtures();
                (window as unknown as {
                    __loadFixture: (id: string, opts?: { seed?: number; speed?: 1 | 2 | 4; paused?: boolean }) => boolean;
                }).__loadFixture = (id: string, opts) => {
                    const fixture = getFixtureById(id);
                    if (!fixture) {
                        console.warn(`[Fixtures] Fixture "${id}" not found. Available:`, STATE_FIXTURES.map(f => f.id));
                        return false;
                    }
                    fixture.apply(useGameStore, opts);
                    useGameStore.setState({ isDevFixture: true });
                    return true;
                };
            }).catch(() => {});
        }
    }, []);

    return (
        <div data-testid="app" className="app-root w-full h-full min-h-0">
            {!isGenerator && <TopMenu />}
            <div className={isGenerator ? 'w-full h-full' : 'mars-root'}>
                <Suspense fallback={<MarsLoadingFallback />}>
                    <Routes>
                        <Route path="/" element={<><AuthRouteHandler /><StartView /></>} />
                        <Route
                            path="/mars"
                            element={
                                <ProtectedRoute>
                                    <MarsView />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/reset-password" element={<AuthRouteHandler />} />
                        <Route path="/verify-email" element={<AuthRouteHandler />} />
                        <Route path="/generate" element={<GeneratorPage />} />
                    </Routes>
                </Suspense>
            </div>
            <ModalManager />
            <AutoPauseToast />
        </div>
    );
}

