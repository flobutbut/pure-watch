/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [svelte()],
  build: {
    // Le moteur 3D (Three.js, ≈ 160 ko compressés) est un bloc chargé à la demande.
    chunkSizeWarningLimit: 800,
    // Le banc de rendu studio est publié (lien « Rendu studio » de l'en-tête), en page à part :
    // son moteur ne pèse pas sur le configurateur. La page de revue reste hors du site publié :
    // seuls les tests de bout en bout la construisent.
    rolldownOptions: {
      input: {
        main: 'index.html',
        studio: 'studio.html',
        ...(process.env.EPURE_REVIEW ? { review: 'review.html' } : {}),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
