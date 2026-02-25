const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  stock: Number,
  images: [String] // multiple images
});

module.exports = mongoose.model("Product", ProductSchema);