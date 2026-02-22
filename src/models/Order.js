const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  city: { type: String, required: true },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      name: String,
      quantity: Number
    }
  ],
  finalTotal: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "delivered"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Order", OrderSchema);