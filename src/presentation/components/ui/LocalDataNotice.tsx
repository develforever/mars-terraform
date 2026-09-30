import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

/** Klucz w `localStorage`: gracz zamknął informację (bez cookies, niezbędne do nieprzypominania). */
export const LOCAL_DATA_NOTICE_KEY = "mars-terraform:notice:local-data:v1";

const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(LOCAL_DATA_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * T14: jednorazowa informacja dla gracza, że gra działa bez kont, a postęp zapisuje się
 * wyłącznie w tej przeglądarce (z przypomnieniem o kopiach zapasowych).
 */
export const LocalDataNotice = () => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(LOCAL_DATA_NOTICE_KEY, "1");
    } catch {
      // Brak dostępu do pamięci przeglądarki: informacja zniknie tylko do odświeżenia strony.
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label={t("localNotice.title")}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,560px)] bg-gray-900/95 text-gray-100 border border-[#e74c3c]/50 rounded-lg p-4 shadow-xl text-sm"
    >
      <p className="font-semibold text-white mb-1">{t("localNotice.title")}</p>
      <p className="text-gray-300 mb-3">{t("localNotice.body")}</p>
      <div className="flex items-center justify-between gap-3">
        <Link to="/privacy" className="text-blue-400 hover:underline text-xs">
          {t("privacy.link")}
        </Link>
        <button type="button" onClick={dismiss} className="px-3 py-1.5 bg-[#c0392b] hover:bg-[#e74c3c] rounded text-white text-xs font-medium">
          {t("localNotice.ok")}
        </button>
      </div>
    </div>
  );
};
