const express = require("express");
const { poolPromise, sql } = require("../config/db");

const router = express.Router();

// Officer can check application status
router.get("/:referenceNo", async (req, res) => {
  const { referenceNo } = req.params;
  try {
    const appId = parseInt(referenceNo.replace("APP-", ""), 10);

    const pool = await poolPromise;
    const result = await pool.request()
      .input("ApplicationID", sql.Int, appId)
      .query(`
        SELECT a.ApplicationID, a.RegistrationNumber, a.SubmissionMethod, a.CreatedAt, s.StatusName
        FROM Applications a
        LEFT JOIN ApplicationStatus s ON a.StatusID = s.StatusID
        WHERE a.ApplicationID = @ApplicationID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Invalid reference number" });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error("❌ Status check error:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
