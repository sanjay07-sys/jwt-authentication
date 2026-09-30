const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// @desc    Get authenticated user profile
// @route   GET /api/user/profile
// @access  Protected (Requires valid JWT in HTTP-only cookie)
router.get('/profile', authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

module.exports = router;
