/**
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const { getDashboardData, getInterviewHistory, getPerformanceAnalytics } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.get('/data', authenticate, getDashboardData);
router.get('/history', authenticate, getInterviewHistory);
router.get('/analytics', authenticate, getPerformanceAnalytics);

module.exports = router;
