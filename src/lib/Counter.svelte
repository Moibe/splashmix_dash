<script>
  import { counter } from './counterStore'

  function increment() {
    counter.update(c => c + 1)
  }

  function decrement() {
    counter.update(c => c - 1)
  }
</script>

<style>
  .counter {
    margin: 2rem 0;
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 8px;
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  
  button {
    background: #ff3e00;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #ff6040;
  }
  
  .number {
    font-size: 1.5rem;
    font-weight: bold;
    min-width: 3rem;
    text-align: center;
  }
</style>

<div class="counter">
  <button on:click={decrement}>-</button>
  <span class="number">{$counter}</span>
  <button on:click={increment}>+</button>
</div>