const mongoose = require('mongoose');

const zohoTokenSchema = new mongoose.Schema(
  {
    accessToken: {
      type: String,
      required: true
    },
    refreshToken: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    organizationId: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Ensure only one document exists in the collection
zohoTokenSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('ZohoToken').countDocuments({});
    if (count >= 1) {
      // Delete existing document and let this one be inserted
      await mongoose.model('ZohoToken').deleteMany({});
    }
  }
  next();
});

module.exports = mongoose.model('ZohoToken', zohoTokenSchema);
