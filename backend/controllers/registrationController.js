// backend/controllers/registrationController.js - ALWAYS NOTIFY
const { poolPromise, sql } = require("../config/db");
const { sendRegistrationConfirmationEmail } = require("../utils/sendEmail");

const submitRegistration = async (req, res) => {
  try {
    const { company, application, nomination } = req.body;

    console.log('\n📝 Registration submission started...');
    console.log('Company:', company?.companyName);
    console.log('Officer:', nomination?.fullName);

    if (!company?.companyName || !company?.country) {
      return res.status(400).json({ 
        success: false,         
        message: "Company name and country are required" 
      });
    }

    if (!nomination?.fullName || !nomination?.email || !nomination?.phone) {
      return res.status(400).json({ 
        success: false, 
        message: "Officer details are required" 
      });
    }

    const pool = await poolPromise;
    // Check for duplicate company name (case-insensitive)
    const existing = await pool.request()
      .input("CompanyName", sql.NVarChar(200), company.companyName.trim())
      .query(`
        SELECT CompanyID FROM Companies
        WHERE LOWER(LTRIM(RTRIM(CompanyName))) = LOWER(LTRIM(RTRIM(@CompanyName)))
      `);

    if (existing.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Company with this name already exists"
      });
    }
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Insert company
      const companyResult = await transaction.request()
        .input("CompanyName", sql.NVarChar(200), company.companyName.trim())
        .input("Country", sql.NVarChar(100), company.country.trim())
        .query(`
          INSERT INTO Companies (CompanyName, Country, CreatedAt)
          OUTPUT INSERTED.CompanyID
          VALUES (@CompanyName, @Country, SYSUTCDATETIME())
        `);

      const companyID = companyResult.recordset[0].CompanyID;

      // 2. Insert application
      const appResult = await transaction.request()
        .input("CompanyID", sql.Int, companyID)
        .input("SubmissionMethod", sql.NVarChar(50), "Online Portal")
        .query(`
          INSERT INTO Applications (CompanyID, SubmissionMethod, StatusID, CreatedAt)
          OUTPUT INSERTED.ApplicationID
          VALUES (@CompanyID, @SubmissionMethod, 1, SYSUTCDATETIME())
        `);

      const applicationID = appResult.recordset[0].ApplicationID;

      // 3. Generate registration number in format: CPC/COM/REG/<YEAR>/<SEQUENCE>
      // Sequence is the count of applications for the current year (including this one)
      const now = new Date();
      const year = now.getFullYear();

      const countRes = await transaction.request()
        .input("Year", sql.Int, year)
        .query(`SELECT COUNT(*) AS cnt FROM Applications WHERE YEAR(CreatedAt) = @Year`);

      const sequence = (countRes.recordset[0].cnt || 0);
      const seqPadded = sequence.toString().padStart(4, '0');
      const registrationNumber = `CPC/COM/REG/${year}/${seqPadded}`;

      await transaction.request()
        .input("ApplicationID", sql.Int, applicationID)
        .input("RegNumber", sql.NVarChar(50), registrationNumber)
        .query(`
          UPDATE Applications 
          SET RegistrationNumber = @RegNumber, UpdatedAt = SYSUTCDATETIME()
          WHERE ApplicationID = @ApplicationID
        `);

      // 4. Create officer
      await transaction.request()
        .input("CompanyID", sql.Int, companyID)
        .input("FullName", sql.NVarChar(200), nomination.fullName.trim())
        .input("JobTitle", sql.NVarChar(100), nomination.designation?.trim() || null)
        .input("Email", sql.NVarChar(200), nomination.email.trim().toLowerCase())
        .input("Mobile", sql.NVarChar(50), nomination.phone.trim())
        .input("NationalID", sql.NVarChar(100), nomination.nationalID?.trim() || null)
        .query(`
          INSERT INTO Officers (CompanyID, FullName, JobTitle, Email, Mobile, NationalID, IsActive, CreatedAt)
          VALUES (@CompanyID, @FullName, @JobTitle, @Email, @Mobile, @NationalID, 1, SYSUTCDATETIME())
        `);

      // Commit transaction
      await transaction.commit();
      console.log('✅ Database transaction committed');

      // 5. ✅ ALWAYS emit notification (real-time + global event)
      const io = req.app.get('io');
      if (io) {
        const adminRoom = io.sockets.adapter.rooms.get('admin-room');
        const adminCount = adminRoom ? adminRoom.size : 0;
        
        console.log(`\n🔔 Emitting notification...`);
        console.log(`👥 Admins currently online: ${adminCount}`);

        const notificationData = {
          type: 'NEW_REGISTRATION',
          registrationNumber: registrationNumber,
          companyName: company.companyName.trim(),
          country: company.country.trim(),
          officerName: nomination.fullName.trim(),
          officerEmail: nomination.email.trim().toLowerCase(),
          officerPhone: nomination.phone.trim(),
          timestamp: new Date().toISOString(),
          applicationID: applicationID
        };

        // Emit to online admins (real-time)
        if (adminCount > 0) {
          io.to('admin-room').emit('new-registration', notificationData);
          console.log('✅ Real-time notification sent to', adminCount, 'online admin(s)');
        }
        
        // ✅ ALWAYS emit global event (for offline storage)
        io.emit('new-registration-global', notificationData);
        console.log('✅ Global notification emitted (for offline admins)');
      }

      // 6. Send email to officer
      try {
        console.log('\n📧 Sending confirmation email...');
        await sendRegistrationConfirmationEmail(
          nomination.email.trim().toLowerCase(),
          nomination.fullName.trim(),
          registrationNumber,
          company.companyName.trim()
        );
        console.log('✅ Email sent');
      } catch (emailError) {
        console.error("❌ Email failed:", emailError);
      }

      console.log('\n✅ Registration completed successfully!\n');

      res.status(201).json({
        success: true,
        message: "Registration submitted successfully",
        data: {
          registrationNumber,
          companyName: company.companyName.trim(),
          applicationID
        }
      });

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (err) {
    console.error("❌ Registration error:", err);
    
    if (err.number === 2627) {
      return res.status(400).json({ 
        success: false, 
        message: "Company with this name already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to submit registration",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const getAllRegistrations = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT a.ApplicationID, a.RegistrationNumber, a.SubmissionMethod, a.CreatedAt, a.UpdatedAt,
             c.CompanyName, c.Country,
             s.StatusName AS CurrentStatus,
             o.FullName AS OfficerName, o.Email AS OfficerEmail, o.Mobile AS OfficerMobile
      FROM Applications a
      JOIN Companies c ON a.CompanyID = c.CompanyID
      JOIN StatusMaster s ON a.StatusID = s.StatusID
      LEFT JOIN Officers o ON c.CompanyID = o.CompanyID
      ORDER BY a.CreatedAt DESC
    `);

    res.json({ 
      success: true, 
      data: result.recordset 
    });
  } catch (err) {
    console.error("Get registrations error:", err);   
    res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};

module.exports = {
  submitRegistration,
  getAllRegistrations
};