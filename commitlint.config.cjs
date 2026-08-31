// Конфигурация commitlint: заголовки сообщений по Conventional Commits.
// npm i -D @commitlint/cli @commitlint/config-conventional
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'docs',
        'refactor',
        'test',
        'ci',
        'chore',
        'style',
        'build',
        'revert',
      ],
    ],
    'header-max-length': [2, 'always', 100],
  },
};