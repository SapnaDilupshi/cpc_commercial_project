const nodemailer = require('nodemailer');
const { poolPromise, sql } = require("../config/db");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendStatusUpdateEmail = async (officerEmail, companyName, newStatus, remarks) => {
  try {
    const mailOptions = {
      from: `"Ceylon Petroleum Corporation" <${process.env.EMAIL_USER}>`,
      to: officerEmail,
      subject: `Application Status Update - ${companyName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
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
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: white;
              padding: 20px;
              border-radius: 0 0 8px 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .status {
              font-weight: bold;
              color: #C41E3A;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Application Status Update</h2>
            </div>
            <div class="content">
              <p>Dear Officer,</p>
              <p>The status of the application for <strong>${companyName}</strong> has been updated.</p>
              <p>New Status: <span class="status">${newStatus}</span></p>
              ${remarks ? `<p>Remarks: ${remarks}</p>` : ''}
              <p>Please log in to the CPC Portal for more details.</p>
              <br>
              <p>Best regards,<br>Ceylon Petroleum Corporation</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✉️ Status update email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Error sending status update email:', error);
    return false;
  }
};

// Function to get officer email from application ID
const getOfficerEmail = async (applicationId) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ApplicationID', sql.Int, applicationId)
      .query(`
        SELECT o.Email, c.CompanyName
        FROM Applications a
        JOIN Companies c ON a.CompanyID = c.CompanyID
        JOIN Officers o ON a.SubmittedBy = o.OfficerID
        WHERE a.ApplicationID = @ApplicationID
      `);

    if (result.recordset.length > 0) {
      return {
        email: result.recordset[0].Email,
        companyName: result.recordset[0].CompanyName
      };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting officer email:', error);
    return null;
  }
};

module.exports = {
  sendStatusUpdateEmail,
  getOfficerEmail
};