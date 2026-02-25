const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    city: { type: String, required: true },
    products: [
      {
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,      // ✅ SNAPSHOT PRICE
        quantity: Number
      }
    ],
    finalTotal: Number,
    status: { type: String, default: "pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);