const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// GET all orders
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find();
    res.json(orders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT order status + products
router.put("/:id/status", async (req, res) => {
  const { status, products } = req.body;
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status, products }, { new: true });
    res.json(order);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE order
router.delete("/:id", async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;