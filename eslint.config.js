import eslintPluginJs from '@eslint/js'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'react-refresh'
import globals from 'globals'

export default [
  eslintPluginJs.configs.recommended,
  ...eslintPluginReact.configs.flat.recommended,
  eslintPluginReactHooks.configs['recommended-latest'],
  ...eslintPluginReactRefresh.configs.recommended,
]
