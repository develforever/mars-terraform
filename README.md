# Mars Terraform

**Mars Terraform** is a browser-based 3D strategy game and fullstack portfolio project built with React, TypeScript, Three.js and Node.js.

The player starts a Mars colony, manages resources, builds terraforming infrastructure and tries to keep the settlement alive while the planet slowly becomes more habitable.

## Why this project exists

This project is designed as a portfolio showcase of:

- React application architecture
- TypeScript-first frontend and backend development
- Three.js / React Three Fiber 3D rendering
- game state management with Zustand
- fullstack authentication with JWT and OAuth
- REST API design with tsoa
- database schema management with Drizzle ORM
- automated tests with Vitest

## Features

- 3D Mars start scene
- playable anonymous mode
- optional account system
- Google and GitHub OAuth login when configured
- colony naming flow
- terrain grid for building structures
- resource economy tick
- game over and new game flow
- weather alert UI
- REST backend with authentication, users and groups

## Tech stack

### Frontend

- React
- TypeScript
- Vite
- Three.js / React Three Fiber
- Zustand
- TailwindCSS
- Vitest
- React Testing Library

### Backend

- Node.js
- TypeScript
- Express
- tsoa
- JWT authentication
- Drizzle ORM
- drizzle-kit
- Vitest

## Gameplay

The game can be played anonymously. Authentication is optional and is used for account-related features.

Main routes:

- `/` - start scene with interactive Mars
- `/mars` - terraform gameplay view
- `/reset-password` - password reset callback
- `/verify-email` - email verification callback

## Authentication

The application supports:

- local email/password registration
- email verification
- password reset
- JWT sessions
- optional Google OAuth
- optional GitHub OAuth

Social login buttons are displayed only when the backend reports that the provider is configured.

Provider status endpoint:

```http
GET /api/auth/providers
```

Example response:

```json
{
  "google": true,
  "github": false
}
```

## Running locally

Install dependencies:

```bash
npm install
```

Run frontend:

```bash
npm run dev:front
```

Run backend:

```bash
npm run dev:back
```

Run both:

```bash
npm run dev
```

Default frontend URL:

```txt
http://localhost:5173
```

Backend API is available under:

```txt
/api
```

## Environment configuration

Backend configuration is loaded through the project config class.

Common variables:

```env
jwt_secret=change-me
frontend_url=http://localhost:5173

google_client_id=
google_client_secret=

github_client_id=
github_client_secret=
```

When Google or GitHub credentials are empty, the corresponding login button is hidden.

## Database

The backend uses Drizzle ORM and drizzle-kit.

Useful command:

```bash
npm run db:push
```

Database schema:

```txt
src_backend/db/schema.ts
```

## API generation

The backend uses tsoa for typed REST controller generation.

```bash
npm run tsoa:gen
```

Controllers are located in:

```txt
src_backend/controller
```

## Tests and verification

Run tests:

```bash
npm run test
```

Build project:

```bash
npm run build
```

## Project structure

```txt
src/
  app/
  application/
  domain/
  presentation/
  ui/

src_backend/
  controller/
  service/
  db/
  middleware/
  model/
  tsoa/
```

## Portfolio highlights

This project demonstrates the ability to build a complete interactive product, not just isolated UI components.

It combines real-time 3D rendering, frontend state management, backend authentication, API design and database modeling in one coherent fullstack application.
