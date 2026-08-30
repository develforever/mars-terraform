---
trigger: always_on
---

# AI Agent Programming Rules - Mars Terraform

This document defines the guidelines and standards for AI agents working on the Mars Terraform project. Adherence to these rules ensures consistency, security, and high quality across the codebase.

## 1. General Principles

### Communication & Ethics
- **Conciseness**: Keep responses brief and focused on the technical task.
- **Verification**: Always verify the correctness of generated code by running tests or build commands.
- **No Assumptions**: If requirements are ambiguous, ask the user for clarification.
- **Safety**: Do not execute destructive commands (e.g., `rm -rf`, `git reset --hard`) without explicit confirmation.

### Environment & Dependencies
- **Windows Context**: Assume the environment is Windows PowerShell.
- **Dependency Management**: Never install new npm packages without asking the user.
- **Configuration**: Always use `src_backend/config.ts` to access environment variables. Never use `process.env` directly in the code. Use files .env and .env.local for dotenv-flow.

### Git & Branching Workflow
- **No Direct Work on `main`**: Never develop or commit directly to the `main` branch.
- **Feature Branches**: Always create a dedicated branch (e.g., `feat/...`, `fix/...`, `refactor/...`) for each task.
- **Commit & Review**: Commit completed and verified changes to the task branch at the end. All changes require code review before merging.

---

## 2. Backend (Node.js + TypeScript + TSOA)

### Controllers & Routing
- **TSOA Usage**: Always use TSOA decorators (`@Route`, `@Get`, `@Post`, etc.) for building APIs.
- **Restful API**: Ensure the API follows REST principles, is JSON-based, and uses descriptive path names.
- **Type Safety**: All controller methods must have explicit return types (DTOs/Interfaces).

### Database (Drizzle ORM)
- **Schema**: Define all entities in `src_backend/db/schema.ts`.
- **Migrations**: Use `npm run db:push` for development changes. For production-like migrations, use `drizzle-kit generate`.
- **Querying**: Use the Drizzle relational query API or `db.select().from()...` syntax as appropriate.

### Service Layer
- **Logic Separation**: Keep business logic in `src_backend/service/` and call these services from controllers.
- **Error Handling**: Use custom error classes and TSOA's error handling mechanisms.

---

## 3. Frontend (React 19 + Three.js + Zustand)

### React & Components
- **Functional Components**: Always use arrow functions for components.
- **PascalCase**: All component files and functions must be `PascalCase`.
- **React 19 Patterns**: Leverage new React 19 features where applicable (e.g., `use` hook, improved `ref` handling).
- **Styling**: Use **TailwindCSS 4**. Avoid inline styles unless necessary for dynamic 3D properties.

### 3D Scene (Three.js / React Three Fiber)
- **Componentization**: Break down the 3D scene into small, reusable R3F components (e.g., `Mars.tsx`, `Building.tsx`).
- **Performance (React Compiler)**: Projekt korzysta z React Compiler (`babel-plugin-react-compiler`).
  NIE dodawaj ręcznych `useMemo` ani `useCallback` — kompilator robi to sam, a ręczne memo zaciemnia kod
  i bywa źródłem nieaktualnych domknięć. Wyjątek: gdy wymaga tego API biblioteki zewnętrznej
  (np. stabilna referencja przekazywana do R3F/drei). Każdy taki wyjątek opatrz komentarzem z uzasadnieniem.
- **Assets**: Reference 3D assets from the `public/` directory or specialized asset loaders.

### State Management (Zustand)
- **Store Location**: All stores should be in `src/application/store/`.
- **Immutability**: Ensure all state updates are immutable.
- **Selectors**: Always use selectors when consuming state to prevent unnecessary re-renders.

---

## 4. Coding Standards

### File Structure & Ordering
- **Classes**: `constructor` -> `fields` -> `methods` -> `getters/setters`.
- **Files**: `imports` -> `types/interfaces` -> `constants` -> `main logic` -> `exports`.
- **Components**: `props` -> `state (hooks)` -> `derived state` -> `effects` -> `render logic`.

### TypeScript
- **Strict Typing**: Avoid `any` at all costs. Use `unknown` if the type is truly unknown, or define specific interfaces.
- **Interfaces over Types**: Prefer `interfaces` for defining object structures, especially for props and DTOs.

---

## 5. Testing & Verification

### Requirements
- **Mandatory Tests**: Every new feature or fix must be accompanied by unit tests.
- **Tools**: Use **Vitest** for both frontend and backend logic. Use **React Testing Library** for UI components.
- **Verification**: Run `npm run build` to ensure no regression in compilation.
- **Commands**:
    - `npm run test`: Runs all tests.
    - `npm run tsoa:gen`: Regenerates routes and OpenAPI spec after controller changes.
    - `npm run lint`: Checks for linting errors.

---

## 6. Prohibited Actions
- Do **not** modify `package.json` scripts without confirmation.
- Do **not** bypass the `Config` class for environment variables.
- Do **not** change the project structure (folders) without a strong justification.

---

## 7. Protokół agenta wykonawczego

Ta sekcja obowiązuje agenta, który realizuje pakiet zadań zlecony przez orchestratora.
Powstała z konkretnych błędów popełnionych w tym projekcie — każdy punkt kosztował co najmniej jeden cykl review.

