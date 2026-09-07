import eslintPluginJs from '@eslint/js'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import globals from 'globals'

const files = ['**/*.{js,jsx,ts,tsx,mjs,cjs}']

export default tseslint.config(
  {
    ignores: ['**/.next/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files,
    languageOptions: {
      globals: globals.browser,
    },
  },
  eslintPluginJs.configs.recommended,
  tseslint.configs.recommended,
  {
    files,
    settings: {
      react: { version: 'detect' },
    },
    ...eslintPluginReact.configs.flat.recommended,
  },
  {
    files,
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files,
    ...eslintPluginReactHooks.configs.flat.recommended,
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files,
    ...eslintPluginReactRefresh.configs.recommended,
  },
  {
    // Next.js App Router files export metadata/generateMetadata/constants by
    // convention; fast-refresh rule is not applicable to them.
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', 'functions/**/*.js', '**/*.config.js', '**/*.config.mjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['public/*-sw.js', 'public/sw.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        firebase: 'readonly',
      },
    },
  }
)
