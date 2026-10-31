# Faza 9 — Gra sieciowa bez kont (PLAN, do akceptacji)

> Status: **PROPOZYCJA**. Nic z tej fazy nie jest zaimplementowane. Decyzje D1–D7 czekają na użytkownika.
> Kontekst: Faza 8 zakończona modelem **gry bez kont** (D18): zapisy i mapy w przeglądarce, brak bazy,
> brak danych osobowych, minimalny serwer (`src_backend`, T15) z punktem rozszerzenia `registerRoutes`.

## 1. Cel

Wspólna rozgrywka 2–4 graczy w czasie rzeczywistym, z logiką liczoną na serwerze (ochrona przed oszustwami,
jedno źródło prawdy), **bez kont, bez bazy i bez trwałego przechowywania danych graczy**.

Poza zakresem: rankingi globalne, profile graczy, czat tekstowy (moderacja = dane osobowe), matchmaking z obcymi.

## 2. Ograniczenia (wynikają z D18)

- Brak kont i identyfikatorów trwałych między sesjami. Gracz w pokoju = losowy identyfikator sesji + pseudonim na czas gry.
- Brak bazy. Stan pokoju tylko w pamięci serwera; po końcu gry / bezczynności znika.
- Serwer nie zapisuje adresów IP ani pseudonimów do logów (logi bez treści wiadomości).
- Notka `/privacy` musi zostać zaktualizowana **przed** uruchomieniem (IP przetwarzane w trakcie połączenia).
- CSP: po D19 nie ma `vercel.json`, więc nagłówki (w tym CSP) ustawia serwer gry. Frontend i WebSocket
  z jednego originu (D3), więc wystarcza `connect-src 'self'` (przeglądarki z CSP3 dopasowują `'self'` do `ws:`/`wss:` tego hosta).

## 3. Stan obecny kodu (ustalenia)

| Obszar | Stan | Konsekwencja |
|---|---|---|
| Domena (`src/domain/services/*`) | czysty TypeScript, bez three.js | da się uruchomić na serwerze (Node) |
| Pętla gry | `useEconomy` (setInterval 1 s / prędkość) woła `applyEconomyTick` w **store Zustand** (`useGameStore.ts`, ~1100 linii) | logikę ticka trzeba wydzielić z store do czystej funkcji |
| Losowość | `Math.random` w `WeatherService`, `AlienService`, `ColonyNameGenerator` | symulacja niedeterministyczna; serwer i klient rozjadą się bez wspólnego seeda |
| Format zapisu | `SavedGame` (zod, `localSaveService`) | gotowy kontrakt stanu do synchronizacji / snapshotów |
| Serwer | Express, CORS, `/api/health`, `registerRoutes` | brak WebSocket; trzeba dodać |

## 4. Architektura (rekomendacja)

```
Przeglądarka (React/r3f)                         Serwer gry (Node, 1 proces)
  render + UI + predykcja lokalna   ── WSS ──►    Room (pamięć): stan gry, gracze, kolejka komend
  wysyła KOMENDY (buduj, ulepsz...)               pętla 1 tick/s: GameSimulation.step(state, commands, rng)
  odbiera SNAPSHOTY / DELTY          ◄── WSS ──   rozsyła stan; po końcu gry: podpisany wynik (opcjonalnie)
```

1. **Wspólny rdzeń symulacji** `src/domain/simulation/` (nowy): czysta funkcja `step(state, commands, rng) → state`
   wydzielona z `applyEconomyTick`. Używa jej klient (tryb solo, jak dziś) i serwer (tryb sieciowy).
2. **Deterministyczny RNG** (seedowany, np. mulberry32/xoshiro w kodzie, bez paczki) przekazywany do serwisów zamiast `Math.random`.
3. **Pokoje z kodem**: `POST`/WS `create` → kod `MARS-4K7Q` (losowy, krótki TTL); `join` z kodem i pseudonimem.
   Limit graczy, limit pokoi na proces, wygaszanie po bezczynności.
4. **Model sieci**: serwer autorytatywny, klient wysyła komendy (nie stan). Klient może przewidywać lokalnie
   (ten sam `step`), korekta po snapshocie. Na start wystarczy snapshot co tick (1 s) bez predykcji.
5. **Tryb solo bez zmian**: gra lokalna działa jak dziś (bez serwera). Tryb sieciowy to osobna ścieżka w UI.
6. **Podpisany stan (opcjonalnie, później)**: wynik/zapis z gry sieciowej podpisany HMAC serwera (do ewentualnych
   wyzwań/rankingów bez kont). Nie jest potrzebny do samej kooperacji.

## 5. Decyzje do podjęcia

