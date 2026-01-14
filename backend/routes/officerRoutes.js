// routes/officerRoutes.js (Updated with all officer routes)
const express = require("express");
const { createOfficer, getOfficers } = require("../controllers/officerController");
const { 
  requestOTP, 
  verifyOTPAndLogin, 
  getApplicationStatus, 
  getApplicationHistory 
} = require("../controllers/officerAuthController");
const { protectAdmin, protectOfficer } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin routes (protected)
router.post("/", protectAdmin, createOfficer);
router.get("/", protectAdmin, getOfficers);

// Officer authentication routes (public)
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTPAndLogin);

// Officer protected routes
router.get("/status", protectOfficer, getApplicationStatus);
router.get("/history", protectOfficer, getApplicationHistory);

module.exports = router;