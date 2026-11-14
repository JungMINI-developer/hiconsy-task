/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'refactor',
        'style',
        'design',
        'docs',
        'test',
        'chore',
        'build',
        'ci',
        'perf',
        'revert',
      ],
    ],
    'scope-enum': [1, 'always', ['web', 'api', 'shared', 'infra', 'deps', 'config']],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
