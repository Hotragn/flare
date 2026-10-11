<script lang="ts">
  import PhoneFrame from "#lib/components/PhoneFrame.svelte";
  let { children } = $props();
</script>

<PhoneFrame>{@render children()}</PhoneFrame>
