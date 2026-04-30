/** @type {import('stylelint').Config} */
module.exports = {
  extends: ['stylelint-config-standard', 'stylelint-config-standard-vue'],
  rules: {
    'custom-property-pattern': '^ll-[a-z0-9-]+$',
    'custom-property-empty-line-before': null,
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['deep', 'slotted', 'global'] },
    ],
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
    {
      // Nextcloud's CSS variables (`--color-*`, `--ll-font-*`, etc.) are
      // referenced inside the Nextcloud app for theme integration; we
      // don't author them here, so the `ll-` prefix rule doesn't apply.
      files: ['packages/nextcloud/**/*.{css,vue}'],
      rules: {
        'custom-property-pattern': null,
      },
    },
  ],
};
