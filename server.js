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