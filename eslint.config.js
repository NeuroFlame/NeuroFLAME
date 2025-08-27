const neostandard = require('neostandard')

module.exports = [
  ...neostandard({
    ts: true,
    ignores: [
      ...neostandard.resolveIgnoresFromGitignore(),
      '**/*/*.cjs',
    ],
    semi: false,
  }),
  {
    rules: {
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'always'],
      curly: ['error', 'multi-line', 'consistent'],
      'no-lonely-if': ['error'],
      'object-shorthand': ['error'],
      'prefer-arrow-callback': ['error'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/jsx-closing-tag-location': ['error', 'line-aligned'],
      '@stylistic/jsx-self-closing-comp': ['error', {
        component: true,
        html: true,
      }],
      '@stylistic/jsx-wrap-multilines': ['error', {
        declaration: 'parens',
        assignment: 'parens',
        return: 'parens',
        arrow: 'parens',
        condition: 'ignore',
        logical: 'ignore',
        prop: 'ignore',
        propertyValue: 'ignore',
      }],
      '@stylistic/max-len': [
        'error',
        {
          code: 80,
          ignoreComments: true,
          ignoreTrailingComments: true,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      '@stylistic/multiline-ternary': 'off',
      '@stylistic/space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
    },
  },
]
