<script lang="ts">
  import Flame from "#lib/components/Flame.svelte";
  import Button from "#lib/components/Button.svelte";
  import PhotoPrint from "#lib/components/PhotoPrint.svelte";
</script>
<div style="display:flex;gap:16px;padding:20px"><Flame state="kindling" progress={0.5} /><Flame state="lit" /><Flame state="ember" /><Flame state="gone" /></div>
<div style="width:360px;padding:20px"><PhotoPrint scene="A pond with yellow trees and an empty bench." height={360} /><Button>I'm in</Button></div>
