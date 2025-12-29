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
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: space-between;
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: 1rem;
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
    color: #ffffff;
  }

  .user-email {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  button {
    background: #4A90E2;
    color: white;
    border: 2px solid #4A90E2;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.3s ease;
  }

  button:hover {
    background: #357ABD;
    border-color: #357ABD;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
  }

  .logout-button {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    border: 2px solid rgba(255, 255, 255, 0.3);
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    margin: 0;
    flex-shrink: 0;
  }

  .logout-button:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .error {
    color: #fca5a5;
    margin-top: 0.5rem;
    font-size: 0.9rem;
  }

  .google-button {
    background: #4A90E2;
    color: #ffffff;
    border: 2px solid #4A90E2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .google-button:hover {
    background: #357ABD;
    border-color: #357ABD;
  }
</style>

<div class="auth-container">
  {#if $user}
    <div class="user-info">
      <div class="user-profile">
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
      <button class="logout-button" on:click={handleLogout}>Cerrar sesión</button>
    </div>
  {:else}
    <button class="google-button" on:click={handleGoogleLogin}>
      🔐 Iniciar sesión con Google
    </button>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>
