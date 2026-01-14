const { sendSMS } = require("../utils/sendSMS");
const { sendEmail } = require("../utils/sendEmail");
const { generateOTP, hashOTP } = require("../utils/otpGenerator");

// Send OTP via SMS
async function sendOtp(req, res) {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: "Phone number is required" 
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);

    // Send via SMS
    await sendSMS(phone, `Your OTP is ${otp}`);

    // In a real application, you would save the hashedOTP and its expiry
    // in the database associated with the phone number

    res.json({ 
      success: true, 
      message: "OTP sent successfully" 
    });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send OTP" 
    });
  }
}

module.exports = { sendOtp };
