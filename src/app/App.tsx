import { useEffect, lazy, Suspense } from "react";
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

    useEffect(() => {
        if (!colonyName) {
            const resumed = resumeLocalGame();
            if (!resumed) {
                navigate("/", { replace: true });
                open("colony-name");
            }
        }
    }, [colonyName, navigate, open, resumeLocalGame]);

    if (!colonyName) {
        const resumed = resumeLocalGame();
        if (!resumed) return null;
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

