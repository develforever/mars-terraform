/**
 * Treść polityki prywatności (T12, RODO art. 13). SZKIC: pola oznaczone [UZUPEŁNIJ] / [TO FILL IN]
 * musi uzupełnić administrator danych. Dokument prawny utrzymywany w całości per język (nie w plikach tłumaczeń).
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
  title: "Polityka prywatności",
  updated: "Ostatnia aktualizacja: [UZUPEŁNIJ: data]",
  draftNotice: "Wersja robocza. Pola oznaczone [UZUPEŁNIJ] zostaną uzupełnione przez administratora.",
  sections: [
    {
      heading: "1. Administrator danych",
      paragraphs: [
        "Administratorem Twoich danych osobowych jest [UZUPEŁNIJ: imię i nazwisko albo nazwa podmiotu, adres].",
        "Kontakt w sprawach danych osobowych: [UZUPEŁNIJ: adres e-mail].",
      ],
    },
    {
      heading: "2. Jakie dane przetwarzamy",
      paragraphs: [
        "Przy zakładaniu i używaniu konta: nazwę (imię lub pseudonim), adres e-mail, skrót (hash) hasła, a przy logowaniu przez Google lub GitHub także identyfikator konta u tego dostawcy.",
        "W trakcie gry: zapisane kolonie (stan gry) i mapy z generatora wraz z datami utworzenia i zmiany.",
        "Dane techniczne: dostawcy hostingu rejestrują w logach serwera m.in. adres IP i czas żądania.",
        "Generator map działa bez konta; wtedy nie przekazujesz nam żadnych danych osobowych.",
      ],
    },
    {
      heading: "3. Cele i podstawy prawne",
      paragraphs: [
        "Prowadzenie konta, logowanie, zapisywanie gier i map oraz wysyłka wiadomości potrzebnych do działania konta (weryfikacja adresu e-mail, reset hasła): art. 6 ust. 1 lit. b RODO (wykonanie umowy o świadczenie usługi).",
        "Zapewnienie bezpieczeństwa serwisu i obsługa logów technicznych: art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes administratora).",
        "Nie profilujemy użytkowników, nie podejmujemy zautomatyzowanych decyzji i nie używamy danych do reklamy.",
      ],
    },
    {
      heading: "4. Odbiorcy danych",
      paragraphs: [
        "Dane powierzamy dostawcom infrastruktury, którzy przetwarzają je wyłącznie na nasze polecenie: Vercel Inc. (hosting strony), Render Services, Inc. (serwer API, region Frankfurt, UE), Turso (baza danych, region Irlandia, UE)[UZUPEŁNIJ: dostawca wysyłki e-maili].",
        "Przy logowaniu przez Google lub GitHub dane przekazuje nam odpowiednio Google LLC lub GitHub, Inc.",
      ],
    },
    {
      heading: "5. Przekazywanie danych poza EOG",
      paragraphs: [
        "Vercel Inc. i Render Services, Inc. to firmy z siedzibą w USA. Przekazanie danych odbywa się na podstawie [UZUPEŁNIJ po sprawdzeniu umów powierzenia (DPA): np. decyzji Komisji Europejskiej w sprawie EU-US Data Privacy Framework albo standardowych klauzul umownych].",
      ],
    },
    {
      heading: "6. Jak długo przechowujemy dane",
      paragraphs: [
        "Dane konta, zapisy gier i mapy: do czasu usunięcia konta.",
        "Konta z niepotwierdzonym adresem e-mail: usuwane automatycznie po 30 dniach od rejestracji.",
        "Linki weryfikacyjne i linki resetu hasła: usuwane po wygaśnięciu.",
        "Kopie zapasowe bazy danych: [UZUPEŁNIJ: okres i miejsce przechowywania].",
      ],
    },
    {
      heading: "7. Twoje prawa",
      paragraphs: [
        "Masz prawo do dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia oraz sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie.",
        "W panelu „Konto” (kliknij swoją nazwę w menu) możesz w każdej chwili pobrać wszystkie swoje dane w pliku JSON oraz trwale usunąć konto razem z koloniami i mapami.",
        "Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).",
      ],
    },
    {
      heading: "8. Dobrowolność",
      paragraphs: [
        "Podanie danych jest dobrowolne, ale bez adresu e-mail i hasła nie można założyć konta ani zapisywać gier na serwerze.",
      ],
    },
    {
      heading: "9. Pliki cookies i pamięć przeglądarki",
      paragraphs: [
        "Serwis nie używa plików cookies ani narzędzi analitycznych czy reklamowych.",
        "W pamięci przeglądarki (localStorage) zapisujemy wyłącznie: token logowania (usuwany przy wylogowaniu i usunięciu konta), wybrany język oraz lokalny autozapis gry. Są one niezbędne do działania funkcji, z których korzystasz. Możesz je usunąć, czyszcząc dane witryny w przeglądarce.",
      ],
    },
    {
      heading: "10. Zmiany polityki",
      paragraphs: [
        "O istotnych zmianach tej polityki poinformujemy na tej stronie.",
      ],
    },
  ],
};

const EN: PolicyContent = {
  title: "Privacy Policy",
  updated: "Last updated: [TO FILL IN: date]",
  draftNotice: "Draft. Fields marked [TO FILL IN] will be completed by the controller.",
  sections: [
    {
      heading: "1. Data controller",
      paragraphs: [
        "The controller of your personal data is [TO FILL IN: full name or entity name, address].",
        "Contact for data protection matters: [TO FILL IN: e-mail address].",
      ],
    },
    {
      heading: "2. What data we process",
      paragraphs: [
        "When you create and use an account: your name (or nickname), e-mail address, a password hash and, if you sign in with Google or GitHub, your account identifier at that provider.",
        "While playing: saved colonies (game state) and generator maps, with creation and update dates.",
        "Technical data: hosting providers record server logs including IP address and request time.",
        "The map generator works without an account; in that case you do not give us any personal data.",
      ],
    },
    {
      heading: "3. Purposes and legal bases",
      paragraphs: [
        "Running your account, signing in, saving games and maps, and sending messages required for the account (e-mail verification, password reset): Art. 6(1)(b) GDPR (performance of a contract).",
        "Keeping the service secure and handling technical logs: Art. 6(1)(f) GDPR (legitimate interest).",
        "We do not profile users, make automated decisions or use data for advertising.",
      ],
    },
    {
      heading: "4. Recipients",
      paragraphs: [
        "We entrust data to infrastructure providers who process it only on our instructions: Vercel Inc. (website hosting), Render Services, Inc. (API server, Frankfurt region, EU), Turso (database, Ireland region, EU)[TO FILL IN: e-mail delivery provider].",
        "If you sign in with Google or GitHub, Google LLC or GitHub, Inc. provides data to us.",
      ],
    },
    {
      heading: "5. Transfers outside the EEA",
      paragraphs: [
        "Vercel Inc. and Render Services, Inc. are based in the USA. Transfers rely on [TO FILL IN after reviewing the data processing agreements: e.g. the EU-US Data Privacy Framework adequacy decision or standard contractual clauses].",
      ],
    },
    {
      heading: "6. Retention",
      paragraphs: [
        "Account data, saved games and maps: until you delete your account.",
        "Accounts with an unconfirmed e-mail address: deleted automatically 30 days after registration.",
        "Verification and password reset links: deleted once expired.",
        "Database backups: [TO FILL IN: retention period and location].",
      ],
    },
    {
      heading: "7. Your rights",
      paragraphs: [
        "You have the right to access, rectify and erase your data, to restrict processing, to data portability, and to object to processing based on legitimate interest.",
        "In the “Account” panel (click your name in the menu) you can download all your data as a JSON file at any time and permanently delete your account together with your colonies and maps.",
        "You may lodge a complaint with the Polish supervisory authority, the President of the Personal Data Protection Office (ul. Stawki 2, 00-193 Warsaw, uodo.gov.pl), or with the authority in your country of residence.",
      ],
    },
    {
      heading: "8. Voluntary provision",
      paragraphs: [
        "Providing data is voluntary, but without an e-mail address and password you cannot create an account or save games on the server.",
      ],
    },
    {
      heading: "9. Cookies and browser storage",
      paragraphs: [
        "The service does not use cookies, analytics or advertising tools.",
        "In your browser's local storage we keep only: the sign-in token (removed on sign-out and account deletion), your chosen language and a local game autosave. They are necessary for features you use. You can remove them by clearing site data in your browser.",
      ],
    },
    {
      heading: "10. Changes",
      paragraphs: [
        "We will announce material changes to this policy on this page.",
      ],
    },
  ],
};

export const getPolicyContent = (language: string): PolicyContent => (language.startsWith("pl") ? PL : EN);
