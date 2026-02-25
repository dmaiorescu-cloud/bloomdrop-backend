const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).populate("products.product");
  res.json(orders);
});

router.post("/", auth, async (req, res) => {
  const { products } = req.body;

  for (let item of products) {
    const product = await Product.findById(item.product);
    if (product.stock < item.quantity)
      return res.status(400).json({ message: "Not enough stock" });

    product.stock -= item.quantity;
    await product.save();
  }

  const order = new Order({
    user: req.user._id,
    products
  });

  await order.save();
  res.json(order);
});

router.put("/:id", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) return res.status(404).json({ message: "Not found" });

  for (let item of req.body.products) {
    const product = await Product.findById(item.product);
    product.stock += item.quantity;
    await product.save();
  }

  order.products = req.body.products;
  order.status = req.body.status;
  await order.save();

  res.json(order);
});

module.exports = router;