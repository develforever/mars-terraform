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
- **Performance**: Use `useMemo` and `useCallback` to optimize components within the R3F loop.
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
