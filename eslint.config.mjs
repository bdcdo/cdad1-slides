// Lint estrito do JavaScript em arquivo próprio deste site (hoje, o painel de votação), com as mesmas regras dos
// outros sites da disciplina. Complexidade ciclomática no máximo 10 por função. Os globais são os do navegador que
// o código usa; um global novo precisa entrar aqui, o que pega nome digitado errado num caminho que nenhum teste
// percorre. Bibliotecas de terceiros (pdfjs/, uqr/) ficam de fora: são cópias fiéis, e não código deste site.
// Uso: npx --yes eslint@10.12.0 .
const navegador = Object.fromEntries([
  'AbortSignal', 'URL', 'addEventListener', 'clearTimeout', 'document', 'fetch', 'sessionStorage', 'setTimeout',
].map(nome => [nome, 'readonly']));

export default [
  { ignores: ['pdfjs/', 'uqr/'] },
  {
    files: ['votacao/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: navegador },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'after-used' }],
      'no-shadow': 'error',
      'no-use-before-define': ['error', { functions: false }],
      'no-implicit-globals': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-constant-binary-expression': 'error',
      'no-unsafe-optional-chaining': 'error',
      'require-atomic-updates': 'off',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-param-reassign': 'off',
      curly: ['error', 'multi-line'],
    },
  },
];
