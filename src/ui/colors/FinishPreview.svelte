<script lang="ts">
  import { dialPatternData, isDialPatternFinish } from '../../render3d/dial-patterns';
  import { ambienceFor } from '../ambience';
  import { effectiveDialColor } from '../../core/config/dial';
  let { finish, color }: { finish: string; color: string } = $props();
  let canvas: HTMLCanvasElement;
  const ambience = $derived(ambienceFor({ finish, color }));
  $effect(() => {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, 64, 64);
    if (!isDialPatternFinish(finish)) return;
    const pixels = dialPatternData(finish, 8, 64);
    const hex = effectiveDialColor({ finish, color });
    const rgb = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    const image = context.createImageData(64, 64);
    for (let i = 0; i < image.data.length; i += 4) {
      const nx = pixels.normal[i]! / 127.5 - 1,
        ny = pixels.normal[i + 1]! / 127.5 - 1;
      const shade = Math.max(0.48, Math.min(1.12, 0.84 - nx * 1.5 + ny * 1.5));
      for (let channel = 0; channel < 3; channel++)
        image.data[i + channel] = Math.min(255, rgb[channel]! * shade);
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  });
</script>

<span class="sample" style:background={ambience.layers} style:background-color={ambience.base}>
  <canvas bind:this={canvas} width="64" height="64" aria-hidden="true"></canvas>
</span>

<style>
  .sample {
    display: block;
    height: 48px;
    width: 48px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px #8885;
  }
  canvas {
    display: block;
    height: 100%;
    width: 100%;
  }
</style>
