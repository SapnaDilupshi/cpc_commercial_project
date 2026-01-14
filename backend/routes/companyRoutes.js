const express = require("express");
const { createCompany, getCompanies } = require("../controllers/companyController");

const router = express.Router();

// GET /api/companies → list all companies
router.get("/", getCompanies);

// POST /api/companies → create new company
router.post("/", createCompany);

module.exports = router;
