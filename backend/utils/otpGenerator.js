// utils/otpGenerator.js
const crypto = require("crypto");

const generateOTP = () => {
  // Generate a secure 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const hashOTP = (otp) => {
  // Hash the OTP using SHA256
  return crypto.createHash('sha256').update(otp).digest('hex');
};

const verifyOTP = (inputOTP, hashedOTP) => {
  // Hash the input OTP and compare with stored hash
  const inputHash = crypto.createHash('sha256').update(inputOTP).digest('hex');
  return inputHash === hashedOTP;
};

module.exports = { generateOTP, hashOTP, verifyOTP };