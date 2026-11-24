<script lang="ts">
  import Modal from './Modal.svelte';
  import { t } from './i18n.svelte';

  let { onclose }: { onclose?: () => void } = $props();

  const AUTHOR = 'Florian Butour';
  const EMAIL = 'f.butour@gmail.com';
  const year = new Date().getFullYear();
  let modal: Modal;

  export function open() {
    modal.show();
  }
</script>

<Modal bind:this={modal} title={t().about.title} closeLabel={t().about.close} wide {onclose}>
  {@const m = t().about}
  <div class="content">
    <p class="intro">
      {m.introBefore}
      <strong>{AUTHOR}</strong>{m.introAfter}
    </p>

    <section>
      <h3>{m.contact}</h3>
      <p>
        {m.contactText}
        <a href="mailto:{EMAIL}?subject={encodeURIComponent('Épure')}">{EMAIL}</a>
      </p>
    </section>

    <section>
      <h3>{m.rights}</h3>
      <p>{m.rightsText(year, AUTHOR)}</p>
    </section>

    <section>
      <h3>{m.legal}</h3>
      <dl>
        <dt>{m.publisher}</dt>
        <dd>{AUTHOR}, {m.individual} — <a href="mailto:{EMAIL}">{EMAIL}</a></dd>
        <dt>{m.hosting}</dt>
        <dd>{m.hostAddress}</dd>
      </dl>
      <p>{m.disclaimer}</p>
    </section>

    <section>
      <h3>{m.privacy}</h3>
      <p>{m.privacyText}</p>
    </section>

    <section>
      <h3>{m.credits}</h3>
      <p>{m.creditsText}</p>
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
