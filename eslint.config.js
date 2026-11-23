import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
  },
  {
    // Le cœur ne dépend ni du framework d'interface ni du moteur de rendu (spec §9.1).
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['svelte', 'svelte/*'], message: 'core/ ne doit pas dépendre de Svelte.' },
            { group: ['three', 'three/*'], message: 'core/ ne doit pas dépendre de Three.js.' },
            {
              group: ['**/ui/**', '**/render2d/**', '**/render3d/**'],
              message: 'core/ ne doit importer aucune autre couche.',
            },
          ],
        },
      ],
    },
  },
);
