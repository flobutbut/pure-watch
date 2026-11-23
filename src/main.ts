import { inject } from '@vercel/analytics';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

// L'écran de chargement se fond dans l'application une fois celle-ci montée.
document.getElementById('boot')?.classList.add('done');

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
