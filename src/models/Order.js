// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  email: { type: String, required: true },
  city: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  finalTotal: { type: Number, required: true },
  status: { type: String, default: "pending" }
}, { timestamps: true });

// Add pre-save logging
orderSchema.pre('save', function (next) {
  console.log(`Creating order for ${this.email}, total: $${this.finalTotal}`);
  next();
});

// Add post-find logging
orderSchema.post('find', function (docs) {
  console.log(`Fetched ${docs.length} orders from database`);
});

// Add post-update logging
orderSchema.post('findOneAndUpdate', function (doc) {
  if (doc) {
    console.log(`Updated order ${doc._id}, new status: ${doc.status}`);
  } else {
    console.log(`Order update attempted but document not found`);
  }
});

// Add post-save logging for errors
orderSchema.post('save', function (doc, next) {
  console.log(`Order saved successfully: ${doc._id}`);
  next();
});

module.exports = mongoose.model("Order", orderSchema);