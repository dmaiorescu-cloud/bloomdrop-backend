require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const Product = require("./models/Product");
const Order = require("./models/Order");
const auth = require("./middleware/auth");

const app = express();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/* ---------------- Admin Login ---------------- */
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.ADMIN_EMAIL ||
    !bcrypt.compareSync(password, bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10))
  ) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { admin: true },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});
app.use(cors());
app.use(express.json());

/* ---------------- MongoDB ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("Mongo error:", err));

/* ---------------- Helpers ---------------- */
function getDeliveryFee(city) {
  if (!city) return 0;
  const c = city.toLowerCase();
  if (c.includes("dubai")) return 20;
  if (c.includes("abu")) return 25;
  return 30;
}

/* ---------------- Products ---------------- */

// Get products
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Add product
app.post("/api/products", auth, async (req, res) => {
  const product = await Product.create(req.body);
  res.json(product);
});

// Update price & stock
app.put("/api/products/:id", auth, async (req, res) => {
  const { price, stock } = req.body;
  const updated = await Product.findByIdAndUpdate(
    req.params.id,
    { price, stock },
    { new: true }
  );
  res.json(updated);
});

// Delete product
app.delete("/api/products/:id", auth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ---------------- Checkout ---------------- */

app.post("/checkout", async (req, res) => {
  try {
    const { email, city, items } = req.body;

    let subtotal = 0;
    const orderProducts = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product)
        return res.status(400).json({ error: "Product not found" });

      if (product.stock < item.qty)
        return res.status(400).json({ error: "Out of stock" });

      subtotal += product.price * item.qty;

      orderProducts.push({
        productId: product._id,
        name: product.name,
        price: product.price,     // 🔒 snapshot price
        quantity: item.qty
      });
    }

    const finalTotal = subtotal + getDeliveryFee(city);

    // Deduct stock AFTER validation
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.qty }
      });
    }

    const order = await Order.create({
      email,
      city,
      products: orderProducts,
      finalTotal,
      status: "pending"
    });

    res.json(order);
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

/* ---------------- Orders ---------------- */

// Admin get orders
app.get("/api/orders", auth, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// ✅ FIXED: Update order status & quantities AND RECALCULATE TOTAL
app.put("/api/orders/:id/status", auth, async (req, res) => {
  try {
    const { status, products, city } = req.body;

    let subtotal = 0;

    // Recalculate using SNAPSHOT prices
    products.forEach(p => {
      subtotal += p.price * p.quantity;
    });

    const finalTotal = subtotal + getDeliveryFee(city);

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status,
        products,
        finalTotal
      },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ error: "Order not found" });

    res.json(updated);
  } catch (err) {
    console.error("Order update error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// Delete order
app.delete("/api/orders/:id", auth, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ---------------- Server ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Server running on", PORT));