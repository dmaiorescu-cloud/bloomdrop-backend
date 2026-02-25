require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const authRoutes = require("./routes/auth");
const Product = require("./models/Product");
const Order = require("./models/Order");
const Cart = require("./models/Cart");
const auth = require("./middleware/auth");
const cartRoutes = require("./routes/cart");

const app = express();

/* ---------------- CORS ---------------- */
const allowedOrigins = ["https://magazinas.netlify.app"];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS blocked"), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options("*", cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);

/* ---------------- MongoDB ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ Mongo error:", err);
    process.exit(1);
  });

/* =========================================================
   ROLE MIDDLEWARE
========================================================= */

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user || req.user.role !== "user") {
    return res.status(403).json({ error: "User access required" });
  }
  next();
}

/* ---------------- Helpers ---------------- */
function getDeliveryFee(city) {
  if (!city) return 0;
  const c = city.toLowerCase();
  if (c.includes("dubai")) return 20;
  if (c.includes("abu")) return 25;
  return 30;
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (email !== process.env.ADMIN_EMAIL) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH
  );

  if (!isMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { role: "admin", email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});

/* =========================================================
   PRODUCTS
========================================================= */

app.get("/api/products", async (_, res) => {
  res.json(await Product.find());
});

app.post("/api/products", auth, requireAdmin, async (req, res) => {
  res.json(await Product.create(req.body));
});

app.put("/api/products/:id", auth, requireAdmin, async (req, res) => {
  const { price, stock } = req.body;

  res.json(
    await Product.findByIdAndUpdate(
      req.params.id,
      { price, stock },
      { new: true }
    )
  );
});

app.delete("/api/products/:id", auth, requireAdmin, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================================================
   CHECKOUT (SECURE + DB CART BASED)
========================================================= */

app.post("/checkout", auth, requireUser, async (req, res) => {
  try {

    const { city, email } = req.body;

    const cart = await Cart.findOne({ userId: req.user._id })
      .populate("items.productId");

    if (!cart || !cart.items.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    let subtotal = 0;
    const orderProducts = [];

    for (const item of cart.items) {

      const product = item.productId;

      if (!product)
        return res.status(400).json({ error: "Product not found" });

      if (product.stock < item.quantity)
        return res.status(400).json({ error: "Out of stock" });

      subtotal += product.price * item.quantity;

      orderProducts.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      });
    }

    // reduce stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { stock: -item.quantity }
      });
    }

    const order = await Order.create({
      userId: req.user._id,
      email,
      city,
      products: orderProducts,
      finalTotal: subtotal + getDeliveryFee(city),
      status: "pending"
    });

    // clear cart after successful order
    cart.items = [];
    await cart.save();

    res.json(order);

  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

/* =========================================================
   ORDERS
========================================================= */

app.get("/api/orders", auth, requireAdmin, async (_, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }));
});

app.get("/api/my-orders", auth, requireUser, async (req, res) => {
  const orders = await Order.find({ userId: req.user._id })
    .sort({ createdAt: -1 });

  res.json(orders);
});

app.put("/api/orders/:id/status", auth, requireAdmin, async (req, res) => {
  try {

    const { status, products } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ error: "Order not found" });

    let subtotal = 0;

    const updatedProducts = products.map(p => {
      const existing = order.products.find(
        op => String(op.productId) === String(p.productId)
      );

      if (!existing)
        throw new Error("Product mismatch");

      subtotal += existing.price * p.quantity;

      return {
        productId: existing.productId,
        name: existing.name,
        price: existing.price,
        quantity: p.quantity
      };
    });

    order.status = status;
    order.products = updatedProducts;
    order.finalTotal = subtotal + getDeliveryFee(order.city);

    await order.save();
    res.json(order);

  } catch (err) {
    console.error("❌ Order update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/orders/:id", auth, requireAdmin, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================================================
   SERVER
========================================================= */

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);