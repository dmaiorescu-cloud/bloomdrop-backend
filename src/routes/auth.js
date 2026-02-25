const express = require("express");
const User = require("../models/User");
const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;