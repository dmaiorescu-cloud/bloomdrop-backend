const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  email: String,
  city: String,
  items: Array,
  total: Number,
  deliveryFee: Number,
  finalTotal: Number,
  status: {
    type: String,
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Order", OrderSchema);