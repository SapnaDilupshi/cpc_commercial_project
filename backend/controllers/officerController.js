const { poolPromise, sql } = require("../config/db");

// Create new officer
const createOfficer = async (req, res) => {
  try {
    const { CompanyID, FullName, JobTitle, Email, Mobile, NationalID } = req.body;

    // Validate required fields
    if (!CompanyID || !FullName || !Email || !Mobile) {
      return res.status(400).json({ 
        error: "CompanyID, FullName, Email, and Mobile are required" 
      });
    }

    const pool = await poolPromise;

    // First verify if the company exists
    const companyCheck = await pool.request()
      .input("CompanyID", sql.Int, CompanyID)
      .query("SELECT CompanyID FROM Companies WHERE CompanyID = @CompanyID");

    if (companyCheck.recordset.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Create the officer
    const result = await pool.request()
      .input("CompanyID", sql.Int, CompanyID)
      .input("FullName", sql.NVarChar(200), FullName)
      .input("JobTitle", sql.NVarChar(100), JobTitle || null)
      .input("Email", sql.NVarChar(200), Email)
      .input("Mobile", sql.NVarChar(50), Mobile)
      .input("NationalID", sql.NVarChar(100), NationalID || null)
      .query(`
        INSERT INTO Officers (CompanyID, FullName, JobTitle, Email, Mobile, NationalID, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@CompanyID, @FullName, @JobTitle, @Email, @Mobile, @NationalID, SYSUTCDATETIME())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("❌ DB Error (createOfficer):", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Get all officers
const getOfficers = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT o.*, c.CompanyName
      FROM Officers o
      JOIN Companies c ON o.CompanyID = c.CompanyID
      ORDER BY o.CreatedAt DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ DB Error (getOfficers):", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

module.exports = {
  createOfficer,
  getOfficers
};
