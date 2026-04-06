import { NavLink } from "react-router";
import "./TopMenu.css";

export default function TopMenu() {
    const linkClass = ({ isActive }: { isActive: boolean }) => 
        `top-menu__item-link ${isActive ? 'active' : ''}`;

    return (
        <nav className="top-menu-wrapper">
            <ul className="top-menu" role="menubar">
                <li className="top-menu__item" role="none">
                    <NavLink to="/" className={linkClass} role="menuitem" end>Home</NavLink>
                </li>
                <li className="top-menu__item" role="none">
                    <NavLink to="/mars" className={linkClass} role="menuitem">Mars</NavLink>
                </li>
            </ul>
        </nav>
    );
}
