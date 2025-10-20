import globals from 'globals';
import pluginJs from '@eslint/js';
import next from '@next/eslint-plugin-next';

export default [
    {
        ignores: ['.next/**', 'node_modules/**'],
    },
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
        },
        plugins: {
            '@next/next': next,
        },
        rules: {
            ...pluginJs.configs.recommended.rules,
            ...next.configs['core-web-vitals'].rules,
        },
    },
];
