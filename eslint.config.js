const neostandard = require('neostandard');

module.exports = [
  ...neostandard({
    ts: true,
    ignores: [
      ...neostandard.resolveIgnoresFromGitignore(),
      '**/*/*.cjs',
    ],
    semi: true,
  }),
  {
    rules: {
      strict: ['error', 'global'],
      'no-loop-func': ['error'],
      curly: ['error', 'multi-line', 'consistent'],
      'no-unused-private-class-members': ['error'],
      'no-invalid-this': ['error'],
      'class-methods-use-this': ['warn'],
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'always'],
      'prefer-arrow-callback': ['error'],
      'prefer-numeric-literals': ['error'],
      'prefer-rest-params': ['error'],
      'prefer-spread': ['error'],
      'no-console': ['off'],
      'max-nested-callbacks': [
        'error',
        { max: 5 },
      ],
      'no-lonely-if': ['error'],
      'no-nested-ternary': ['error'],
      'object-shorthand': ['error'],
      'operator-assignment': ['error', 'always'],
      'n/handle-callback-err': ['off'],
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
];
