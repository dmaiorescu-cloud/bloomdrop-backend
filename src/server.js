require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Product = require("./models/Product");
const Order = require("./models/Order");
const auth = require("./middleware/auth");

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

/* ---------------- MongoDB ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ Mongo error:", err);
    process.exit(1);
  });

/* ---------------- Helpers ---------------- */
function getDeliveryFee(city) {
  if (!city) return 0;
  const c = city.toLowerCase();
  if (c.includes("dubai")) return 20;
  if (c.includes("abu")) return 25;
  return 30;
}

/* ---------------- Admin Login ---------------- */
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.ADMIN_EMAIL ||
    !bcrypt.compareSync(
      password,
      bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)
    )
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

/* ---------------- Products ---------------- */
app.get("/api/products", async (_, res) => {
  res.json(await Product.find());
});

app.post("/api/products", auth, async (req, res) => {
  res.json(await Product.create(req.body));
});

app.put("/api/products/:id", auth, async (req, res) => {
  const { price, stock } = req.body;
  res.json(
    await Product.findByIdAndUpdate(
      req.params.id,
      { price, stock },
      { new: true }
    )
  );
});

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
      if (!product) return res.status(400).json({ error: "Product not found" });
      if (product.stock < item.qty)
        return res.status(400).json({ error: "Out of stock" });

      subtotal += product.price * item.qty;

      orderProducts.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.qty
      });
    }

    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.qty }
      });
    }

    const order = await Order.create({
      email,
      city,
      products: orderProducts,
      finalTotal: subtotal + getDeliveryFee(city),
      status: "pending"
    });

    res.json(order);
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

/* ---------------- Orders ---------------- */
app.get("/api/orders", auth, async (_, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }));
});

app.put("/api/orders/:id/status", auth, async (req, res) => {
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

app.delete("/api/orders/:id", auth, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ---------------- Server ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);