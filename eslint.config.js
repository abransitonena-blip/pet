import eslintPluginJs from '@eslint/js'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import globals from 'globals'

const files = ['**/*.{js,jsx,ts,tsx,mjs,cjs}']

export default tseslint.config(
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
  }
)
