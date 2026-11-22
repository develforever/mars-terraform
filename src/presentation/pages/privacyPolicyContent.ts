/**
 * Informacja o prywatności (T14, D18: gra BEZ kont). Aplikacja nie przetwarza danych osobowych na serwerze:
 * zapisy gry i mapy są wyłącznie w przeglądarce gracza. Gra sieciowa (F9-T6, D3) działa na serwerze gospodarza,
 * nie autora. Kontakt: e-mail projektu (bez danych osobowych autora).
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
  updated: "Ostatnia aktualizacja: 22 listopada 2026",
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
      heading: "4. Gra sieciowa",
      paragraphs: [
        "Wspólną grę prowadzi serwer, który jeden z graczy (gospodarz) uruchamia na swoim komputerze. Autor gry nie prowadzi serwerów gry, nie widzi rozgrywek i nie przetwarza Twojego adresu IP.",
        "Łącząc się z pokojem, przesyłasz swój adres IP do serwera gospodarza, a jeśli gospodarz używa tunelu (np. Cloudflare albo ngrok) - także do operatora tunelu. Gospodarz odpowiada za swój serwer i łącze.",
        "Serwer gry trzyma stan pokoju, pseudonimy i kod pokoju tylko w pamięci, dopóki pokój istnieje, i niczego nie zapisuje na dysku. Pseudonim wybierasz sam na czas jednej gry; nie podawaj w nim danych osobowych. Logi serwera nie zawierają pseudonimów, kodów pokoi ani adresów IP.",
        "Wejście do pokoju oznacza, że inni gracze w pokoju widzą Twój pseudonim i Twoje działania w kolonii.",
      ],
    },
    {
      heading: "5. Kontakt",
      paragraphs: [
        `Pytania i zgłoszenia dotyczące gry i prywatności: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "6. Zmiany",
      paragraphs: [
        "Jeśli zmienimy sposób działania gry sieciowej albo dodamy nowe funkcje sieciowe, zaktualizujemy tę informację przed ich uruchomieniem.",
      ],
    },
  ],
};

const EN: PolicyContent = {
  title: "Privacy",
  updated: "Last updated: 22 November 2026",
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
      heading: "4. Online play",
      paragraphs: [
        "Multiplayer games run on a server that one of the players (the host) starts on their own computer. The game's author does not run game servers, cannot see games and does not process your IP address.",
        "When you join a room, your IP address is sent to the host's server and, if the host uses a tunnel (e.g. Cloudflare or ngrok), to the tunnel operator. The host is responsible for their server and connection.",
        "The game server keeps the room state, nicknames and the room code in memory only while the room exists and writes nothing to disk. You choose your nickname for a single game; do not put personal data in it. Server logs contain no nicknames, room codes or IP addresses.",
        "Joining a room means the other players in it can see your nickname and your actions in the colony.",
      ],
    },
    {
      heading: "5. Contact",
      paragraphs: [
        `Questions and reports about the game and privacy: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "6. Changes",
      paragraphs: [
        "If we change how online play works or add new online features, we will update this notice before launching them.",
      ],
    },
  ],
};

export const getPolicyContent = (language: string): PolicyContent => (language.startsWith("pl") ? PL : EN);
