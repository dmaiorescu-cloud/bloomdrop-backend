// src/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const auth = require('./middleware/auth');
const Order = require('./models/Order');

const app = express();

// ---------------------------
// CORS middleware (prevents browser blocking)
// ---------------------------
const allowedOrigins = ["https://bloomdropgpt.netlify.app"];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman, curl, server-to-server
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `❌ CORS: Origin not allowed: ${origin}`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Preflight requests
app.options("*", cors());

// Body parser
app.use(express.json());

// ---------------------------
// MongoDB connection with logging
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

mongoose.connection.on('connected', () => {
  console.log(`✅ MongoDB connected to ${MONGO_URI}`);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

// Optional: log all queries for debugging
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
  const { email, password } = req.body;
  if (email !== ADMIN_EMAIL || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// Checkout / place order
app.post("/checkout", async (req, res) => {
  try {
    const { email, city, items, total } = req.body;

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
      items,
      total,
      deliveryFee,
      finalTotal: total + deliveryFee
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

// Admin: get all orders (protected)
app.get("/orders", auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    console.log(`✅ Fetched ${orders.length} orders`);
    res.json(orders);
  } catch (err) {
    console.error("❌ Get orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: update order status
app.put("/orders/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (updated) {
      console.log(`✅ Updated order ${updated._id} status to ${status}`);
      res.json({ success: true });
    } else {
      console.warn(`⚠️ Order ${req.params.id} not found`);
      res.status(404).json({ error: "Order not found" });
    }
  } catch (err) {
    console.error("❌ Update order status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------
// Start server
// ---------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));