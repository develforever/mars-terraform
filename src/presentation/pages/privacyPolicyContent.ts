/**
 * Informacja o prywatności (T14, D18: gra BEZ kont). Aplikacja nie przetwarza danych osobowych na serwerze:
 * zapisy gry i mapy są wyłącznie w przeglądarce gracza. Kontakt: e-mail projektu (bez danych osobowych autora).
 * Dokument utrzymywany w całości per język (nie w plikach tłumaczeń).
 */

/** Adres kontaktowy projektu (skrzynka projektu, nie osoby). */
export const CONTACT_EMAIL = "mars_terraform@proton.me";

export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface PolicyContent {
  title: string;
  updated: string;
  sections: PolicySection[];
}

const PL: PolicyContent = {
  title: "Prywatność",
  updated: "Ostatnia aktualizacja: 30 września 2026",
  sections: [
    {
      heading: "1. W skrócie",
      paragraphs: [
        "Gra nie ma kont. Nie zbieramy e-maila, imienia, hasła ani innych danych osobowych i nie używamy plików cookies ani narzędzi analitycznych czy reklamowych.",
      ],
    },
    {
      heading: "2. Gdzie są Twoje dane gry",
      paragraphs: [
        "Zapisy kolonii, autozapis i mapy z generatora są przechowywane wyłącznie w Twojej przeglądarce (IndexedDB / localStorage) i nie są wysyłane na nasz serwer.",
        "Wyczyszczenie danych witryny w przeglądarce usuwa je bezpowrotnie. Kopię zapasową możesz pobrać jako plik (Wczytaj → ⬇) i wczytać na innym urządzeniu.",
        "W pamięci przeglądarki zapisujemy też wybrany język i to, że zamknięto informację o grze bez konta. Są niezbędne do działania funkcji, z których korzystasz.",
      ],
    },
    {
      heading: "3. Hosting",
      paragraphs: [
        "Strona to statyczne pliki gry, a cała rozgrywka działa w Twojej przeglądarce. Jak każdy serwer WWW, serwer udostępniający te pliki może rejestrować w logach technicznych adres IP i czas żądania. Nie mamy dostępu do tych danych w celu identyfikacji graczy i nie łączymy ich z danymi gry.",
      ],
    },
    {
      heading: "4. Kontakt",
      paragraphs: [
        `Pytania i zgłoszenia dotyczące gry i prywatności: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "5. Zmiany",
      paragraphs: [
        "Jeśli dodamy funkcje sieciowe (np. wspólną grę), zaktualizujemy tę informację przed ich uruchomieniem.",
      ],
    },
  ],
};

const EN: PolicyContent = {
  title: "Privacy",
  updated: "Last updated: 30 September 2026",
  sections: [
    {
      heading: "1. In short",
      paragraphs: [
        "The game has no accounts. We do not collect your e-mail, name, password or any other personal data, and we do not use cookies, analytics or advertising tools.",
      ],
    },
    {
      heading: "2. Where your game data is",
      paragraphs: [
        "Colony saves, the autosave and generator maps are stored only in your browser (IndexedDB / localStorage) and are not sent to our server.",
        "Clearing site data in your browser deletes them permanently. You can download a backup file (Load → ⬇) and load it on another device.",
        "Your browser also stores your chosen language and whether you dismissed the no-account notice. These are necessary for the features you use.",
      ],
    },
    {
      heading: "3. Hosting",
      paragraphs: [
        "The website consists of static game files and all gameplay runs in your browser. Like any web server, the server delivering these files may record IP addresses and request times in technical logs. We do not use this data to identify players and do not link it to game data.",
      ],
    },
    {
      heading: "4. Contact",
      paragraphs: [
        `Questions and reports about the game and privacy: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "5. Changes",
      paragraphs: [
        "If we add online features (e.g. multiplayer), we will update this notice before launching them.",
      ],
    },
  ],
};

export const getPolicyContent = (language: string): PolicyContent => (language.startsWith("pl") ? PL : EN);
