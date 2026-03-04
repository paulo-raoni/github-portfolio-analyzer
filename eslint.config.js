export default [
  {
    ignores: [
      'node_modules/**',
      'output/**',
      'coverage/**',
      '.nyc_output/**',
      'tmp-test/**',
      'tmp/**',
      '.tmp/**',
      'runs/**',
      '.runs/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        Buffer: 'readonly',
        URLSearchParams: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
      'no-unreachable': 'error'
    }
  }
];
