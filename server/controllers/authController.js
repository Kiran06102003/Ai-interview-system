/**
 * Authentication Controller
 * Handles user registration, login, and profile management
 */

const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

// ─── Register ─────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, role, skills, experience, targetRole } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role: role || 'user',
      skills: skills || [],
      experience: experience || 0,
      targetRole: targetRole || '',
    });

    await user.save();

    const token = generateToken(user._id.toString());

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        experience: user.experience,
        targetRole: user.targetRole,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed, please try again' });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify role if provided
    if (role && user.role !== role) {
      return res.status(401).json({ error: `User is not registered as an ${role}` });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user._id.toString());

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        experience: user.experience,
        targetRole: user.targetRole,
        totalInterviews: user.totalInterviews,
        averageScore: user.averageScore,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed, please try again' });
  }
};

// ─── Get Profile ──────────────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// ─── Update Profile ───────────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, skills, experience, targetRole, resumeText, preferredLanguage, preferredDifficulty } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (skills) updates.skills = skills;
    if (experience !== undefined) updates.experience = experience;
    if (targetRole !== undefined) updates.targetRole = targetRole;
    if (resumeText !== undefined) updates.resumeText = resumeText;
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;
    if (preferredDifficulty) updates.preferredDifficulty = preferredDifficulty;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ message: 'Profile updated successfully', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ─── Change Password ──────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.userId).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
};

module.exports = { register, login, getProfile, updateProfile, changePassword };
