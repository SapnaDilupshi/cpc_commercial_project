// backend/routes/exportRoutes.js - WITH STATUS BREAKDOWN
const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/authMiddleware");
const { poolPromise, sql } = require("../config/db");
const ExcelJS = require('exceljs');

// Export applications to Excel (Admin only)
router.get("/applications/excel", protectAdmin, async (req, res) => {
  try {
    console.log('📊 Starting Excel export...');
    console.log('User:', req.admin?.username);
    
    const pool = await poolPromise;
    console.log('✅ Database connected');
    
    // Get all applications with full details
    const result = await pool.request().query(`
      SELECT 
        a.RegistrationNumber,
        c.CompanyName,
        o.FullName AS ApplicantName,
        s.StatusName AS CurrentStatus,
        ISNULL(a.Remarks, 'No remarks') AS Remarks
      FROM Applications a
      INNER JOIN Companies c ON a.CompanyID = c.CompanyID
      INNER JOIN StatusMaster s ON a.StatusID = s.StatusID
      LEFT JOIN Officers o ON c.CompanyID = o.CompanyID
      ORDER BY a.CreatedAt DESC
    `);

    const applications = result.recordset;
    console.log(`✅ Found ${applications.length} applications`);

    if (applications.length === 0) {
      console.log('⚠️ No applications found');
      return res.status(404).json({
        success: false,
        message: "No applications found to export"
      });
    }

    // Calculate status counts
    const statusCounts = applications.reduce((acc, app) => {
      const status = app.CurrentStatus || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('Status counts:', statusCounts);
    console.log('Creating Excel workbook...');
    
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CPC Portal';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Applications Report');

    // Add title row
    worksheet.mergeCells('A1:E1');
    const titleRow = worksheet.getCell('A1');
    titleRow.value = 'Ceylon Petroleum Corporation - Applications Report';
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF1F4788' } };
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    titleRow.border = {
      top: { style: 'thick', color: { argb: 'FF1F4788' } },
      left: { style: 'thick', color: { argb: 'FF1F4788' } },
      bottom: { style: 'medium', color: { argb: 'FF1F4788' } },
      right: { style: 'thick', color: { argb: 'FF1F4788' } }
    };
    worksheet.getRow(1).height = 35;

    // Add date row
    worksheet.mergeCells('A2:E2');
    const dateRow = worksheet.getCell('A2');
    dateRow.value = `Generated on: ${new Date().toLocaleString('en-GB')}`;
    dateRow.font = { size: 11, italic: true };
    dateRow.alignment = { vertical: 'middle', horizontal: 'center' };
    dateRow.border = {
      top: { style: 'thin', color: { argb: 'FF1F4788' } },
      left: { style: 'thick', color: { argb: 'FF1F4788' } },
      bottom: { style: 'medium', color: { argb: 'FF1F4788' } },
      right: { style: 'thick', color: { argb: 'FF1F4788' } }
    };
    worksheet.getRow(2).height = 22;

    // Empty row for spacing
    worksheet.addRow([]);

    console.log('Setting up columns and headers...');
    
    // Manually add header row with proper column names
    const headerRow = worksheet.addRow([
      'Registration Number',
      'Company Name',
      "Officer's Name",
      'Current Status',
      'Remarks'
    ]);
    
    // Set column widths
    worksheet.columns = [
      { key: 'registrationNumber', width: 25 },
      { key: 'companyName', width: 38 },
      { key: 'applicantName', width: 30 },
      { key: 'currentStatus', width: 42 },
      { key: 'remarks', width: 50 }
    ];

    // Style header row (row 4) - Professional dark blue ONLY in columns A to E
    headerRow.height = 40;

    // Apply styling ONLY to cells A4 to E4
    ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
      const cell = worksheet.getCell(`${col}4`);
      
      // Dark blue background and white text
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4788' }
      };
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { 
        vertical: 'middle', 
        horizontal: 'center',
        wrapText: true 
      };
      
      // Thick borders
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF000000' } },
        left: { style: 'thick', color: { argb: 'FF000000' } },
        bottom: { style: 'thick', color: { argb: 'FF000000' } },
        right: { style: 'thick', color: { argb: 'FF000000' } }
      };
    });

    console.log('Adding data rows...');
    
    // Define light colors for different statuses
    const statusColors = {
      'Application Received': 'FFE3F2FD',
      'Under Preliminary Review': 'FFFFF9C4',
      'Not Eligible for Registration': 'FFF5F5F5',
      'Under Committee Evaluation and Pending Feedback': 'FFE1F5FE',
      'Approved': 'FFE8F5E9',
      'Rejected': 'FFFFEBEE'
    };
    
    // Add data rows with status-based colors
    applications.forEach((app) => {
      const dataRow = worksheet.addRow([
        app.RegistrationNumber || 'N/A',
        app.CompanyName || 'N/A',
        app.ApplicantName || 'Not Assigned',
        app.CurrentStatus || 'N/A',
        app.Remarks || 'No remarks'
      ]);

      // Get color based on status
      const rowColor = statusColors[app.CurrentStatus] || 'FFFFFFFF';
      
      // Apply light color to entire row (ONLY columns A to E)
      dataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber <= 5) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowColor }
          };
          
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          
          if (colNumber === 4) {
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: 'center',
              wrapText: true 
            };
            cell.font = { bold: true };
          } else {
            cell.alignment = { 
              vertical: 'middle', 
              horizontal: 'left',
              wrapText: true 
            };
          }
        }
      });

      dataRow.height = 30;
    });

    console.log('Adding footer summary...');
    
    // Add thick bottom border to last data row
    const lastDataRow = worksheet.lastRow;
    lastDataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber <= 5) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      }
    });

    // Add spacing
    worksheet.addRow([]);
    worksheet.addRow([]);
    
    // ✅ SUMMARY SECTION - STATUS BREAKDOWN
    const summaryStartRow = worksheet.lastRow.number + 1;
    
    // Summary title
    const summaryTitle = worksheet.addRow(['📊 APPLICATIONS SUMMARY']);
    summaryTitle.font = { bold: true, size: 13, color: { argb: 'FF1F4788' } };
    summaryTitle.height = 30;
    summaryTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.mergeCells(`A${summaryTitle.number}:B${summaryTitle.number}`);
    
    // Add border to title
    ['A', 'B'].forEach(col => {
      const cell = summaryTitle.getCell(col);
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF1F4788' } },
        left: { style: 'thick', color: { argb: 'FF1F4788' } },
        bottom: { style: 'medium', color: { argb: 'FF1F4788' } },
        right: { style: 'thick', color: { argb: 'FF1F4788' } }
      };
    });

    worksheet.addRow([]); // Spacing

    // Total applications row
    const totalRow = worksheet.addRow(['Total Applications:', applications.length]);
    totalRow.font = { bold: true, size: 12 };
    totalRow.height = 28;
    totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    totalRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
    
    ['A', 'B'].forEach(col => {
      const cell = totalRow.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8F4FF' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4788' } },
        left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        right: { style: 'thin', color: { argb: 'FF9E9E9E' } }
      };
    });

    worksheet.addRow([]); // Spacing

    // Status breakdown title
    const breakdownTitle = worksheet.addRow(['Status Breakdown:']);
    breakdownTitle.font = { bold: true, size: 11, italic: true };
    breakdownTitle.height = 25;
    breakdownTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    // ✅ STATUS COUNTS - Each status with its count
    const statusDisplayOrder = [
      'Application Received',
      'Under Preliminary Review',
      'Not Eligible for Registration',
      'Under Committee Evaluation and Pending Feedback',
      'Approved',
      'Rejected'
    ];

    const statusIcons = {
      'Application Received': '📝',
      'Under Preliminary Review': '🔍',
      'Not Eligible for Registration': '⚠️',
      'Under Committee Evaluation and Pending Feedback': '⏳',
      'Approved': '✅',
      'Rejected': '❌'
    };

    statusDisplayOrder.forEach((status) => {
      const count = statusCounts[status] || 0;
      const icon = statusIcons[status] || '•';
      const color = statusColors[status] || 'FFFFFFFF';
      
      const statusRow = worksheet.addRow([`${icon} ${status}`, count]);
      statusRow.height = 25;
      statusRow.font = { size: 11 };
      statusRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
      statusRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
      statusRow.getCell(2).font = { bold: true, size: 11 };
      
      // Apply status color to the row
      ['A', 'B'].forEach(col => {
        const cell = statusRow.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9E9E9E' } },
          left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
          bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
          right: { style: 'thin', color: { argb: 'FF9E9E9E' } }
        };
      });
    });

    worksheet.addRow([]); // Spacing

    // Report date
    const dateFooter = worksheet.addRow(['Report Generated:', new Date().toLocaleString('en-GB')]);
    dateFooter.font = { bold: true, size: 10, italic: true };
    dateFooter.height = 22;
    dateFooter.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    dateFooter.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
    
    ['A', 'B'].forEach(col => {
      const cell = dateFooter.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
        right: { style: 'thin', color: { argb: 'FF9E9E9E' } }
      };
    });

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `CPC_Applications_Report_${timestamp}.xlsx`;

    console.log('Setting response headers...');
    
    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    console.log('Writing Excel file to response...');
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel report generated: ${filename} (${applications.length} records)`);
    console.log('Status breakdown:', statusCounts);

  } catch (err) {
    console.error("❌ Export to Excel error:", err);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    res.status(500).json({
      success: false,
      message: "Failed to generate Excel report",
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router;