const { poolPromise, sql } = require("../config/db");
const { sendOTPEmail } = require("../utils/sendEmail");
const { sendSMS } = require("../utils/sendSMS");
const jwt = require("jsonwebtoken");

// In-memory OTP storage
const otpStore = new Map();

// Clean expired OTPs every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (now > value.expiresAt) {
      otpStore.delete(key);
      console.log(`Expired OTP removed for: ${key}`);
    }
  }
}, 5 * 60 * 1000);

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Request OTP
const requestOTP = async (req, res) => {
  try {
    const { registrationNumber } = req.body;

    if (!registrationNumber) {
      return res.status(400).json({ 
        success: false, 
        message: "Registration number is required" 
      });
    }

    const pool = await poolPromise;

    const result = await pool.request()
      .input("RegNumber", sql.NVarChar, registrationNumber)
      .query(`
        SELECT a.ApplicationID, a.RegistrationNumber, c.CompanyName,
               o.OfficerID, o.Email, o.Mobile, o.FullName
        FROM Applications a
        JOIN Companies c ON a.CompanyID = c.CompanyID
        JOIN Officers o ON c.CompanyID = o.CompanyID
        WHERE a.RegistrationNumber = @RegNumber AND o.IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid registration number or officer not found" 
      });
    }

    const officer = result.recordset[0];
    const otp = generateOTP();

    // Store in memory (10-minute expiry)
    otpStore.set(registrationNumber, {
      otp: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      officerId: officer.OfficerID,
      applicationId: officer.ApplicationID
    });

    console.log(`OTP generated for ${registrationNumber}: ${otp}`);

    // Send OTP via Email and SMS
    try {
      const promises = [];
      
      if (officer.Mobile && officer.Mobile.startsWith("07")) {
        promises.push(
          sendSMS(officer.Mobile, `CPC Portal OTP: ${otp}. Valid for 10 minutes.`)
        );
      }
      
      promises.push(
        sendOTPEmail(officer.Email, officer.FullName, otp, registrationNumber)
      );
      
      await Promise.allSettled(promises);
    } catch (notificationError) {
      console.error("Notification error:", notificationError);
    }

    res.json({ 
      success: true, 
      message: "OTP sent successfully",
      data: {
        registrationNumber,
        companyName: officer.CompanyName,
        officerName: officer.FullName
      }
    });

  } catch (err) {
    console.error("Request OTP error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

// Verify OTP and Login
const verifyOTPAndLogin = async (req, res) => {
  try {
    const { registrationNumber, otp } = req.body;

    if (!registrationNumber || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Registration number and OTP are required" 
      });
    }

    const storedOTP = otpStore.get(registrationNumber);

    if (!storedOTP) {
      return res.status(400).json({ 
        success: false, 
        message: "No OTP found or OTP expired" 
      });
    }

    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(registrationNumber);
      return res.status(400).json({ 
        success: false, 
        message: "OTP has expired" 
      });
    }

    if (storedOTP.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OTP" 
      });
    }

    otpStore.delete(registrationNumber);

    const pool = await poolPromise;

    const officerResult = await pool.request()
      .input("ApplicationID", sql.Int, storedOTP.applicationId)
      .query(`
        SELECT a.ApplicationID, a.RegistrationNumber, c.CompanyName,
               o.OfficerID, o.FullName, o.Email, o.JobTitle,
               s.StatusName AS CurrentStatus
        FROM Applications a
        JOIN Companies c ON a.CompanyID = c.CompanyID
        JOIN Officers o ON c.CompanyID = o.CompanyID
        JOIN StatusMaster s ON a.StatusID = s.StatusID
        WHERE a.ApplicationID = @ApplicationID
      `);

    const officer = officerResult.recordset[0];

    await pool.request()
      .input("OfficerID", sql.Int, officer.OfficerID)
      .query("UPDATE Officers SET LastLoginAt = DATEADD(HOUR, 5, DATEADD(MINUTE, 30, SYSUTCDATETIME())) WHERE OfficerID = @OfficerID");

    const token = jwt.sign(
      { 
        officerID: officer.OfficerID,
        applicationID: officer.ApplicationID,
        registrationNumber: officer.RegistrationNumber,
        companyName: officer.CompanyName,
        role: "officer"
      },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    res.json({ 
      success: true, 
      message: "Login successful",
      data: {
        token,
        officer: {
          id: officer.OfficerID,
          name: officer.FullName,
          email: officer.Email,
          jobTitle: officer.JobTitle,
          registrationNumber: officer.RegistrationNumber,
          companyName: officer.CompanyName,
          currentStatus: officer.CurrentStatus
        }
      }
    });

  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const getApplicationStatus = async (req, res) => {
  try {
    const { applicationID } = req.user;

    const pool = await poolPromise;
    const result = await pool.request()
      .input("ApplicationID", sql.Int, applicationID)
      .query(`
        SELECT a.ApplicationID, a.RegistrationNumber, c.CompanyName,
               s.StatusName AS CurrentStatus, a.Remarks, 
               DATEADD(HOUR, 5, DATEADD(MINUTE, 30, a.CreatedAt)) AS CreatedAt,
               DATEADD(HOUR, 5, DATEADD(MINUTE, 30, a.UpdatedAt)) AS UpdatedAt,
               o.FullName AS OfficerName
        FROM Applications a
        JOIN Companies c ON a.CompanyID = c.CompanyID
        JOIN StatusMaster s ON a.StatusID = s.StatusID
        JOIN Officers o ON c.CompanyID = o.CompanyID
        WHERE a.ApplicationID = @ApplicationID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Application not found" 
      });
    }

    res.json({ 
      success: true, 
      data: result.recordset[0] 
    });

  } catch (err) {
    console.error("Get status error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

const getApplicationHistory = async (req, res) => {
  try {
    const { applicationID } = req.user;

    const pool = await poolPromise;
    const result = await pool.request()
      .input("ApplicationID", sql.Int, applicationID)
      .query(`
        SELECT h.HistoryID, 
               ps.StatusName AS PreviousStatus,
               ns.StatusName AS NewStatus,
               h.Remarks,
               DATEADD(HOUR, 5, DATEADD(MINUTE, 30, h.UpdatedAt)) AS UpdatedAt,
               au.FullName AS UpdatedBy
        FROM ApplicationStatusHistory h
        LEFT JOIN StatusMaster ps ON h.PreviousStatusID = ps.StatusID
        JOIN StatusMaster ns ON h.NewStatusID = ns.StatusID
        JOIN AdminUsers au ON h.UpdatedByAdminID = au.UserID
        WHERE h.ApplicationID = @ApplicationID
        ORDER BY h.UpdatedAt DESC
      `);

    res.json({ 
      success: true, 
      data: result.recordset 
    });

  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

module.exports = {
  requestOTP,
  verifyOTPAndLogin,
  getApplicationStatus,
  getApplicationHistory
};