/**
 * Krótka informacja o prywatności (T13, RODO art. 13) dla modelu kont BEZ danych osobowych
 * (numer konta + opcjonalny authenticator). Pola [UZUPEŁNIJ] / [TO FILL IN] uzupełnia administrator.
 * Dokument prawny utrzymywany w całości per język (nie w plikach tłumaczeń).
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
        "Nie zbieramy e-maila, imienia, nazwiska ani hasła i nie używamy plików cookies. Konto to losowy numer konta, który znasz tylko Ty.",
      ],
    },
    {
      heading: "2. Administrator",
      paragraphs: [
        "Administratorem danych jest [UZUPEŁNIJ: imię i nazwisko albo nazwa]. Kontakt: [UZUPEŁNIJ: adres e-mail].",
      ],
    },
    {
      heading: "3. Jakie dane przetwarzamy",
      paragraphs: [
        "Przy koncie: skrót kryptograficzny numeru konta (samego numeru nie przechowujemy), opcjonalny pseudonim, zaszyfrowany klucz authenticatora (jeśli go włączysz), daty utworzenia i ostatniego logowania oraz zapisane kolonie i mapy.",
        "Serwer gry nie zapisuje adresów IP. Techniczne logi dostawców hostingu mogą zawierać adres IP i czas żądania.",
        "Grę i generator map można używać bez konta: wtedy dane gry zostają wyłącznie w Twojej przeglądarce.",
      ],
    },
    {
      heading: "4. Cel, podstawa i odbiorcy",
      paragraphs: [
        "Prowadzenie konta i zapisów gry: art. 6 ust. 1 lit. b RODO. Bezpieczeństwo serwisu: art. 6 ust. 1 lit. f RODO.",
        "Dane przechowują dostawcy infrastruktury działający na nasze polecenie: Vercel Inc. (strona), Render Services, Inc. (serwer gry, Frankfurt, UE) i Turso (baza danych, Irlandia, UE). Vercel i Render mają siedzibę w USA; podstawa przekazania: [UZUPEŁNIJ po sprawdzeniu umów powierzenia, np. standardowe klauzule umowne].",
      ],
    },
    {
      heading: "5. Jak długo",
      paragraphs: [
        "Do czasu usunięcia konta. Konta nieużywane przez 2 lata usuwamy automatycznie razem z zapisami gry.",
      ],
    },
    {
      heading: "6. Twoje prawa",
      paragraphs: [
        "W panelu „Konto” (kliknij swój pseudonim w menu) możesz w każdej chwili pobrać wszystkie dane w pliku JSON, zmienić pseudonim i trwale usunąć konto. Masz też prawo do ograniczenia przetwarzania i sprzeciwu oraz prawo wniesienia skargi do Prezesa UODO (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).",
      ],
    },
    {
      heading: "7. Cookies i pamięć przeglądarki",
      paragraphs: [
        "Serwis nie używa plików cookies ani narzędzi analitycznych czy reklamowych. W pamięci przeglądarki zapisujemy tylko: token logowania (usuwany przy wylogowaniu), wybrany język i lokalny autozapis gry. Są niezbędne do działania funkcji, z których korzystasz.",
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
        "We do not collect your e-mail, name or password and we do not use cookies. Your account is a random account number that only you know.",
      ],
    },
    {
      heading: "2. Controller",
      paragraphs: [
        "The data controller is [TO FILL IN: full name or entity name]. Contact: [TO FILL IN: e-mail address].",
      ],
    },
    {
      heading: "3. What data we process",
      paragraphs: [
        "For an account: a cryptographic hash of the account number (we never store the number itself), an optional nickname, an encrypted authenticator key (if you enable it), creation and last login dates, and your saved colonies and maps.",
        "The game server does not store IP addresses. Technical logs of hosting providers may contain IP addresses and request times.",
        "You can play and use the map generator without an account: game data then stays only in your browser.",
      ],
    },
    {
      heading: "4. Purpose, legal basis and recipients",
      paragraphs: [
        "Running your account and game saves: Art. 6(1)(b) GDPR. Service security: Art. 6(1)(f) GDPR.",
        "Data is stored by infrastructure providers acting on our instructions: Vercel Inc. (website), Render Services, Inc. (game server, Frankfurt, EU) and Turso (database, Ireland, EU). Vercel and Render are based in the USA; transfer basis: [TO FILL IN after reviewing the data processing agreements, e.g. standard contractual clauses].",
      ],
    },
    {
      heading: "5. Retention",
      paragraphs: [
        "Until you delete your account. Accounts unused for 2 years are deleted automatically together with game saves.",
      ],
    },
    {
      heading: "6. Your rights",
      paragraphs: [
        "In the “Account” panel (click your nickname in the menu) you can download all your data as a JSON file, change your nickname and permanently delete your account at any time. You may also restrict or object to processing and lodge a complaint with the Polish supervisory authority (UODO, ul. Stawki 2, 00-193 Warsaw, uodo.gov.pl) or the authority in your country.",
      ],
    },
    {
      heading: "7. Cookies and browser storage",
      paragraphs: [
        "The service does not use cookies, analytics or advertising tools. In your browser we store only: the sign-in token (removed on sign-out), your chosen language and a local game autosave. They are necessary for the features you use.",
      ],
    },
  ],
};

export const getPolicyContent = (language: string): PolicyContent => (language.startsWith("pl") ? PL : EN);
