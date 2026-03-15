<script lang="ts">
  /** Skeleton loading placeholder. Adapts to container width. */
  export let height: string = '1em';
  export let width: string = '100%';
  export let rounded: boolean = false;
</script>

<div
  class="skeleton"
  class:rounded
  style:height
  style:width
/>

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      rgba(255 255 255 / 0.04) 25%,
      rgba(255 255 255 / 0.08) 50%,
      rgba(255 255 255 / 0.04) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

  .skeleton.rounded {
    border-radius: 50%;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
</style>
