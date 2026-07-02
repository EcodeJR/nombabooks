const mongoose = require('mongoose');

const nombaSettingsSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      default: ''
    },
    clientSecret: {
      type: String,
      default: ''
    },
    accountId: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NombaSettings', nombaSettingsSchema);
