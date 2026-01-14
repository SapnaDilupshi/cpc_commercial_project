const express = require("express");
const { submitApplication, getApplications } = require("../controllers/applicationController");

const router = express.Router();

// POST /api/applications/submit → submit new application
router.post("/submit", submitApplication);

// GET /api/applications → fetch all applications
router.get("/", getApplications);

module.exports = router;
