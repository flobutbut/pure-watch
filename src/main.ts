import { inject } from '@vercel/analytics';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { bootStage } from './ui/boot';

bootStage('script');
const app = mount(App, { target: document.getElementById('app')! });
// La vue de chargement reste affichée jusqu'à ce que la montre et ses pièces soient prêtes.
bootStage('app');

// Mesure d'audience Vercel Web Analytics (sans cookie, données agrégées, spec §9.11).
// En production seulement. La configuration de la montre vit dans le fragment de l'URL
// (#v1…, spec §9.6) : on le retire de chaque événement pour qu'elle ne quitte jamais
// le navigateur.
if (import.meta.env.PROD) {
  inject({
    beforeSend: (event) => ({ ...event, url: event.url.split('#')[0]! }),
  });
}

export default app;
