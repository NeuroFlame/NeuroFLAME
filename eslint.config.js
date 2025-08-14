const neostandard = require('neostandard')

module.exports = [
  ...neostandard({
    ts: true,
    ignores: [
      ...neostandard.resolveIgnoresFromGitignore(),
    ],
    semi: true,
  }),
  {
    rules: {
      strict: ['error', 'global'],
      'no-loop-func': ['error'],
      curly: ['error', 'multi-line', 'consistent'],
      'consistent-return': ['error', { treatUndefinedAsUnspecified: true }],
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
        {
          max: 5,
        },
      ],
      'no-lonely-if': ['error'],
      'no-nested-ternary': ['error'],
      'object-shorthand': ['error'],
      'operator-assignment': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
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
