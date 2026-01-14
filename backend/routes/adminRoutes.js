// backend/routes/adminRoutes.js - WITH MANUAL REGISTRATION
const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/authMiddleware");
const { poolPromise, sql } = require("../config/db");

// Import controller functions
const {
  adminLogin,
  getDashboardStats,
  getAllApplications,
  updateStatus,
  getApplicationById,
  getApplicationHistory,
  manageOfficer,
  getActivityLogs,
  createRegistrationNumber  // ✅ New function
} = require("../controllers/adminController");

// Auth routes
router.post("/login", adminLogin);

// Dashboard stats
router.get("/dashboard/stats", protectAdmin, getDashboardStats);

// ✅ NEW: Manual registration creation
router.post("/create-registration", protectAdmin, createRegistrationNumber);

// Applications routes
router.get("/applications", protectAdmin, getAllApplications);
router.get("/applications/:appId", protectAdmin, getApplicationById);
router.get("/applications/:appId/history", protectAdmin, getApplicationHistory);
router.put("/applications/:appId/status", protectAdmin, updateStatus);

// Get All Status Options
router.get("/statuses", protectAdmin, async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .query("SELECT StatusID, StatusName, StatusDescription FROM StatusMaster ORDER BY StatusID");

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("Get statuses error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statuses",
    });
  }
});

// Search Applications
router.get("/applications/search/:regNumber", protectAdmin, async (req, res) => {
  try {
    const { regNumber } = req.params;

    if (!regNumber || regNumber.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Registration number must be at least 3 characters",
      });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("regNumber", sql.VarChar, `%${regNumber}%`)
      .query(`
        SELECT 
          a.ApplicationID,
          a.RegistrationNumber,
          a.CreatedAt,
          a.UpdatedAt,
          a.Remarks,
          c.CompanyID,
          c.CompanyName,
          o.OfficerID,
          o.FullName AS OfficerName,
          o.Email AS OfficerEmail,
          o.Mobile AS OfficerMobile,
          s.StatusID,
          s.StatusName,
          s.StatusDescription
        FROM Applications a
        INNER JOIN Companies c ON a.CompanyID = c.CompanyID
        INNER JOIN StatusMaster s ON a.StatusID = s.StatusID
        LEFT JOIN Officers o ON c.CompanyID = o.CompanyID
        WHERE a.RegistrationNumber LIKE @regNumber
        ORDER BY a.CreatedAt DESC
      `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (err) {
    console.error("Search applications error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to search applications",
    });
  }
});

// Manage officer
router.post("/officers/manage", protectAdmin, manageOfficer);

// Activity logs
router.get("/activity-logs", protectAdmin, getActivityLogs);

module.exports = router;