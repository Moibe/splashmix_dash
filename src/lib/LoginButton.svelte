<script>
  import { auth } from './firebase'
  import { user } from './authStore'
  import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth'

  let error = null
  let dropdownOpen = false
  
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
      dropdownOpen = false
      error = null
    } catch (err) {
      error = err.message
      console.error('Error al cerrar sesión:', err)
    }
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen
  }
</script>

<style>
  .auth-container {
    margin: 0;
    padding: 0;
    background: transparent;
    border-radius: 12px;
    border: none;
    backdrop-filter: none;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: space-between;
    position: relative;
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
    background: #4A90E2;
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
    background: #4A90E2;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
  }

  .user-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .user-name {
    font-weight: bold;
    color: #333333;
    font-size: 0.9rem;
  }

  .user-email {
    font-size: 0.8rem;
    color: #666666;
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

  .user-profile-button {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    position: relative;
  }

  .dropdown-arrow {
    font-size: 0.8rem;
    transition: transform 0.3s ease;
    color: #666;
  }

  .user-profile-button.open .dropdown-arrow {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    z-index: 1000;
  }

  .logout-button-menu {
    width: 100%;
    background: none;
    color: #333;
    border: none;
    padding: 0.8rem 1.2rem;
    cursor: pointer;
    text-align: left;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .logout-button-menu:hover {
    background: #f5f5f5;
    color: #d32f2f;
    transform: none;
    box-shadow: none;
  }
</style>

<div class="auth-container">
  {#if $user}
    <div class="user-info">
      <button class="user-profile-button" class:open={dropdownOpen} on:click={toggleDropdown}>
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
        <span class="dropdown-arrow">▼</span>
      </button>
      
      {#if dropdownOpen}
        <div class="dropdown-menu">
          <button class="logout-button-menu" on:click={handleLogout}>🚪 Cerrar sesión</button>
        </div>
      {/if}
    </div>
  {:else}
    <button class="google-button" on:click={handleGoogleLogin}>
      🔐 Conecta con Google
    </button>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}
</div>
