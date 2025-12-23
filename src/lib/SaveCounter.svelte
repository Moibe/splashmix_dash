<script>
  import { counter } from './counterStore'
  import { user } from './authStore'
  import { saveCounterToFirestore } from './firebase'

  let saving = false
  let message = ''

  async function handleSaveCounter() {
    if (!$user) {
      message = 'Debes autenticarte para guardar'
      return
    }

    saving = true
    message = ''

    const result = await saveCounterToFirestore($user.uid, $counter)
    
    if (result.success) {
      message = `✅ ${result.message}`
    } else {
      message = `❌ Error: ${result.message}`
    }

    saving = false

    // Limpiar el mensaje después de 3 segundos
    setTimeout(() => {
      message = ''
    }, 3000)
  }
</script>

<style>
  .save-container {
    margin: 1.5rem 0;
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 8px;
    text-align: center;
  }

  button {
    background: #4caf50;
    color: white;
    border: none;
    padding: 0.7rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
  }

  button:hover:not(:disabled) {
    background: #45a049;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .message {
    margin-top: 0.5rem;
    font-size: 0.95rem;
    font-weight: 500;
  }

  .success {
    color: #2e7d32;
  }

  .error {
    color: #d32f2f;
  }
</style>

<div class="save-container">
  <button on:click={handleSaveCounter} disabled={saving}>
    {saving ? 'Guardando...' : '💾 Guardar Contador'}
  </button>

  {#if message}
    <div class="message" class:success={message.includes('✅')} class:error={message.includes('❌')}>
      {message}
    </div>
  {/if}
</div>
