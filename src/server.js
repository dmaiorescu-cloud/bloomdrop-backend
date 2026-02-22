require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const auth = require("./middleware/auth.js");
const Order = require("./models/Order");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"));

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email !== ADMIN_EMAIL ||
      !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
    expiresIn: "8h"
  });

  res.json({ token });
});
app.post("/checkout", async (req, res) => {
  const { email, city, items, total } = req.body;
  const zone = deliveryZones.find(z => z.zone === city);
  const deliveryFee = zone ? zone.fee : 0;

  const order = await Order.create({
    email,
    city,
    items,
    total,
    deliveryFee,
    finalTotal: total + deliveryFee
  });

  res.json(order);
app.get("/orders", auth, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});  
app.put("/orders/:id/status", auth, async (req, res) => {
  const { status } = req.body;
  await Order.findByIdAndUpdate(req.params.id, { status });
  res.json({ success: true });
});  
});
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const orders = [];

const deliveryZones = [
  { zone: "Zone A", cities: ["New York"], fee: 5 },
  { zone: "Zone B", cities: ["Brooklyn"], fee: 8 },
  { zone: "Zone C", cities: ["Queens"], fee: 12 }
];

app.get("/zones", (req, res) => res.json(deliveryZones));
app.get("/orders", (req, res) => res.json(orders));

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

app.post("/checkout", async (req, res) => {
  const { email, items, city, total } = req.body;

  const zone = deliveryZones.find(z => z.cities.includes(city));
  const fee = zone ? zone.fee : 15;
  const finalTotal = total + fee;

  orders.push({ email, items, city, finalTotal });

  await transporter.sendMail({
    from: "BloomDrop <" + process.env.EMAIL_USER + ">",
    to: email,
    subject: "🌸 BloomDrop Order Confirmation",
    html: `<h3>Thank you for your order</h3><p>Total: $${finalTotal}</p>`
  });

  res.json({ success: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Server running on port " + PORT));