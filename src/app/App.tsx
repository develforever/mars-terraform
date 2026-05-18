import { useEffect } from "react";
import { Route, Routes, useSearchParams, useNavigate } from "react-router";
import StartView from "../presentation/pages/StartView";
import MarsView from "../presentation/pages/MarsView";
import TopMenu from "../presentation/components/ui/TopMenu";
import ModalManager from "../presentation/components/ui/ModalManager";
import { useAuthStore } from "../application/store/useAuthStore";
import { useModalStore } from "../ui/ModalManager/store";
import { useGameStore } from "../application/store/useGameStore";
import { authClient } from "../application/service/authService";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuthStore();
    const colonyName = useGameStore(state => state.colonyName);
    const { open } = useModalStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                navigate("/", { replace: true });
                open("login");
            } else if (!colonyName) {
                navigate("/", { replace: true });
                open("colony-name");
            }
        }
    }, [isAuthenticated, isLoading, colonyName, navigate, open]);

    if (isLoading) return <div className="h-screen w-screen flex items-center justify-center bg-black text-white">Loading...</div>;
    if (!isAuthenticated || !colonyName) return null;

    return <>{children}</>;
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

import { useEconomy } from "../application/hooks/useEconomy";

export default function App() {
    const { fetchUser } = useAuthStore();
    const alive = useGameStore(state => state.alive);
    const { start, stop } = useEconomy();

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
            <TopMenu />
            <div className="mars-root">
                <Routes>
                    <Route path="/" element={<StartView />} />
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
                </Routes>
            </div>
            <ModalManager />
        </div>
    );
}
