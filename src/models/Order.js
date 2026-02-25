const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    email: {
      type: String,
      required: true
    },

    city: {
      type: String,
      required: true
    },

    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product"
        },
        name: String,
        price: Number,
        quantity: Number
      }
    ],

    finalTotal: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);