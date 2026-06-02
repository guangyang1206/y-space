import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // App-level globals exposed cross-file (defined in one file,
        // read in others). Mark only the ones that are *consumed* across
        // file boundaries here — defining them is fine in their own file.
        __i18n: 'writable',
        toggleLang: 'writable',
      },
    },
    rules: {
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // Top-level functions whose only callers live in inline HTML
          // attributes (onclick="toggleTheme()" etc.) — ESLint cannot
          // see those references, so whitelist by name.
          varsIgnorePattern: '^(toggleTheme|toggleMobileMenu)$',
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-var': 'off',
      'prefer-const': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', '.playwright-cli/**', 'tools/**'],
  },
];
