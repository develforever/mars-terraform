import { NavLink, useLocation } from "react-router";
import { useAuthStore } from "../../../application/store/useAuthStore";
import { useModalStore } from "../../../ui/ModalManager/store";
import { useGameStore } from "../../../application/store/useGameStore";
import "./TopMenu.css";

export default function TopMenu() {
    const { user, isAuthenticated, logout } = useAuthStore();
    const { open } = useModalStore();
    const location = useLocation();
    const colonyName = useGameStore((s) => s.colonyName);

    const isInGame = location.pathname === "/mars" && !!colonyName;

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `top-menu__item-link ${isActive ? 'active' : ''}`;

    const handleHomeClick = (e: React.MouseEvent) => {
        if (isInGame) {
            e.preventDefault();
            open("exit-confirm");
        }
    };

    return (
        <nav className="top-menu-wrapper">
            <ul className="top-menu" role="menubar">
                <li className="top-menu__item" role="none">
                    <NavLink to="/" className={linkClass} role="menuitem" end onClick={handleHomeClick}>Home</NavLink>
                </li>
                <li className="top-menu__item" role="none">
                    <NavLink to="/mars" className={linkClass} role="menuitem">Mars</NavLink>
                </li>
            </ul>
            <div className="top-menu__auth">
                {isAuthenticated && user ? (
                    <div className="flex items-center gap-3">
                        <span className="text-white text-sm">{user.name || user.email}</span>
                        <button
                            onClick={logout}
                            className="text-sm text-red-400 hover:text-red-300"
                        >
                            Log out
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => open("login")}
                            className="text-sm text-blue-400 hover:text-blue-300"
                        >
                            Log in
                        </button>
                        <button
                            onClick={() => open("register")}
                            className="text-sm text-green-400 hover:text-green-300"
                        >
                            Register
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
