// backend/controllers/adminController.js - WITH NEW APPLICATION FLAG
const { poolPromise, sql } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Helper function for activity logging
const logActivity = async (pool, adminId, activityType, description) => {
  try {
    await pool.request()
      .input("AdminID", sql.Int, adminId)
      .input("ActivityType", sql.NVarChar, activityType)
      .input("Description", sql.NVarChar, description)
      .query(`
        INSERT INTO ActivityLogs (AdminID, ActivityType, Description, CreatedAt)
        VALUES (@AdminID, @ActivityType, @Description, SYSUTCDATETIME())
      `);
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`\n🔐 Admin login attempt for: ${username}`);

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("username", sql.NVarChar, username)
      .query("SELECT * FROM AdminUsers WHERE Username = @username AND IsActive = 1");

    if (result.recordset.length === 0) {
      await logActivity(pool, null, 'LOGIN_FAILED', `Failed login attempt for username: ${username}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    
    if (!isMatch) {
      await logActivity(pool, user.UserID, 'LOGIN_FAILED', `Failed login attempt for user: ${username}`);
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    await logActivity(pool, user.UserID, 'LOGIN_SUCCESS', `Admin login successful`);
    const token = jwt.sign({ id: user.UserID, username: user.Username, role: user.Role }, process.env.JWT_SECRET, { expiresIn: "8h" });

    console.log(`✅ Login successful for: ${username}\n`);
    res.json({ 
      success: true,
      message: "Login successful",
      data: { token, admin: { id: user.UserID, username: user.Username, fullName: user.FullName, role: user.Role } }
    });
  } catch (err) {
    console.error("❌ Admin login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ success: false, message: "Username, password, and full name are required" });
    }

    const pool = await poolPromise;
    const existing = await pool.request()
      .input("username", sql.NVarChar, username)
      .query("SELECT UserID FROM AdminUsers WHERE Username = @username");

    if (existing.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Username already exists" });
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.request()
      .input("username", sql.NVarChar, username)
      .input("hash", sql.NVarChar, hash)
      .input("fullName", sql.NVarChar, fullName)
      .input("role", sql.NVarChar, role || "Registration")
      .query(`INSERT INTO AdminUsers (Username, PasswordHash, FullName, Role, IsActive) VALUES (@username, @hash, @fullName, @role, 1)`);

    await logActivity(pool, req.user.id, 'ADMIN_CREATED', `Created new admin user: ${username}`);
    res.json({ success: true, message: "Admin user created successfully" });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const createRegistrationNumber = async (req, res) => {
  try {
    const { registrationNumber, companyName, officerName, officerEmail, officerMobile } = req.body;

    console.log('📝 Manual registration creation:', { registrationNumber, companyName, officerName });

    if (!registrationNumber || !companyName || !officerName || !officerEmail || !officerMobile) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const pool = await poolPromise;

    const existingReg = await pool.request()
      .input("regNumber", sql.NVarChar, registrationNumber)
      .query("SELECT RegistrationNumber FROM Applications WHERE RegistrationNumber = @regNumber");

    if (existingReg.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Registration number already exists" });
    }

    const existingEmail = await pool.request()
      .input("email", sql.NVarChar, officerEmail)
      .query("SELECT Email FROM Officers WHERE Email = @email");

    if (existingEmail.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const companyResult = await pool.request()
      .input("companyName", sql.NVarChar, companyName)
      .query(`INSERT INTO Companies (CompanyName, CreatedAt) OUTPUT INSERTED.CompanyID VALUES (@companyName, SYSUTCDATETIME())`);

    const companyId = companyResult.recordset[0].CompanyID;

    const officerResult = await pool.request()
      .input("companyId", sql.Int, companyId)
      .input("fullName", sql.NVarChar, officerName)
      .input("email", sql.NVarChar, officerEmail)
      .input("mobile", sql.NVarChar, officerMobile)
      .query(`INSERT INTO Officers (CompanyID, FullName, Email, Mobile, CreatedAt) OUTPUT INSERTED.OfficerID VALUES (@companyId, @fullName, @email, @mobile, SYSUTCDATETIME())`);

    const statusResult = await pool.request()
      .query("SELECT StatusID FROM StatusMaster WHERE StatusName = 'Application Received'");

    const statusId = statusResult.recordset[0].StatusID;

    await pool.request()
      .input("companyId", sql.Int, companyId)
      .input("statusId", sql.Int, statusId)
      .input("registrationNumber", sql.NVarChar, registrationNumber)
      .input("submissionMethod", sql.NVarChar, 'Manual')
      .query(`INSERT INTO Applications (CompanyID, StatusID, RegistrationNumber, SubmissionMethod, CreatedAt) VALUES (@companyId, @statusId, @registrationNumber, @submissionMethod, SYSUTCDATETIME())`);

    await logActivity(pool, req.user.id, 'REGISTRATION_CREATED', `Manually created registration: ${registrationNumber} for ${companyName}`);

    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('new_application', {
        type: 'new_application',
        registrationNumber,
        companyName,
        message: `New registration created: ${registrationNumber}`,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: "Registration created successfully", data: { registrationNumber, companyName, officerEmail } });
  } catch (err) {
    console.error('❌ Create registration error:', err);
    res.status(500).json({ success: false, message: "Failed to create registration", error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};

// ✅ UPDATED: Mark "Application Received" as NEW if never updated
const getAllApplications = async (req, res) => {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;
    const pool = await poolPromise;
    
    let query = `
      SELECT 
        a.ApplicationID, 
        a.RegistrationNumber, 
        a.SubmissionMethod, 
        a.CreatedAt, 
        a.UpdatedAt, 
        a.Remarks, 
        c.CompanyName, 
        c.Country, 
        s.StatusName AS CurrentStatus, 
        o.FullName AS OfficerName, 
        o.Email AS OfficerEmail, 
        o.Mobile AS OfficerMobile, 
        au.FullName AS UpdatedByAdmin,
        CASE 
          WHEN s.StatusName = 'Application Received' AND a.UpdatedByAdminID IS NULL 
          THEN 1 
          ELSE 0 
        END AS IsNew
      FROM Applications a 
      JOIN Companies c ON a.CompanyID = c.CompanyID 
      JOIN StatusMaster s ON a.StatusID = s.StatusID 
      LEFT JOIN Officers o ON c.CompanyID = o.CompanyID 
      LEFT JOIN AdminUsers au ON a.UpdatedByAdminID = au.UserID 
      WHERE 1=1`;
    
    const request = pool.request();
    if (search) {
      query += ` AND (c.CompanyName LIKE @search OR a.RegistrationNumber LIKE @search OR o.FullName LIKE @search)`;
      request.input("search", sql.NVarChar, `%${search}%`);
    }
    if (status) {
      query += ` AND s.StatusName = @status`;
      request.input("status", sql.NVarChar, status);
    }
    query += ` ORDER BY a.CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    request.input("limit", sql.Int, parseInt(limit));
    request.input("offset", sql.Int, parseInt(offset));

    const result = await request.query(query);
    
    let countQuery = `SELECT COUNT(*) as total FROM Applications a JOIN Companies c ON a.CompanyID = c.CompanyID JOIN StatusMaster s ON a.StatusID = s.StatusID LEFT JOIN Officers o ON c.CompanyID = o.CompanyID WHERE 1=1`;
    
    const countRequest = pool.request();
    if (search) {
      countQuery += ` AND (c.CompanyName LIKE @search OR a.RegistrationNumber LIKE @search OR o.FullName LIKE @search)`;
      countRequest.input("search", sql.NVarChar, `%${search}%`);
    }
    if (status) {
      countQuery += ` AND s.StatusName = @status`;
      countRequest.input("status", sql.NVarChar, status);
    }
    const countResult = await countRequest.query(countQuery);

    res.json({ 
      success: true, 
      data: result.recordset, 
      pagination: { 
        total: countResult.recordset[0].total, 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      } 
    });
  } catch (err) {
    console.error("Get applications error:", err);
    res.status(500).json({ success: false, message: "Server error", error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { appId } = req.params;
    const { newStatus, remarks } = req.body;
    const adminId = req.user.id;

    if (!newStatus) return res.status(400).json({ success: false, message: "New status is required" });

    const pool = await poolPromise;
    const currentApp = await pool.request()
      .input("ApplicationID", sql.Int, parseInt(appId))
      .query(`SELECT a.*, c.CompanyName, o.FullName, o.Email, s.StatusName as CurrentStatus FROM Applications a JOIN Companies c ON a.CompanyID = c.CompanyID JOIN Officers o ON c.CompanyID = o.CompanyID JOIN StatusMaster s ON a.StatusID = s.StatusID WHERE a.ApplicationID = @ApplicationID`);

    if (currentApp.recordset.length === 0) return res.status(404).json({ success: false, message: "Application not found" });

    const application = currentApp.recordset[0];
    const statusResult = await pool.request().input("StatusName", sql.NVarChar, newStatus).query("SELECT StatusID FROM StatusMaster WHERE StatusName = @StatusName");
    
    if (statusResult.recordset.length === 0) return res.status(400).json({ success: false, message: "Invalid status name" });
    
    const statusId = statusResult.recordset[0].StatusID;
    
    // ✅ Update and mark as reviewed by admin
    await pool.request()
      .input("ApplicationID", sql.Int, parseInt(appId))
      .input("StatusID", sql.Int, statusId)
      .input("Remarks", sql.NVarChar, remarks || null)
      .input("UpdatedByAdminID", sql.Int, adminId)
      .query(`UPDATE Applications SET StatusID = @StatusID, Remarks = @Remarks, UpdatedAt = SYSUTCDATETIME(), UpdatedByAdminID = @UpdatedByAdminID WHERE ApplicationID = @ApplicationID`);

    await logActivity(pool, adminId, 'STATUS_UPDATE', `Updated application ${application.RegistrationNumber} status from ${application.CurrentStatus} to ${newStatus}`);

    const io = req.app.get('io');
    if (io) {
      io.to('admin-room').emit('application_status_changed', { 
        type: 'application_status_changed', 
        applicationId: application.ApplicationID, 
        registrationNumber: application.RegistrationNumber, 
        companyName: application.CompanyName, 
        previousStatus: application.CurrentStatus, 
        newStatus: newStatus, 
        message: `Application ${application.RegistrationNumber} status changed to ${newStatus}`, 
        timestamp: new Date().toISOString() 
      });
      console.log('✅ Socket.io notification sent');
    }

      // Send email notification to officer
      try {
        const { sendEmail } = require('../utils/sendEmail');
        if (application.Email) {
          const subject = `CPC Portal - Application Status Updated to ${newStatus}`;
          const htmlBody = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; }
                .header { background: #C41E3A; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .status { font-weight: bold; color: #C41E3A; font-size: 18px; }
                .remarks { margin: 15px 0; padding: 10px; background: #f5f5f5; border-left: 4px solid #C41E3A; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>Application Status Update</h2>
                </div>
                <div class="content">
                  <p>Dear ${application.FullName},</p>
                  <p>Your application for <strong>${application.CompanyName}</strong> has been updated.</p>
                  <p>New Status: <span class="status">${newStatus}</span></p>
                  ${remarks ? `<div class="remarks"><strong>Remarks:</strong><br>${remarks}</div>` : ''}
                  <p>Please log in to the CPC Portal to view more details.</p>
                  <p>Best regards,<br>Ceylon Petroleum Corporation</p>
                </div>
              </div>
            </body>
            </html>
          `;
          await sendEmail(application.Email, subject, htmlBody, true);
          console.log(`✅ Status update email sent to ${application.Email}`);
        } else {
          console.warn('⚠️ No email address found for the officer');
        }
      } catch (emailError) {
        console.error("❌ Failed to send status update email:", emailError);
        // Continue with status update even if email fails
      }

    res.json({ success: true, message: "Application status updated successfully" });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ success: false, message: "Server error", error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};

const getApplicationById = async (req, res) => {
  try {
    const { appId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request().input("ApplicationID", sql.Int, parseInt(appId)).query(`SELECT a.ApplicationID, a.RegistrationNumber, a.SubmissionMethod, a.CreatedAt, a.UpdatedAt, a.Remarks, c.CompanyName, c.Country, s.StatusName AS CurrentStatus, o.FullName AS OfficerName, o.Email AS OfficerEmail, o.Mobile AS OfficerMobile, au.FullName AS UpdatedByAdmin FROM Applications a JOIN Companies c ON a.CompanyID = c.CompanyID JOIN StatusMaster s ON a.StatusID = s.StatusID LEFT JOIN Officers o ON c.CompanyID = o.CompanyID LEFT JOIN AdminUsers au ON a.UpdatedByAdminID = au.UserID WHERE a.ApplicationID = @ApplicationID`);

    if (result.recordset.length === 0) return res.status(404).json({ success: false, message: "Application not found" });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("Get application error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getApplicationHistory = async (req, res) => {
  try {
    const { appId } = req.params;
    const pool = await poolPromise;
    const result = await pool.request().input("ApplicationID", sql.Int, parseInt(appId)).query(`SELECT h.HistoryID, ps.StatusName AS PreviousStatus, ns.StatusName AS NewStatus, h.Remarks, h.UpdatedAt, au.FullName AS UpdatedBy FROM ApplicationStatusHistory h LEFT JOIN StatusMaster ps ON h.PreviousStatusID = ps.StatusID JOIN StatusMaster ns ON h.NewStatusID = ns.StatusID JOIN AdminUsers au ON h.UpdatedByAdminID = au.UserID WHERE h.ApplicationID = @ApplicationID ORDER BY h.UpdatedAt DESC`);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ UPDATED: Dashboard stats - "New Applications" instead of "Application Received"
const getDashboardStats = async (req, res) => {
  try {
    const pool = await poolPromise;
    
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalApplications,
        
        -- New Applications = Application Received status that admin hasn't touched
        COUNT(CASE 
          WHEN s.StatusName = 'Application Received' AND a.UpdatedByAdminID IS NULL 
          THEN 1 
        END) as NewApplicationsCount,
        
        -- All Application Received (including admin-updated ones)
        COUNT(CASE WHEN s.StatusName = 'Application Received' THEN 1 END) as ApplicationReceivedCount,
        
        COUNT(CASE WHEN s.StatusName = 'Under Preliminary Review' THEN 1 END) as UnderPreliminaryReviewCount,
        COUNT(CASE WHEN s.StatusName = 'Not Eligible for Registration' THEN 1 END) as NotEligibleCount,
        COUNT(CASE WHEN s.StatusName = 'Under Committee Evaluation and Pending Feedback' THEN 1 END) as UnderCommitteeEvaluationCount,
        COUNT(CASE WHEN s.StatusName = 'Approved' THEN 1 END) as ApprovedApplications,
        COUNT(CASE WHEN s.StatusName = 'Rejected' THEN 1 END) as RejectedApplications,
        
        -- Pending = all except Approved and Rejected
        COUNT(CASE 
          WHEN s.StatusName NOT IN ('Approved', 'Rejected') 
          THEN 1 
        END) as PendingApplications
        
      FROM Applications a
      JOIN StatusMaster s ON a.StatusID = s.StatusID
    `);

    const stats = result.recordset[0];
    
    console.log('📊 Dashboard Stats:', {
      total: stats.TotalApplications,
      new: stats.NewApplicationsCount,
      pending: stats.PendingApplications,
      approved: stats.ApprovedApplications,
      rejected: stats.RejectedApplications
    });

    res.json({ success: true, data: stats });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
};

const manageOfficer = async (req, res) => {
  try {
    const { action, officerId, isActive } = req.body;
    const pool = await poolPromise;

    if (action === 'toggle_status') {
      await pool.request().input("OfficerID", sql.Int, officerId).input("IsActive", sql.Bit, isActive).query(`UPDATE Officers SET IsActive = @IsActive WHERE OfficerID = @OfficerID`);
      await logActivity(pool, req.user.id, 'OFFICER_STATUS_CHANGE', `${isActive ? 'Activated' : 'Deactivated'} officer ID: ${officerId}`);
      res.json({ success: true, message: `Officer ${isActive ? 'activated' : 'deactivated'} successfully` });
    } else {
      res.status(400).json({ success: false, message: "Invalid action" });
    }
  } catch (err) {
    console.error("Manage officer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getActivityLogs = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const pool = await poolPromise;
    const result = await pool.request().input("limit", sql.Int, parseInt(limit)).input("offset", sql.Int, parseInt(offset)).query(`SELECT al.*, au.FullName as AdminName, au.Username FROM ActivityLogs al LEFT JOIN AdminUsers au ON al.AdminID = au.UserID ORDER BY al.CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("Get activity logs error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { 
  adminLogin, 
  createAdmin, 
  getAllApplications,
  updateStatus, 
  getApplicationById,
  getApplicationHistory,
  getDashboardStats,
  manageOfficer,
  getActivityLogs,
  createRegistrationNumber
};