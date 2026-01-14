const nodemailer = require("nodemailer");
const axios = require("axios");

// Send email
const sendOfficerEmail = async (to, name, password, appRef) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const subject = "CPC Officer Registration";
  const text = `Hello ${name},\n\nYour account has been created.\nApplication Ref: ${appRef}\nPassword: ${password}\n\nPlease log in securely.`;

  await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
};

// Send SMS via Dialog
const sendSMS = async (phone, message) => {
  const API_URL = "https://cpsolutions.dialog.lk/index.php/cbs/sms/send";
  const PASSWORD = process.env.DIALOG_PASS;
  const SENDER_ID = "CEYPETCO";

  const destination = phone.startsWith("94") ? phone : `94${phone.replace(/^0/, "")}`;

  const response = await axios.get(API_URL, {
    params: { destination, q: PASSWORD, message, from: SENDER_ID },
  });

  return response.data === "0";
};

module.exports = { sendOfficerEmail, sendSMS };