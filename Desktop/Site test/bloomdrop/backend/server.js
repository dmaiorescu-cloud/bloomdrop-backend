require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

const orderSchema = new mongoose.Schema({
  email: String,
  items: Array,
  city: String,
  deliveryFee: Number,
  finalTotal: Number,
  status: { type: String, default: "New" },
  createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", orderSchema);

/* ================= DELIVERY ZONES ================= */

const deliveryZones = [
  { zone: "Zone A", cities: ["CityA"], fee: 5 },
  { zone: "Zone B", cities: ["CityB"], fee: 8 },
  { zone: "Zone C", cities: ["CityC"], fee: 12 }
];

/* ================= EMAIL ================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ================= AUTH ================= */

function authenticateToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err) return res.sendStatus(403);
    next();
  });
}

/* ================= ADMIN LOGIN ================= */

app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET);
  res.json({ token });
});

/* ================= CHECKOUT ================= */

app.post("/checkout", async (req, res) => {
  const { email, items, city, total } = req.body;

  const zone = deliveryZones.find(z => z.cities.includes(city));
  const deliveryFee = zone ? zone.fee : 15;
  const finalTotal = total + deliveryFee;

  await Order.create({
    email,
    items,
    city,
    deliveryFee,
    finalTotal
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "BloomDrop Order Confirmation 🌸",
    html: `
      <h2>Thank you for your order!</h2>
      <p>Total: $${finalTotal}</p>
      <p>Delivery Fee: $${deliveryFee}</p>
      <p>Your flowers are on the way 💐</p>
    `
  });

  res.json({ success: true });
});

/* ================= ADMIN ROUTES ================= */

app.get("/admin/orders", authenticateToken, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

/* ================= START SERVER ================= */

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
