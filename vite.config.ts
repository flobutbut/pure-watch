/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    // Le moteur 3D (Three.js, ≈ 160 ko compressés) est un bloc chargé à la demande.
    chunkSizeWarningLimit: 800,
    // La page de revue reste hors du site publié : seuls les tests de bout en bout la construisent.
    ...(process.env.EPURE_REVIEW
      ? { rolldownOptions: { input: { main: 'index.html', review: 'review.html' } } }
      : {}),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
