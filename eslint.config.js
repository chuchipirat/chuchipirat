// ESLint-Konfiguration (Flat Config, ESLint 9).
//
// Übernimmt die Regeln der früheren `.eslintrc.cjs` und ergänzt die
// Hooks-Regeln von React. Bewusst ohne typisiertes Linting (kein
// `parserOptions.project`), damit `npm run lint` schnell bleibt.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    // Wie bisher nur TypeScript prüfen; Build-, Report- und Datenbankordner
    // ausnehmen (sie enthalten generierte oder fremde Dateien).
    ignores: [
      "**/*.js",
      "**/*.jsx",
      "lib/**",
      "build/**",
      "coverage/**",
      "html-report/**",
      "supabase/volumes/db/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Nicht `react.configs.flat["jsx-runtime"]`: Das schaltet `jsx-uses-react`
  // ab, dann gelten die vielen `import React` als unbenutzt.
  react.configs.flat.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {...globals.browser},
    },
    settings: {
      react: {version: "detect"},
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // `cond && fn()` und `cond ? a() : b()` als Anweisung sind hier üblich;
      // gemeldet werden nur Ausdrücke ohne jede Wirkung.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {allowShortCircuit: true, allowTernary: true},
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/display-name": "off",
    },
  },
);
