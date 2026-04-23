/** @type {import('stylelint').Config} */
module.exports = {
  extends: ['stylelint-config-standard', 'stylelint-config-standard-vue'],
  rules: {
    'custom-property-pattern': '^ll-[a-z0-9-]+$',
    'custom-property-empty-line-before': null,
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'declaration-empty-line-before': null,
    'value-keyword-case': [
      'lower',
      {
        ignoreProperties: [
          '/^font-family$/',
          '/^font$/',
          '--ll-font-serif',
          '--ll-font-sans',
          '--ll-font-mono',
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
};
