// backend/utils/constants.js
const STATUS_LIST = [
  'Application Received',
  'Under Preliminary Review',
  'Not Eligible for Registration',
  'Under Committee Evaluation and Pending Feedback',
  'Approved',
  'Rejected'
];

const STATUS_COLORS = {
  'Application Received': '#007bff',
  'Under Preliminary Review': '#ffc107',
  'Not Eligible for Registration': '#6c757d',
  'Under Committee Evaluation and Pending Feedback': '#17a2b8',
  'Approved': '#28a745',
  'Rejected': '#dc3545'
};

// Status ID mapping (based on database after running the SQL script)
const STATUS_IDS = {
  'Application Received': 1,
  'Under Preliminary Review': 2,
  'Not Eligible for Registration': 3,
  'Under Committee Evaluation and Pending Feedback': 4,
  'Approved': 5,
  'Rejected': 6
};

const STATUS_DESCRIPTIONS = {
  'Application Received': 'Your application has been received and is awaiting review',
  'Under Preliminary Review': 'Your application is being reviewed by our team',
  'Not Eligible for Registration': 'Application does not meet eligibility criteria',
  'Under Committee Evaluation and Pending Feedback': 'Application is under committee evaluation',
  'Approved': 'Your application has been approved',
  'Rejected': 'Application has been rejected'
};

module.exports = { 
  STATUS_LIST, 
  STATUS_COLORS, 
  STATUS_IDS,
  STATUS_DESCRIPTIONS
};