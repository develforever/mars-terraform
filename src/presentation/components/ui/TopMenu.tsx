import { NavLink, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageToggle } from "./LanguageToggle";
import { useModalStore } from "../../../ui/ModalManager/store";
import { useGameStore } from "../../../application/store/useGameStore";
import "./TopMenu.css";

export default function TopMenu() {
    const { t } = useTranslation();
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
                    <NavLink to="/" className={linkClass} role="menuitem" end onClick={handleHomeClick}>{t("topMenu.home")}</NavLink>
                </li>
                <li className="top-menu__item" role="none">
                    <NavLink to="/mars" className={linkClass} role="menuitem">{t("topMenu.mars")}</NavLink>
                </li>
            </ul>
            <div className="top-menu__auth">
                <div className="flex items-center gap-3">
                    <LanguageToggle />
                    <NavLink to="/privacy" className="text-sm text-gray-300 hover:text-white">
                        {t("privacy.link")}
                    </NavLink>
                </div>
            </div>
        </nav>
    );
}
