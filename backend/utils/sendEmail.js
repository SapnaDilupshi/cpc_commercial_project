// backend/utils/sendEmail.js - COMPLETE WITH BETTER REGISTRATION EMAIL
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, body, isHTML = false) => {
  try {
    const mailOptions = {
      from: {
        name: "Ceylon Petroleum Corporation",
        address: process.env.EMAIL_USER
      },
      to: to,
      subject: subject,
      ...(isHTML ? { html: body } : { text: body })
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

// OTP Email
const sendOTPEmail = async (to, name, otp, registrationNumber) => {
  const subject = "CPC Portal - OTP Verification";
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #c41e3a;">
      <div style="background-color: #c41e3a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Ceylon Petroleum Corporation</h1>
        <p style="color: white; margin: 5px 0;">Supplier Registration Portal</p>
      </div>
      
      <div style="padding: 30px 20px; background-color: #ffffff;">
        <h2 style="color: #c41e3a;">OTP Verification</h2>
        <p>Dear ${name},</p>
        
        <p>Your One-Time Password (OTP) for accessing the CPC Portal is:</p>
        
        <div style="background-color: #c41e3a; color: white; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; border-radius: 8px; margin: 20px 0; letter-spacing: 8px;">
          ${otp}
        </div>
        
        <p><strong>Registration Number:</strong> ${registrationNumber}</p>
        <p><strong>Valid for:</strong> 10 minutes</p>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
          <strong>Security Notice:</strong>
          <ul style="margin: 10px 0;">
            <li>Do not share this OTP with anyone</li>
            <li>CPC will never ask for your OTP via phone call</li>
            <li>If you did not request this OTP, please ignore this message</li>
          </ul>
        </div>
        
        <p>Best regards,<br>
        <strong>CPC Portal Team</strong><br>
        Ceylon Petroleum Corporation</p>
      </div>
      
      <div style="background-color: #9a1829; padding: 15px; text-align: center; color: white; font-size: 12px;">
        <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return await sendEmail(to, subject, htmlBody, true);
};

// ✅ NEW: IMPROVED Registration Confirmation Email - Officer ට යවන email
const sendRegistrationConfirmationEmail = async (to, name, registrationNumber, companyName) => {
  const portalUrl = process.env.PORTAL_URL || "http://localhost:3000";
  const subject = "🎉 CPC Portal - Registration Successful!";
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #c41e3a 0%, #9a1829 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">
                    🎉 Registration Successful!
                  </h1>
                  <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px;">
                    Welcome to Ceylon Petroleum Corporation Portal
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                    Dear <strong style="color: #c41e3a;">${name}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 25px 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                    Thank you for registering with the Ceylon Petroleum Corporation Supplier Portal. Your application has been successfully submitted and is now under review.
                  </p>
                  
                  <!-- Registration Details Box -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 12px; border-left: 4px solid #c41e3a; margin: 25px 0; overflow: hidden;">
                    <tr>
                      <td style="padding: 25px;">
                        <p style="margin: 0 0 15px 0; font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                          📋 Registration Details
                        </p>
                        
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(220, 38, 38, 0.2);">
                              <span style="color: #6b7280; font-size: 14px;">Company Name:</span>
                            </td>
                            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid rgba(220, 38, 38, 0.2);">
                              <strong style="color: #1f2937; font-size: 14px;">${companyName}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid rgba(220, 38, 38, 0.2);">
                              <span style="color: #6b7280; font-size: 14px;">Registration Number:</span>
                            </td>
                            <td style="padding: 10px 0; text-align: right; border-bottom: 1px solid rgba(220, 38, 38, 0.2);">
                              <strong style="color: #c41e3a; font-size: 18px; letter-spacing: 1px;">${registrationNumber}</strong>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0;">
                              <span style="color: #6b7280; font-size: 14px;">Nominated Officer:</span>
                            </td>
                            <td style="padding: 10px 0; text-align: right;">
                              <strong style="color: #1f2937; font-size: 14px;">${name}</strong>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Important Notice -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background: #fff3cd; border-radius: 10px; border-left: 4px solid #ffc107; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #856404; font-weight: 700;">
                          ⚠️ IMPORTANT: Save Your Registration Number
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.6;">
                          You will need your registration number <strong>${registrationNumber}</strong> to login and track your application status. Please save it securely.
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Next Steps -->
                  <h3 style="color: #c41e3a; font-size: 18px; margin: 30px 0 15px 0; font-weight: 700;">
                    📝 Next Steps:
                  </h3>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; vertical-align: top; width: 30px;">
                        <span style="display: inline-block; width: 24px; height: 24px; background: #c41e3a; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">1</span>
                      </td>
                      <td style="padding: 8px 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        Visit the <strong>Officer Login</strong> page
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; vertical-align: top;">
                        <span style="display: inline-block; width: 24px; height: 24px; background: #c41e3a; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">2</span>
                      </td>
                      <td style="padding: 8px 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        Enter your registration number: <strong style="color: #c41e3a;">${registrationNumber}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; vertical-align: top;">
                        <span style="display: inline-block; width: 24px; height: 24px; background: #c41e3a; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">3</span>
                      </td>
                      <td style="padding: 8px 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        Request an <strong>OTP</strong> (One-Time Password)
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; vertical-align: top;">
                        <span style="display: inline-block; width: 24px; height: 24px; background: #c41e3a; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">4</span>
                      </td>
                      <td style="padding: 8px 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        Enter the OTP sent to your email and mobile
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; vertical-align: top;">
                        <span style="display: inline-block; width: 24px; height: 24px; background: #c41e3a; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 700;">5</span>
                      </td>
                      <td style="padding: 8px 0; color: #1f2937; font-size: 14px; line-height: 1.6;">
                        Access your <strong>application status dashboard</strong>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Login Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${portalUrl}/officer/login" style="display: inline-block; background: linear-gradient(135deg, #c41e3a 0%, #9a1829 100%); color: white; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(196, 30, 58, 0.3);">
                          🔐 Login to Portal
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <!-- Help Section -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 10px; margin: 25px 0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1f2937; font-weight: 700;">
                          💡 Need Help?
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                          If you have any questions or need assistance, please contact our registration team.
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 0 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                    Best regards,<br>
                    <strong style="color: #c41e3a;">CPC Registration Team</strong><br>
                    <span style="color: #6b7280; font-size: 14px;">Ceylon Petroleum Corporation</span>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background: #9a1829; padding: 20px 30px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: rgba(255,255,255,0.9); font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                  </p>
                  <p style="margin: 0; color: rgba(255,255,255,0.7); font-size: 11px;">
                    © ${new Date().getFullYear()} Ceylon Petroleum Corporation. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return await sendEmail(to, subject, htmlBody, true);
};

// Other email functions remain the same...
const sendNominationConfirmationEmail = async (to, name, registrationNumber, companyName) => {
  const portalUrl = process.env.PORTAL_URL || "http://localhost:3000";
  const subject = "CPC Portal - Officer Nomination Successful";
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #c41e3a;">
      <div style="background-color: #c41e3a; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Ceylon Petroleum Corporation</h1>
        <p style="color: white; margin: 5px 0;">Supplier Registration Portal</p>
      </div>
      
      <div style="padding: 30px 20px; background-color: #ffffff;">
        <h2 style="color: #c41e3a;">Officer Nomination Confirmed</h2>
        <p>Dear ${name},</p>
        
        <p>Thank you for completing your officer nomination for the Ceylon Petroleum Corporation Supplier Portal.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Company:</strong> ${companyName}</p>
          <p style="margin: 10px 0;"><strong>Registration Number:</strong> <span style="color: #c41e3a; font-size: 18px; font-weight: bold;">${registrationNumber}</span></p>
          <p style="margin: 10px 0;"><strong>Nominated Officer:</strong> ${name}</p>
        </div>
        
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Visit the Officer Login page: <a href="${portalUrl}/officer/login" style="color: #c41e3a;">${portalUrl}/officer/login</a></li>
          <li>Enter your registration number: <strong>${registrationNumber}</strong></li>
          <li>Request an OTP (One-Time Password)</li>
          <li>Enter the OTP sent to your email and mobile</li>
          <li>Access your application status dashboard</li>
        </ol>
        
        <div style="background-color: #e8f5e9; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
          <strong>Important:</strong> 
          <ul style="margin: 10px 0;">
            <li>Keep your registration number secure</li>
            <li>You will receive an OTP each time you login</li>
            <li>OTPs are valid for 10 minutes only</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}/officer/login" style="background-color: #c41e3a; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Login to Portal
          </a>
        </div>
        
        <p>If you have any questions, please contact our registration team.</p>
        
        <p>Best regards,<br>
        <strong>CPC Registration Team</strong><br>
        Ceylon Petroleum Corporation</p>
      </div>
      
      <div style="background-color: #9a1829; padding: 15px; text-align: center; color: white; font-size: 12px;">
        <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;

  return await sendEmail(to, subject, htmlBody, true);
};

module.exports = { 
  sendEmail, 
  sendOTPEmail, 
  sendRegistrationConfirmationEmail,
  sendNominationConfirmationEmail
};