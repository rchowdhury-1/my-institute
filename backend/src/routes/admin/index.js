const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'supervisor'));

router.use(require('./students'));
router.use(require('./teachers'));
router.use(require('./packages'));
router.use(require('./legacy'));

module.exports = router;
