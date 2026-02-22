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
const Product = require("./models/Product"); // <-- Added product model

const app = express();

// ---------------------------
// CORS setup for Netlify frontend
// ---------------------------
const allowedOrigins = ["https://bloomdropgpt.netlify.app"];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow server-to-server or curl
    if (!allowedOrigins.includes(origin)) {
      const msg = `❌ CORS blocked for origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Handle preflight OPTIONS requests
app.options("*", cors());

// ---------------------------
// Middleware
// ---------------------------
app.use(express.json());

// ---------------------------
// MongoDB connection
// ---------------------------
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set in environment variables!");
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000
});

mongoose.connection.on('connected', () => console.log(`✅ MongoDB connected to ${MONGO_URI}`));
mongoose.connection.on('error', (err) => console.error('❌ MongoDB connection error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));

// Optional: log queries
mongoose.set('debug', (collection, method, query, doc) => {
  console.log(`MongoDB: ${collection}.${method}`, JSON.stringify(query), doc || '');
});

// ---------------------------
// Admin credentials
// ---------------------------
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

// ---------------------------
// Nodemailer setup
// ---------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ---------------------------
// Routes
// ---------------------------

// Admin login
app.post("/admin/login", (req, res) => {
  try {
    const { email, password } = req.body;
    if (email !== ADMIN_EMAIL || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: "8h" });
    console.log(`✅ Admin logged in: ${email}`);
    res.json({ token });
  } catch (err) {
    console.error("❌ Admin login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Checkout / place order
app.post("/checkout", async (req, res) => {
  try {
    const { email, city, items, total } = req.body;

    // Delivery fee logic
    const deliveryZones = [
      { zone: "New York", fee: 5 },
      { zone: "Los Angeles", fee: 7 },
      { zone: "Other", fee: 10 }
    ];
    const zone = deliveryZones.find(z => z.zone === city) || deliveryZones.find(z => z.zone === "Other");
    const deliveryFee = zone.fee;

    const order = await Order.create({
      email,
      city,
      products: items.map(i=>({ productId: i.productId, name: i.name, quantity: i.qty })),
      finalTotal: total + deliveryFee,
      status: "pending"
    });

    console.log(`✅ Order created for ${email}, total: $${order.finalTotal}`);

    // Send confirmation email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'BloomDrop Order Confirmation',
      text: `Thank you for your order! Total: $${order.finalTotal}`
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) console.error("❌ Error sending email:", err);
      else console.log(`✅ Confirmation email sent to ${email}`);
    });

    res.json(order);
  } catch (err) {
    console.error("❌ Checkout error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------
// Orders routes (admin only)
// ---------------------------
app.get("/api/orders", auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    console.log(`✅ Fetched ${orders.length} orders`);
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
    if (updated) {
      console.log(`✅ Updated order ${updated._id} status to ${status}`);
      res.json(updated);
    } else {
      console.warn(`⚠️ Order ${req.params.id} not found`);
      res.status(404).json({ error: "Order not found" });
    }
  } catch (err) {
    console.error("❌ Update order status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/orders/:id", auth, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    console.log(`✅ Order ${req.params.id} deleted`);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Delete order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------
// Products routes (admin + public)
// ---------------------------
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.error("❌ Get products error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/products", auth, async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const product = await Product.create({ name, price, stock });
    console.log(`✅ Product added: ${name}`);
    res.status(201).json(product);
  } catch (err) {
    console.error("❌ Add product error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/products/:id", auth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    console.log(`✅ Product ${req.params.id} deleted`);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("❌ Delete product error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));