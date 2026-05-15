import { useEffect } from "react";
import { Route, Routes, useSearchParams, useNavigate } from "react-router";
import StartView from "../presentation/pages/StartView";
import MarsView from "../presentation/pages/MarsView";
import TopMenu from "../presentation/components/ui/TopMenu";
import ModalManager from "../presentation/components/ui/ModalManager";
import { useAuthStore } from "../application/store/useAuthStore";
import { useModalStore } from "../ui/ModalManager/store";
import { authClient } from "../application/service/authService";

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
            open("reset-password");
            navigate("/", { replace: true });
            return;
        }

        if (path === "/verify-email" && token) {
            open("verify-email");
            navigate("/", { replace: true });
            return;
        }
    }, [searchParams, navigate, open, fetchUser]);

    return null;
}

export default function App() {
    const { fetchUser } = useAuthStore();

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    return (
        <div data-testid="app" className="app-root w-full h-full min-h-0">
            <TopMenu />
            <div className="mars-root">
                <Routes>
                    <Route path="/" element={<StartView />} />
                    <Route path="/mars" element={<MarsView />} />
                    <Route path="/reset-password" element={<AuthRouteHandler />} />
                    <Route path="/verify-email" element={<AuthRouteHandler />} />
                </Routes>
            </div>
            <ModalManager />
        </div>
    );
}
