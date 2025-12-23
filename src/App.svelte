<script>
  import Counter from './lib/Counter.svelte'
  import LoginButton from './lib/LoginButton.svelte'
  import SaveCounter from './lib/SaveCounter.svelte'
  
  let name = 'Svelte Moibe'
</script>

<style>
  main {
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
    padding: 2rem;
  }
  h1 { color: #ff3e00 }
</style>

<main>
  <h1>Bienvenido a Splashmix Dash</h1>
  <p>Esta es una app mínima de <strong>{name}</strong> (Vite + Svelte).</p>
  
  <LoginButton />
  
  <Counter />
  
  <SaveCounter />
</main>
