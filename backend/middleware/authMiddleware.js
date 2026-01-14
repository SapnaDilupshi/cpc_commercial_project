// backend/middleware/authMiddleware.js - Fixed
const jwt = require("jsonwebtoken");

const protectAdmin = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    console.log('🔐 protectAdmin middleware called');
    console.log('Authorization header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      console.log('❌ No Bearer token found');
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, no token provided" 
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];
    
    if (!token) {
      console.log('❌ Token extraction failed');
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, token missing" 
      });
    }
    
    console.log('Token received:', token.substring(0, 20) + '...');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified for user:', decoded.username);
    
    req.user = decoded;
    next();
    
  } catch (err) {
    console.error('❌ Token verification error:', err.message);
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: "Token expired, please login again" 
      });
    }
    
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token" 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      message: "Token verification failed" 
    });
  }
};

const protectOfficer = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    console.log('🔐 protectOfficer middleware called');
    
    if (!authHeader || !authHeader.startsWith("Bearer")) {
      console.log('❌ No Bearer token found');
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, no token provided" 
      });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, token missing" 
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== "officer") {
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized as officer" 
      });
    }
    
    console.log('✅ Officer token verified:', decoded.officerID);
    
    req.user = decoded;
    next();
    
  } catch (err) {
    console.error('❌ Token verification error:', err.message);
    res.status(401).json({ 
      success: false, 
      message: "Token verification failed" 
    });
  }
};

module.exports = { protectAdmin, protectOfficer };