const { poolPromise, sql } = require("../config/db");

// Create a new company
const createCompany = async (req, res) => {
  try {
    const { CompanyName, Country } = req.body;
    
    if (!CompanyName) {
      return res.status(400).json({ error: "Company Name is required" });
    }

    const pool = await poolPromise;

    const result = await pool.request()
      .input("CompanyName", sql.NVarChar(200), CompanyName)
      .input("Country", sql.NVarChar(100), Country)
      .query(`
        INSERT INTO Companies (CompanyName, Country, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@CompanyName, @Country, SYSUTCDATETIME())
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error("❌ DB Error (createCompany):", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

// Get all companies
const getCompanies = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT CompanyID, CompanyName, Country, CreatedAt
      FROM Companies
      ORDER BY CreatedAt DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("❌ DB Error (getCompanies):", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
};

module.exports = { createCompany, getCompanies };
