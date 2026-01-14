// scripts/seed.js
const { poolPromise, sql } = require("../config/db");
const bcrypt = require("bcryptjs");

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seeding...");
    const pool = await poolPromise;

    // 1. Create default admin user
    console.log("👤 Creating default admin user...");
    const adminPassword = await bcrypt.hash("admin123", 12);
    
    const adminResult = await pool.request()
      .input("username", sql.NVarChar, "admin")
      .input("password", sql.NVarChar, adminPassword)
      .input("fullName", sql.NVarChar, "System Administrator")
      .input("role", sql.NVarChar, "Admin")
      .query(`
        IF NOT EXISTS (SELECT 1 FROM AdminUsers WHERE Username = @username)
        BEGIN
          INSERT INTO AdminUsers (Username, PasswordHash, FullName, Role, IsActive)
          VALUES (@username, @password, @fullName, @role, 1)
          SELECT 'CREATED' as Status
        END
        ELSE
        BEGIN
          SELECT 'EXISTS' as Status
        END
      `);

    if (adminResult.recordset[0]?.Status === 'CREATED') {
      console.log("✅ Admin user created: username=admin, password=admin123");
    } else {
      console.log("ℹ️ Admin user already exists");
    }

    // 2. Create registration officer user
    console.log("👤 Creating registration officer...");
    const regPassword = await bcrypt.hash("reg123", 12);
    
    await pool.request()
      .input("username", sql.NVarChar, "registration")
      .input("password", sql.NVarChar, regPassword)
      .input("fullName", sql.NVarChar, "Registration Officer")
      .input("role", sql.NVarChar, "Registration")
      .query(`
        IF NOT EXISTS (SELECT 1 FROM AdminUsers WHERE Username = @username)
        BEGIN
          INSERT INTO AdminUsers (Username, PasswordHash, FullName, Role, IsActive)
          VALUES (@username, @password, @fullName, @role, 1)
          PRINT 'Registration officer created'
        END
      `);

    // 3. Create sample company and application for testing
    console.log("🏢 Creating sample test data...");
    
    // Check if sample company exists
    const companyCheck = await pool.request()
      .input("companyName", sql.NVarChar, "Sample Petroleum Company")
      .query("SELECT CompanyID FROM Companies WHERE CompanyName = @companyName");

    let companyID;
    if (companyCheck.recordset.length === 0) {
      // Create sample company
      const companyResult = await pool.request()
        .input("companyName", sql.NVarChar, "Sample Petroleum Company")
        .input("country", sql.NVarChar, "Sri Lanka")
        .query(`
          INSERT INTO Companies (CompanyName, Country, CreatedAt)
          OUTPUT INSERTED.CompanyID
          VALUES (@companyName, @country, SYSUTCDATETIME())
        `);
      companyID = companyResult.recordset[0].CompanyID;
      console.log("✅ Sample company created");
    } else {
      companyID = companyCheck.recordset[0].CompanyID;
      console.log("ℹ️ Sample company already exists");
    }

    // Check if sample application exists
    const appCheck = await pool.request()
      .input("companyID", sql.Int, companyID)
      .query("SELECT ApplicationID FROM Applications WHERE CompanyID = @companyID");

    if (appCheck.recordset.length === 0) {
      // Create sample application
      const appResult = await pool.request()
        .input("companyID", sql.Int, companyID)
        .input("submissionMethod", sql.NVarChar, "Hard Copy")
        .query(`
          INSERT INTO Applications (CompanyID, SubmissionMethod, StatusID, CreatedAt)
          OUTPUT INSERTED.ApplicationID
          VALUES (@companyID, @submissionMethod, 1, SYSUTCDATETIME())
        `);

      const applicationID = appResult.recordset[0].ApplicationID;
      // seed registration number using year-based 4-digit sequence
      const now = new Date();
      const year = now.getFullYear();
      const countRes = await pool.request()
        .input("Year", sql.Int, year)
        .query(`SELECT COUNT(*) AS cnt FROM Applications WHERE YEAR(CreatedAt) = @Year`);
      const sequence = (countRes.recordset[0].cnt || 0);
      const seqPadded = sequence.toString().padStart(4, '0');
      const registrationNumber = `CPC/COM/REG/${year}/${seqPadded}`;

      // Update application with registration number
      await pool.request()
        .input("applicationID", sql.Int, applicationID)
        .input("regNumber", sql.NVarChar, registrationNumber)
        .query(`
          UPDATE Applications 
          SET RegistrationNumber = @RegNumber, UpdatedAt = SYSUTCDATETIME()
          WHERE ApplicationID = @ApplicationID
        `);

      // Create sample officer
      await pool.request()
        .input("companyID", sql.Int, companyID)
        .input("fullName", sql.NVarChar, "John Doe")
        .input("jobTitle", sql.NVarChar, "General Manager")
        .input("email", sql.NVarChar, "john.doe@samplecompany.com")
        .input("mobile", sql.NVarChar, "0771234567")
        .input("nationalID", sql.NVarChar, "123456789V")
        .query(`
          INSERT INTO Officers (CompanyID, FullName, JobTitle, Email, Mobile, NationalID, IsActive, CreatedAt)
          VALUES (@companyID, @fullName, @jobTitle, @email, @mobile, @nationalID, 1, SYSUTCDATETIME())
        `);

      console.log(`✅ Sample application created with Registration Number: ${registrationNumber}`);
      console.log("✅ Sample officer created: John Doe");
    } else {
      console.log("ℹ️ Sample application already exists");
    }

    // 4. Display summary
    console.log("\n📊 Database Summary:");
    
    const stats = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM AdminUsers) as AdminUsers,
        (SELECT COUNT(*) FROM Companies) as Companies,
        (SELECT COUNT(*) FROM Applications) as Applications,
        (SELECT COUNT(*) FROM Officers) as Officers,
        (SELECT COUNT(*) FROM StatusMaster) as StatusTypes
    `);

    const summary = stats.recordset[0];
    console.log(`👥 Admin Users: ${summary.AdminUsers}`);
    console.log(`🏢 Companies: ${summary.Companies}`);
    console.log(`📄 Applications: ${summary.Applications}`);
    console.log(`👤 Officers: ${summary.Officers}`);
    console.log(`📊 Status Types: ${summary.StatusTypes}`);

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n🔑 Login Credentials:");
    console.log("Admin: username=admin, password=admin123");
    console.log("Registration Officer: username=registration, password=reg123");

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("✅ Seeding process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding process failed:", error);
      process.exit(1);
    });
}

module.exports = seedDatabase;