### 7.1 Rola i granice zakresu
- Specyfikacja z promptu jest wiążąca. Nie rozszerzaj zakresu, nawet gdy poprawka wydaje się oczywista i tania.
- Znalazłeś inny błąd po drodze → zapisz go w sekcji 7 raportu i **zostaw**. Naprawa poza zakresem uniemożliwia zlokalizowanie regresji.
- Brakuje danych do bezbłędnej implementacji → zatrzymaj się, zadaj precyzyjne pytanie, czekaj. Nigdy nie zgaduj i nie twórz mocków „na razie".

### 7.2 Zakaz samooceny ukończenia
- Nie pisz „zadanie zrealizowane w 100%", „wszystko działa", „gotowe do review", „w pełni przetestowane".
- O ukończeniu decyduje orchestrator na podstawie surowych dowodów, nie twojej oceny.
- Jeśli którykolwiek punkt Definition of Done nie jest spełniony — napisz to wprost w sekcji 6. Raport mówiący „gotowe" nad niedziałającym stanem kosztuje więcej niż raport mówiący „utknąłem tutaj".

### 7.3 Komendy weryfikacyjne — dokładnie te, bez skrótów

```
npm run test                                    # front + back; sam `vitest run` NIE wystarcza
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p src_backend/tsconfig.json   # bez -p sprawdzenie bywa puste
npm run lint
npm run test:e2e
npm run build
```

- Wklejaj **surowy output**. Parafraza nie jest dowodem.
- Podaj liczbę plików testowych i testów, porównaj z poprzednim pakietem i wyjaśnij różnicę. Spadek liczby testów bez usunięcia funkcji oznacza, że część zestawu nie została uruchomiona.

### 7.4 Zasady dowodzenia
- **Pomiar, który potwierdza tezę zbyt gładko, jest podejrzany.** Seria odczytów identycznych co do cyfry częściej oznacza zepsuty przyrząd niż stabilny system.
- Zanim uznasz pomiar za dowód, odpowiedz sobie: *co ta liczba pokazałaby, gdyby funkcja była całkowicie zepsuta?* Jeśli to samo — pomiar jest bezwartościowy.
- Diagnostyka musi obejmować okno czasowe, w którym występuje awaria. Log zaczynający się po awarii jej nie zobaczy.
- Asercja spełniona przez wartość startową nie jest asercją (`expect(x).toBeGreaterThanOrEqual(60)` przy starcie równym 60).
- Nie diagnozuj renderowania ze zrzutu ekranu z karty w tle — czytaj `renderer.info`.

### 7.5 Pułapki tego repozytorium
- **`renderer.info` przy postprocessingu**: `useFrame` czytający po composerze zwraca statystyki ostatniego passu efektów (`calls=1, triangles=1`), nie sceny. Poprawnie: `gl.info.autoReset = false`, `reset()` w `useFrame(-1)`, odczyt w `useFrame(2)`.
- **Playwright startuje świeży kontekst na każdy test** — ukrywa błędy stanu narastające w obrębie jednej karty. Scenariusze wielokrotnego wejścia testuj w pętli, w jednym kontekście przeglądarki.
- **`visibilitychange` nie pada**, gdy karta jest ukryta od załadowania. Zawsze sprawdzaj też stan początkowy `document.visibilityState`.
- **Dodanie klucza do `ResourceKey`** propaguje się przez ~29 plików. Każde nowe pole stanu gry musi trafić do autozapisu, `loadGame` i zapisu chmurowego, z jawnym fallbackiem pole po polu — spread po `INITIAL_COLONY_STATE` nie uratuje starego zapisu, bo nadpisze go `undefined`.
- **Dwa konteksty WebGL** (scena startowa + scena gry) resetuje sterownik ANGLE. Odmontowanie sceny 3D wymaga `scene.traverse` z dispose geometrii, materiałów i tekstur, `gl.dispose()` oraz `WEBGL_lose_context`.

### 7.6 Higiena repozytorium
- Końce linii **LF** (wymuszone przez `.gitattributes`). Przed commitem `git status --short` ma pokazywać wyłącznie pliki, które faktycznie zmieniałeś. Masowa zmiana setek plików to błąd narzędzia — cofnij ją, nie commituj.
- Osobny branch na pakiet, jeden commit na zadanie, conventional commits.
- Artefakty narzędzi (`test-results/`, `playwright-report/`) do `.gitignore`, nie do repozytorium.

### 7.7 Format raportu — osiem sekcji, zawsze wszystkie

```
1. Wykonane                    per zadanie, pełne ścieżki, [NOWY] / [ZMIENIONY] / [USUNIĘTY]
2. Struktura zmian             drzewo obejmujące wyłącznie dotknięte pliki
3. Dowody merytoryczne         pomiary, logi, dane specyficzne dla zadania
4. Bramki jakości              surowy output wszystkich komend z 7.3
5. Playtest                    co widziałeś i w której sekundzie, ze zrzutami ekranu
6. Odstępstwa od specyfikacji  „brak", jeśli brak
7. Znalezione, ale nienaprawione   „brak", jeśli brak
8. Pytania blokujące           „brak", jeśli brak
```

Sekcje 6–8 wypełniaj **zawsze**, także gdy odpowiedź brzmi „brak". Sekcja 7 jest dla orchestratora najcenniejsza — jej jednorazowe pominięcie kosztowało pełny cykl review, bo znany błąd renderera czekał na wykrycie zamiast wyjść od razu.

### 7.8 Czerwona drużyna przed raportem
Zanim wyślesz raport, wypisz **trzy sposoby, w jakie twoja zmiana może być zepsuta mimo zielonych testów**, i sprawdź każdy z nich. Wynik dołącz do sekcji 3. Jeśli któryś okaże się prawdziwy — napraw albo zgłoś w sekcji 6.
