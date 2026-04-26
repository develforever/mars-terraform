import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'dist_backend']),
  
  // Konfiguracja wspólna dla wszystkich plików TS
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
  },

  // FRONTEND: src/
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // BACKEND: src_backend/
  {
    files: ['src_backend/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node, // Dodaje zmienne typu process, module itp.
      },
    },
    rules: {
      // Tutaj możesz dodać specyficzne zasady dla backendu
      "@typescript-eslint/no-unused-vars": "warn"
    }
  }
])