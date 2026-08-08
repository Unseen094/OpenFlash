import js from '@eslint/js'
import typescriptEslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'no-case-declarations': 'off',
      'no-useless-catch': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'error'
    },
    settings: {
      react: {
        version: '18'
      }
    },
    languageOptions: {
      parser: typescriptEslint.parser,
    }
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.mjs', '*.config.ts', '*.config.js']
  }
]
