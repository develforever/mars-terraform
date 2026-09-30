/**
 * Informacja o prywatności (T14: gra BEZ kont). Aplikacja nie przetwarza danych osobowych na serwerze:
 * zapisy gry i mapy są wyłącznie w przeglądarce gracza. Pola [UZUPEŁNIJ] / [TO FILL IN] uzupełnia administrator.
 * Dokument utrzymywany w całości per język (nie w plikach tłumaczeń).
 */

export interface PolicySection {
  heading: string;
  paragraphs: string[];
}

export interface PolicyContent {
  title: string;
  updated: string;
  draftNotice: string;
  sections: PolicySection[];
}

const PL: PolicyContent = {
  title: "Prywatność",
  updated: "Ostatnia aktualizacja: [UZUPEŁNIJ: data]",
  draftNotice: "Wersja robocza. Pola oznaczone [UZUPEŁNIJ] zostaną uzupełnione przez administratora.",
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
        "Strona jest hostowana przez Vercel Inc. (USA). Jak każdy serwer WWW, dostawca hostingu może rejestrować w logach technicznych adres IP i czas żądania. Nie mamy dostępu do tych danych w celu identyfikacji graczy i nie łączymy ich z danymi gry.",
      ],
    },
    {
      heading: "4. Administrator i kontakt",
      paragraphs: [
        "Administratorem serwisu jest [UZUPEŁNIJ: imię i nazwisko albo nazwa]. Kontakt: [UZUPEŁNIJ: adres e-mail].",
        "Przysługuje Ci prawo wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).",
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
  updated: "Last updated: [TO FILL IN: date]",
  draftNotice: "Draft. Fields marked [TO FILL IN] will be completed by the controller.",
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
        "The website is hosted by Vercel Inc. (USA). Like any web server, the hosting provider may record IP addresses and request times in technical logs. We do not use this data to identify players and do not link it to game data.",
      ],
    },
    {
      heading: "4. Controller and contact",
      paragraphs: [
        "The service is run by [TO FILL IN: full name or entity name]. Contact: [TO FILL IN: e-mail address].",
        "You may lodge a complaint with the Polish supervisory authority (UODO, ul. Stawki 2, 00-193 Warsaw, uodo.gov.pl) or the authority in your country.",
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
