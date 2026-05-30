import { useTranslation } from "react-i18next";

export function LanguageToggle() {
    const { i18n, t } = useTranslation();

    const toggle = () => {
        const next = i18n.language === "pl" ? "en" : "pl";
        i18n.changeLanguage(next);
        localStorage.setItem("mars-lang", next);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={t("lang.toggle")}
            className="lang-toggle"
        >
            {i18n.language === "pl" ? "EN" : "PL"}
        </button>
    );
}
