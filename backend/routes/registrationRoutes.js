// routes/registrationRoutes.js (Updated to use controller)
const express = require("express");
const { submitRegistration, getAllRegistrations } = require("../controllers/registrationController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Public route for registration submission
router.post("/submit", submitRegistration);
// Public route to check if a company name already exists (case-insensitive)
router.get("/check-company", async (req, res) => {
	try {
		const { name } = req.query;
		if (!name) return res.status(400).json({ success: false, message: "Company name is required" });

		const { poolPromise, sql } = require("../config/db");
		const pool = await poolPromise;
		const result = await pool.request()
			.input("CompanyName", sql.NVarChar(200), name.trim())
			.query(`
				SELECT CompanyID FROM Companies
				WHERE LOWER(LTRIM(RTRIM(CompanyName))) = LOWER(LTRIM(RTRIM(@CompanyName)))
			`);

		return res.json({ success: true, exists: result.recordset.length > 0 });
	} catch (err) {
		console.error("Check company error:", err);
		return res.status(500).json({ success: false, message: "Server error" });
	}
});

// Admin route to view all registrations
router.get("/", protectAdmin, getAllRegistrations);

module.exports = router;