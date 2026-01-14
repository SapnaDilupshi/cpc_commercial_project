const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send registration success email to officer
const sendRegistrationSuccessEmail = async (officerData, companyData, registrationNumber) => {
  try {
    const mailOptions = {
      from: `"Ceylon Petroleum Corporation" <${process.env.EMAIL_USER}>`,
      to: officerData.email,
      subject: 'Registration Successful - CPC Portal',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background: linear-gradient(135deg, #C41E3A 0%, #8B1528 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .info-box {
              background: #f0f7ff;
              padding: 15px;
              border-left: 4px solid #C41E3A;
              margin: 20px 0;
            }
            .info-box h3 {
              margin-top: 0;
              color: #C41E3A;
            }
            .info-item {
              padding: 8px 0;
              border-bottom: 1px solid #e0e0e0;
              display: flex;
              justify-content: space-between;
            }
            .info-item:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: bold;
              color: #C41E3A;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 12px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #C41E3A;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            ol {
              padding-left: 20px;
            }
            ol li {
              margin: 8px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Registration Successful!</h1>
              <p>Welcome to Ceylon Petroleum Corporation Portal</p>
            </div>
            <div class="content">
              <p>Dear <strong>${officerData.fullName}</strong>,</p>
              
              <p>Your company registration has been successfully submitted to the Ceylon Petroleum Corporation Portal.</p>
              
              <div class="info-box">
                <h3>Registration Details</h3>
                <div class="info-item">
                  <span class="info-label">Registration Number:</span>
                  <span><strong>${registrationNumber}</strong></span>
                </div>
                <div class="info-item">
                  <span class="info-label">Company Name:</span>
                  <span>${companyData.companyName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Country:</span>
                  <span>${companyData.country}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Registration Date:</span>
                  <span>${new Date().toLocaleDateString('en-GB')}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Officer Name:</span>
                  <span>${officerData.fullName}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Officer Email:</span>
                  <span>${officerData.email}</span>
                </div>
              </div>

              <h3>Next Steps:</h3>
              <ol>
                <li>Your application is now under review by our admin team</li>
                <li>You will receive updates on your registered email</li>
                <li>You can track your application status by logging into the portal</li>
                <li>Please keep your registration number for future reference</li>
              </ol>

              <center>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/officer/login" class="button">
                  Login to Portal
                </a>
              </center>

              <p style="margin-top: 30px;">If you have any questions, please contact us at:</p>
              <p>
                📧 Email: support@cpc.lk<br>
                📞 Phone: +94 11 2 123456
              </p>

              <p style="margin-top: 20px;">
                Best regards,<br>
                <strong>Ceylon Petroleum Corporation</strong><br>
                Registration Department
              </p>
            </div>
            <div class="footer">
              <p>This is an automated email from CPC Portal. Please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Ceylon Petroleum Corporation. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Registration email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Verify email configuration
const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('⚠️ Email service not configured:', error.message);
    console.log('ℹ️  Add email configuration to .env file to enable email notifications');
    return false;
  }
};

module.exports = {
  sendRegistrationSuccessEmail,
  verifyEmailConfig
};