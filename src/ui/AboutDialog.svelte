<script lang="ts">
  import Modal from './Modal.svelte';

  let { onclose }: { onclose?: () => void } = $props();

  const AUTHOR = 'Florian Butour';
  const EMAIL = 'f.butour@gmail.com';
  const year = new Date().getFullYear();
  let modal: Modal;

  export function open() {
    modal.show();
  }
</script>

<Modal bind:this={modal} title="À propos d’Épure" closeLabel="Fermer À propos" wide {onclose}>
  <div class="content">
    <p class="intro">
      Épure est un atelier horloger virtuel : un configurateur pour composer sa montre pièce par
      pièce et la partager. Le projet a été imaginé, conçu et développé par
      <strong>{AUTHOR}</strong>.
    </p>

    <section>
      <h3>Contact</h3>
      <p>
        Une question, une suggestion, une collaboration ?
        <a href="mailto:{EMAIL}?subject={encodeURIComponent('Épure')}">{EMAIL}</a>
      </p>
    </section>

    <section>
      <h3>Droits réservés</h3>
      <p>
        © {year}
        {AUTHOR}. Tous droits réservés. Le nom Épure, son logo, le code, les visuels et les rendus
        générés par le configurateur sont protégés par le droit d’auteur. Toute reproduction ou
        réutilisation, totale ou partielle, sans autorisation écrite préalable est interdite. Le
        partage des liens de configuration est bien sûr libre.
      </p>
    </section>

    <section>
      <h3>Mentions légales</h3>
      <dl>
        <dt>Éditeur et directeur de la publication</dt>
        <dd>{AUTHOR}, particulier — <a href="mailto:{EMAIL}">{EMAIL}</a></dd>
        <dt>Hébergement</dt>
        <dd>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com</dd>
      </dl>
      <p>
        Les montres présentées sont des créations virtuelles : les rendus sont indicatifs et non
        contractuels. Épure ne vend aucun produit et n’est affilié à aucune marque horlogère.
      </p>
    </section>

    <section>
      <h3>Données personnelles</h3>
      <p>
        Aucun compte, aucun cookie. Votre configuration est enregistrée uniquement dans le lien de
        la page et ne quitte pas votre navigateur, sauf si vous choisissez de la partager. Une
        mesure d’audience anonyme et agrégée (Vercel Web Analytics, sans cookie) permet de suivre la
        fréquentation du site.
      </p>
    </section>

    <section>
      <h3>Crédits</h3>
      <p>
        Rendu 3D avec Three.js. Polices Bebas Neue, Cinzel, Federant, Orbitron, Playfair Display et
        Poiret One, sous licence SIL Open Font License.
      </p>
    </section>
  </div>
</Modal>

<style>
  .content {
    max-height: min(62dvh, 560px);
    overflow-y: auto;
    margin-right: -10px;
    padding-right: 10px;
    font-size: 12px;
    line-height: 1.65;
  }
  .intro {
    margin: 0 0 4px;
  }
  section {
    padding-top: 16px;
    margin-top: 16px;
    border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }
  h3 {
    margin: 0 0 6px;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.6;
  }
  p {
    margin: 0;
    opacity: 0.85;
  }
  dl + p {
    margin-top: 8px;
  }
  strong {
    font-weight: 500;
  }
  a {
    color: inherit;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in srgb, var(--ink) 40%, transparent);
  }
  a:hover {
    text-decoration-color: currentColor;
  }
  a:focus-visible {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    border-radius: 2px;
  }
  dl {
    margin: 0 0 8px;
    opacity: 0.85;
  }
  dt {
    font-weight: 500;
  }
  dd {
    margin: 0 0 6px;
  }
</style>
