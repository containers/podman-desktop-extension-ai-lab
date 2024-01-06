<script lang="ts">
  import { onMount } from 'svelte';
import './app.css';

onMount(() => {
  const podmanDesktopApi = acquirePodmanDesktopApi();

      // Update state
      podmanDesktopApi.setState({ studioValue: 1 });


      // Handle messages sent from the extension to the webview
  window.addEventListener('message', event => {
    console.log('received the message from the backend with data:', event.data);
  });


  // after 20s, send a message to the backend
  setTimeout(() => {
    podmanDesktopApi.postMessage({ message: 'Hello from the webview!' });
  }, 20000);

});
</script>


<div>
    <h1>Hello Studio World !</h1>
</div>
