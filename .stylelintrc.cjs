/** @type {import('stylelint').Config} */
module.exports = {
  extends: ['stylelint-config-standard', 'stylelint-config-standard-vue'],
  rules: {
    'custom-property-pattern': '^ll-[a-z0-9-]+$',
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'declaration-empty-line-before': null,
  },
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
};
