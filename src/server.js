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
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("DB connected"))
  .catch(err => console.error("DB connection error:", err));

// Admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
  const { email, city, items, total } = req.body;
  
  // Simple delivery fee example
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

  // Send confirmation email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'BloomDrop Order Confirmation',
    text: `Thank you for your order! Total: $${order.finalTotal}`
  };
  transporter.sendMail(mailOptions);

  res.json(order);
});

// Admin: get all orders (protected)
app.get("/orders", auth, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// Admin: update order status
app.put("/orders/:id/status", auth, async (req, res) => {
  const { status } = req.body;
  await Order.findByIdAndUpdate(req.params.id, { status });
  res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));