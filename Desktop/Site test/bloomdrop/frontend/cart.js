const API = "http://localhost:4000";

let cart = JSON.parse(localStorage.getItem("cart")) || [];

function addToCart(name, price) {
  cart.push({ name, price });
  localStorage.setItem("cart", JSON.stringify(cart));
  alert("Added to cart");
}

function displayCart() {
  const list = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");

  if (!list) return;

  list.innerHTML = cart.map(item =>
    `<li>${item.name} - $${item.price}</li>`
  ).join("");

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  totalEl.innerText = "Total: $" + total;
}

async function checkout() {
  const email = document.getElementById("email").value;
  const city = document.getElementById("city").value;
  const total = cart.reduce((sum, item) => sum + item.price, 0);

  await fetch(`${API}/checkout`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, items: cart, city, total })
  });

  localStorage.removeItem("cart");
  alert("Order placed! Confirmation email sent.");
  window.location.href = "index.html";
}

displayCart();
