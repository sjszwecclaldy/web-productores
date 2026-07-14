const crypto = require('crypto');

function generateActivationCode() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

const ACTIVATION_EXPIRY_DAYS = 45;

function activationExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + ACTIVATION_EXPIRY_DAYS);
  return d;
}

module.exports = {
  generateActivationCode,
  generateResetToken,
  activationExpiryDate,
  ACTIVATION_EXPIRY_DAYS,
};
