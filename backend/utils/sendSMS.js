// utils/sendSMS.js (Updated with Dialog API)
const axios = require("axios");

const sendSMS = async (phoneNumber, message) => {
  try {
    // Format phone number for Sri Lankan local numbers
    let formattedNumber = phoneNumber;
    
    if (phoneNumber.startsWith("07")) {
      // Convert 07XXXXXXXX to 947XXXXXXXX
      formattedNumber = "94" + phoneNumber.substring(1);
    } else if (phoneNumber.startsWith("0")) {
      // Convert other 0XXXXXXXX to 94XXXXXXXX
      formattedNumber = "94" + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith("94")) {
      // If no country code, add 94
      formattedNumber = "94" + phoneNumber;
    }

    const API_URL = "https://cpsolutions.dialog.lk/index.php/cbs/sms/send";
    const PASSWORD = process.env.DIALOG_SMS_PASSWORD; // Add this to your .env
    const SENDER_ID = "CEYPETCO";

    const response = await axios.get(API_URL, {
      params: {
        destination: formattedNumber,
        q: PASSWORD,
        message: message,
        from: SENDER_ID
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.data === "0") {
      console.log(`✅ SMS sent successfully to ${formattedNumber}`);
      return { success: true, destination: formattedNumber };
    } else {
      console.error(`❌ SMS failed to ${formattedNumber}. Response:`, response.data);
      throw new Error(`SMS API returned: ${response.data}`);
    }

  } catch (error) {
    console.error(`❌ Failed to send SMS to ${phoneNumber}:`, error.message);
    throw error;
  }
};

// Send OTP via SMS
const sendOTPSMS = async (phoneNumber, otp, registrationNumber) => {
  const message = `CPC Portal: Your OTP is ${otp} for registration ${registrationNumber}. Valid for 10 minutes. Do not share with anyone.`;
  return await sendSMS(phoneNumber, message);
};

module.exports = { sendSMS, sendOTPSMS };