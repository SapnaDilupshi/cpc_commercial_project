const { poolPromise, sql } = require("../config/db");

// Submit a new application
const submitApplication = async (req, res) => {
  try {
    const { companyId, registrationNumber, applicationType, submittedBy } = req.body;
    const pool = await poolPromise;

    const result = await pool.request()
      .input("CompanyID", sql.Int, companyId)
      .input("RegistrationNumber", sql.NVarChar, registrationNumber)
      .input("ApplicationType", sql.NVarChar, applicationType)
      .input("SubmittedBy", sql.NVarChar, submittedBy)
      .query(`
        INSERT INTO Applications (CompanyID, RegistrationNumber, ApplicationType, SubmittedBy, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@CompanyID, @RegistrationNumber, @ApplicationType, @SubmittedBy, SYSUTCDATETIME())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("❌ DB Error (submitApplication):", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Get all applications
const getApplications = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT a.ApplicationID, a.RegistrationNumber, a.ApplicationType, a.SubmittedBy, a.CreatedAt,
             c.CompanyID, c.CompanyName
      FROM Applications a
      JOIN Companies c ON a.CompanyID = c.CompanyID
      ORDER BY a.CreatedAt DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ DB Error (getApplications):", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

module.exports = { submitApplication, getApplications };