| ID | Pytanie | Rekomendacja |
|---|---|---|
| D1 | Tryb pierwszej wersji: kooperacja (wspólna kolonia) czy rywalizacja (osobne kolonie na jednej mapie)? | **Kooperacja 2 graczy** (mniej balansu, prostszy stan) |
| D2 | Transport: biblioteka `ws` (mała, standard) czy Socket.IO (cięższa, reconnect/rooms w pakiecie)? | **`ws`** (wymaga zgody na paczkę npm) |
| D3 | Hosting serwera gry | ~~Render Free~~ (nieaktualne po D19). **Self-host u gospodarza**, szczegóły niżej |
| D4 | Synchronizacja: snapshot co tick czy komendy + deterministyczny lockstep? | **Snapshot co tick** na start (prościej, odporne na rozjazd) |
| D5 | Co z zapisem gry sieciowej? | Brak trwałego zapisu na serwerze; gospodarz może pobrać plik zapisu na końcu |
| D6 | Pseudonimy | Wpisywane per pokój, filtr długości/znaków, bez zapisu; brak czatu |
| D7 | Limity ochronne | max 4 graczy/pokój, max N pokoi/proces, TTL pokoju 30 min bezczynności, limit komend/s na połączenie |

### D3 (zmiana 2026-10-31): serwer gry u gospodarza

Zgodnie z D19 autor nie utrzymuje żadnego serwera. Grę sieciową uruchamia **gospodarz** u siebie:

- Jeden proces Node (`serve_frontend=true`) serwuje frontend (`dist/`) **i** WebSocket (np. ścieżka `/ws`)
  pod tym samym originem. Klient łączy się z `ws(s)://${location.host}/ws`; nie ma pola „adres serwera” w grze.
- Pozostali gracze otwierają w przeglądarce adres gospodarza: LAN (`http://192.168.x.x:port`), przekierowanie portu
  albo tunel (np. https przez tunel → `wss` działa bez dodatkowej konfiguracji, bo origin jest wspólny).
- Statyczny frontend z dowolnego hostingu zostaje **tylko solo**. Tryb sieciowy w UI pokazuje się wyłącznie,
  gdy strona jest serwowana przez serwer gry (wykrycie np. przez `/api/health`).
- Koszt dla autora: 0. Autor nie przetwarza IP graczy; danymi połączenia (IP) dysponuje gospodarz.
- Bezpieczeństwo: przy upgrade WebSocket serwer sprawdza nagłówek `Origin` (tylko własny origin, ochrona przed
  cross-site WebSocket hijacking), limity D7 obowiązują bez zmian.

## 6. Zadania (kolejność, każde z testami)

| ID | Zadanie | Zależy | Ryzyko |
|---|---|---|---|
| F9-T1 | Deterministyczny RNG + wstrzyknięcie do `WeatherService`, `AlienService` (bez zmiany zachowania solo) | — | średnie (testy losowości) |
| F9-T2 | Wydzielenie `GameSimulation.step` z `applyEconomyTick` (store woła rdzeń; testy porównawcze stan-przed/po) | T1 | **wysokie** (największy refaktor) |
| F9-T3 | Model komend gracza (buduj, ulepsz, rozbierz, badania, rozkazy RTS) + walidacja (zod) | T2 | średnie |
| F9-T4 | Serwer: WebSocket (D2) na tym samym serwerze HTTP co frontend (D3), kontrola `Origin`, pokoje w pamięci, pętla ticka, rozsyłanie snapshotów, limity (D7) | T3 | średnie |
| F9-T5 | Klient: tryb sieciowy (same-origin `/ws`, widoczny tylko na serwerze gry; utwórz/dołącz kod, lobby, render ze snapshotów, wysyłka komend, reconnect) | T4 | średnie |
| F9-T6 | Prywatność i bezpieczeństwo: notka `/privacy` (gra sieciowa = serwer gospodarza, autor nie przetwarza IP), nagłówki i CSP `connect-src 'self'` z serwera gry, logi bez danych, testy obciążeniowe pokoju | T4 | niskie |
| F9-T7 | Instrukcja dla gospodarza (skrypt startowy, port, LAN / przekierowanie / tunel) + smoke test 2 przeglądarek w LAN | T5, T6 | niskie |

Proponowany pierwszy kamień milowy: **T1 + T2** (bez żadnych zmian widocznych dla gracza; czysty zysk
architektoniczny i testowalność), potem decyzja, czy iść dalej z siecią.

## 7. Ryzyka

- **Refaktor store (T2)**: logika ticka jest spleciona z UI-stanem Zustand; ryzyko regresji w trybie solo.
  Ograniczenie: testy „złote” (zapis stanu po N tickach przed i po refaktorze, ten sam seed).
- **Dostępność przez internet (D3)**: gospodarz za NAT musi otworzyć port albo użyć tunelu; to bariera dla
  mniej technicznych graczy. Ograniczenie: czytelna instrukcja (F9-T7); oficjalny serwer autora = osobna decyzja w przyszłości.
- **Wydajność**: symulacja wielu pokoi w jednym procesie Node; limity D7 i pomiar przed startem.
- **Prawo**: przetwarzanie IP w trakcie gry = formalnie dane osobowe; minimalizacja (bez logów, bez zapisu),
  aktualizacja notki, ewentualnie ponowne rozważenie danych usługodawcy (ustawa o świadczeniu usług drogą elektroniczną, art. 5).

## 8. Szacunek

T1–T2: kilka zadań agentowych (refaktor + testy), bez zmian dla gracza. T3–T7: osobna, większa faza
(serwer + klient sieciowy), ok. 2–3 razy więcej pracy niż T1–T2. Koszt hostingu dla autora: 0 $ (serwer u gospodarza, D3).
