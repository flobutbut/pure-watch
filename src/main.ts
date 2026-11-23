import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

// L'écran de chargement se fond dans l'application une fois celle-ci montée.
document.getElementById('boot')?.classList.add('done');

export default app;
