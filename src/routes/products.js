const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// GET all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST new product
router.post("/", async (req, res) => {
  const { name, price, stock } = req.body;
  try {
    const product = new Product({ name, price, stock });
    await product.save();
    res.status(201).json(product);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE product
router.delete("/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;