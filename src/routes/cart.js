const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const auth = require("../middleware/auth");

const router = express.Router();

/* =========================================================
   GET USER CART
========================================================= */

router.get("/", auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user._id })
      .populate("items.productId");

    if (!cart) {
      cart = await Cart.create({
        userId: req.user._id,
        items: []
      });
    }

    res.json(cart);

  } catch (err) {
    console.error("Cart fetch error:", err);
    res.status(500).json({ error: "Failed to fetch cart" });
  }
});

/* =========================================================
   ADD ITEM TO CART
========================================================= */

router.post("/add", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json({ error: "Product not found" });

    if (product.stock < quantity)
      return res.status(400).json({ error: "Not enough stock" });

    let cart = await Cart.findOne({ userId: req.user._id });

    if (!cart) {
      cart = await Cart.create({
        userId: req.user._id,
        items: []
      });
    }

    const existing = cart.items.find(
      item => item.productId.toString() === productId
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    await cart.save();

    res.json(cart);

  } catch (err) {
    console.error("Cart add error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

/* =========================================================
   UPDATE ITEM QUANTITY
========================================================= */

router.put("/update", auth, async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart)
      return res.status(404).json({ error: "Cart not found" });

    const item = cart.items.find(
      i => i.productId.toString() === productId
    );

    if (!item)
      return res.status(404).json({ error: "Item not found" });

    if (quantity <= 0) {
      cart.items = cart.items.filter(
        i => i.productId.toString() !== productId
      );
    } else {
      item.quantity = quantity;
    }

    await cart.save();

    res.json(cart);

  } catch (err) {
    console.error("Cart update error:", err);
    res.status(500).json({ error: "Failed to update cart" });
  }
});

/* =========================================================
   REMOVE ITEM
========================================================= */

router.delete("/remove/:productId", auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });

    if (!cart)
      return res.status(404).json({ error: "Cart not found" });

    cart.items = cart.items.filter(
      item => item.productId.toString() !== req.params.productId
    );

    await cart.save();

    res.json(cart);

  } catch (err) {
    console.error("Cart remove error:", err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

/* =========================================================
   CLEAR CART (used on logout)
========================================================= */

router.delete("/clear", auth, async (req, res) => {
  try {
    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { items: [] }
    );

    res.json({ message: "Cart cleared" });

  } catch (err) {
    console.error("Cart clear error:", err);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

module.exports = router;