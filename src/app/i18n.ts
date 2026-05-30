import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "./locales/pl";
import en from "./locales/en";

const savedLang = localStorage.getItem("mars-lang") ?? "pl";

i18n
    .use(initReactI18next)
    .init({
        resources: {
            pl,
            en,
        },
        lng: savedLang,
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
