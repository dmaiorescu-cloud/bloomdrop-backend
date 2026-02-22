<!-- cart.js -->
<script>
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('#cart-count').forEach(el => el.textContent = count);
}

function addToCart(name, price) {
  const item = cart.find(p => p.name === name);
  if (item) item.qty++;
  else cart.push({ name, price, qty: 1 });
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function renderCart() {
  const list = document.getElementById('cart-items');
  if (!list) return;
  list.innerHTML = '';
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;
    const li = document.createElement('li');
    li.textContent = `${item.name} x${item.qty}`;
    list.appendChild(li);
  });
  document.getElementById('cart-total').textContent = total;
}

function checkout() {
  alert('Order placed! Thank you 🌸');
  localStorage.removeItem('cart');
  cart = [];
  renderCart();
  updateCartCount();
}

updateCartCount();
renderCart();
</script>

