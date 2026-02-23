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

/* ---------------------------
   CORS
--------------------------- */
const allowedOrigins = ["https://magazinas.netlify.app"];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (!allowedOrigins.includes(origin)) {
      return callback(new Error("CORS blocked"), false);
    }
    callback(null, true);
  }
}));

app.use(express.json());

/* ---------------------------
   MongoDB
--------------------------- */
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI);
mongoose.connection.once("open", () =>
  console.log("✅ MongoDB connected")
);

/* ---------------------------
   Admin
--------------------------- */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);

/* ---------------------------
   Mail
--------------------------- */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ---------------------------
   Helpers
--------------------------- */
function getDeliveryFee(city) {
  const zones = [
    { zone: "New York", fee: 5 },
    { zone: "Los Angeles", fee: 7 },
    { zone: "Other", fee: 10 }
  ];

  return (zones.find(z => z.zone === city) ||
          zones.find(z => z.zone === "Other")).fee;
}

/* ===========================
   ROUTES
=========================== */

/* ---------------------------
   Admin login
--------------------------- */
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (
    email !== ADMIN_EMAIL ||
    !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)
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

/* ---------------------------
   Products
--------------------------- */
app.get("/api/products", async (req, res) => {
  res.json(await Product.find());
});

app.post("/api/products", auth, async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

app.delete("/api/products/:id", auth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

/* ---------------------------
   Checkout (FIXED TOTAL)
--------------------------- */
app.post("/checkout", async (req, res) => {
  try {
    const { email, city, items } = req.body;

    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product)
        return res.status(400).json({ error: "Product not found" });

      if (product.stock < item.qty)
        return res.status(400).json({
          error: `Not enough stock for ${product.name}`
        });

      subtotal += product.price * item.qty;
    }

    const deliveryFee = getDeliveryFee(city);
    const finalTotal = subtotal + deliveryFee;

    // Deduct stock AFTER validation
    for (const item of items) {
      const product = await Product.findById(item.productId);
      product.stock -= item.qty;
      await product.save();
    }

    const order = await Order.create({
      email,
      city,
      products: items.map(i => ({
        productId: i.productId,
        name: i.name,
        quantity: i.qty
      })),
      finalTotal,
      status: "pending"
    });

    transporter.sendMail({
      to: email,
      subject: "BloomDrop Order Confirmation",
      text: `Thank you for your order! Total: $${finalTotal}`
    });

    res.json(order);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Checkout failed" });
  }
});

/* ---------------------------
   Orders (Admin)
--------------------------- */
app.get("/api/orders", auth, async (req, res) => {
  res.json(await Order.find().sort({ createdAt: -1 }));
});

/* ---------------------------
   Update order (FIXED TOTAL)
--------------------------- */
app.put("/api/orders/:id/status", auth, async (req, res) => {
  try {
    const { status, products, city } = req.body;

    let subtotal = 0;

    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      subtotal += product.price * item.quantity;
    }

    const deliveryFee = getDeliveryFee(city);
    const finalTotal = subtotal + deliveryFee;

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status,
        products,
        finalTotal
      },
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/orders/:id", auth, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

/* ---------------------------
   Start
--------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);