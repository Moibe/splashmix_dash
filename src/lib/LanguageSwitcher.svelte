<script>
  import { locale } from 'svelte-i18n'
</script>

<div class="language-switcher">
  <button
    class="lang-btn"
    class:active={$locale === 'es'}
    on:click={() => {
      locale.set('es')
      localStorage.setItem('locale', 'es')
    }}
    title="Español"
  >
    <i class="fa-solid fa-pepper-hot"></i>
    ES
  </button>
  <button
    class="lang-btn"
    class:active={$locale === 'en'}
    on:click={() => {
      locale.set('en')
      localStorage.setItem('locale', 'en')
    }}
    title="English"
  >
    <i class="fa-solid fa-burger"></i>
    EN
  </button>
</div>

<style>
  .language-switcher {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .lang-btn {
    background: none;
    border: 2px solid #ccc;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    padding: 6px 10px;
    transition: all 0.3s ease;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .flag {
    width: 20px;
    height: 13px;
    border-radius: 2px;
  }

  .lang-btn:hover {
    border-color: #0052cc;
    background: rgba(0, 82, 204, 0.1);
    transform: scale(1.1);
  }

  .lang-btn.active {
    border-color: #0052cc;
    background: rgba(0, 82, 204, 0.2);
    font-weight: bold;
  }
</style>
