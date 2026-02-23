// src/server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const auth = require("./middleware/auth");
const Order = require("./models/Order");
const Product = require("./models/Product");

const app = express();

// ---------------------------
// CORS setup for Netlify frontend
// ---------------------------
const allowedOrigins = ["https://magazinas.netlify.app"];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    }
    return callback(null, true);
  },
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.options("*", cors());

app.use(express.json());

// ---------------------------
// MongoDB
// ---------------------------
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI);

mongoose.connection.on("connected", () =>
  console.log("✅ MongoDB connected")
);
mongoose.connection.on("error", err =>
  console.error("❌ MongoDB error:", err)
);

// ---------------------------
// Admin credentials
// ---------------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

// ---------------------------
// Nodemailer
// ---------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ===========================
// ROUTES
// ===========================

// ---------------------------
// Admin login
// ---------------------------
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL ||
      !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { admin: true },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ token });
});

// ---------------------------
// PRODUCTS (Shop + Admin)
// ---------------------------

// Public - Shop page
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error("❌ Get products error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin - Add product (WITH IMAGE SUPPORT)
app.post("/api/products", auth, async (req, res) => {
  try {
    const { name, price, stock, image } = req.body;

    const product = await Product.create({
      name,
      price,
      stock,
      image
    });

    console.log(`✅ Product added: ${name}`);
    res.status(201).json(product);

  } catch (err) {
    console.error("❌ Add product error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin - Delete product
app.delete("/api/products/:id", auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    console.log(`✅ Product deleted: ${req.params.id}`);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------
// CHECKOUT (Stock Deduction)
// ---------------------------
app.post("/checkout", async (req, res) => {
  try {
    const { email, city, items, total } = req.body;

    // Validate + deduct stock safely
    for (let item of items) {
      const product = await Product.findById(item.productId);

      if (!product)
        return res.status(400).json({ error: "Product not found" });

      if (product.stock < item.qty)
        return res.status(400).json({
          error: `Not enough stock for ${product.name}`
        });

      product.stock -= item.qty;
      await product.save();
    }

    // Delivery fee logic
    const deliveryZones = [
      { zone: "New York", fee: 5 },
      { zone: "Los Angeles", fee: 7 },
      { zone: "Other", fee: 10 }
    ];

    const zone =
      deliveryZones.find(z => z.zone === city) ||
      deliveryZones.find(z => z.zone === "Other");

    const deliveryFee = zone.fee;

    const order = await Order.create({
      email,
      city,
      products: items.map(i => ({
        productId: i.productId,
        name: i.name,
        quantity: i.qty
      })),
      finalTotal: total + deliveryFee,
      status: "pending"
    });

    // Send confirmation email
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "BloomDrop Order Confirmation",
      text: `Thank you for your order! Total: $${order.finalTotal}`
    });

    res.json(order);

  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

// ---------------------------
// ORDERS (Admin)
// ---------------------------
app.get("/api/orders", auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error("❌ Get orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/orders/:id/status", auth, async (req, res) => {
  try {
    const { status, products } = req.body;

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status, products },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ error: "Order not found" });

    res.json(updated);

  } catch (err) {
    console.error("❌ Update order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/orders/:id", auth, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Delete order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));