import { NavLink } from "react-router";
import "./TopMenu.css";

export default function TopMenu() {
    return (
        <nav className="top-menu-wrapper">
            <ul className="top-menu" role="menubar">
                <li className="top-menu__item" role="none">
                    <NavLink to="/" className="top-menu__item-link" role="menuitem">Home</NavLink>
                </li>
                <li className="top-menu__item" role="none">
                    <NavLink to="/mars" className="top-menu__item-link" role="menuitem">Mars</NavLink>
                </li>
            </ul>
        </nav>
    );
}