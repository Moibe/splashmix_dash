<script>
  import { auth } from './firebase'
  import { user } from './authStore'
  import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'

  let error = null
  
  $: if ($user) {
    console.log('Usuario logueado:', $user.displayName)
    console.log('Photo URL:', $user.photoURL)
  }

  async function handleGoogleLogin() {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      error = null
    } catch (err) {
      error = err.message
      console.error('Error al autenticarse:', err)
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth)
      error = null
    } catch (err) {
      error = err.message
      console.error('Error al cerrar sesión:', err)
    }
  }
</script>

<style>
  .auth-container {
    margin: 1rem 0;
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 8px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    background: #ff3e00;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
  }
  
  .avatar-fallback {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #ff3e00;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
  }

  .user-details {
    display: flex;
    flex-direction: column;
  }

  .user-name {
    font-weight: bold;
    color: #333;
  }

  .user-email {
    font-size: 0.9rem;
    color: #666;
  }

  button {
    background: #ff3e00;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  button:hover {
    background: #ff6040;
  }

  .error {
    color: #d32f2f;
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .google-button {
    background: white;
    color: #333;
    border: 1px solid #ddd;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .google-button:hover {
    background: #f5f5f5;
  }
</style>

<div class="auth-container">
  {#if $user}
    <div class="user-info">
      {#if $user.photoURL}
        <img 
          src={$user.photoURL} 
          alt="Avatar" 
          class="user-avatar" 
          onload="console.log('✅ Imagen avatar cargada')"
          onerror="console.log('❌ Error cargando avatar'); this.style.display='none'; this.nextElementSibling.style.display='flex'" 
        />
        <div class="avatar-fallback" style="display: none;">👤</div>
      {:else}
        <div class="avatar-fallback">👤</div>
      {/if}
      <div class="user-details">
        <div class="user-name">{$user.displayName || 'Usuario'}</div>
        <div class="user-email">{$user.email}</div>
      </div>
    </div>
    <button on:click={handleLogout}>Cerrar sesión</button>
  {:else}
    <button class="google-button" on:click={handleGoogleLogin}>
      🔐 Iniciar sesión con Google
    </button>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>
