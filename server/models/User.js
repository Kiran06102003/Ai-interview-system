/**
 * User Model
 * Stores user profile, authentication credentials, and interview history
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password in queries by default
  },
  // Professional profile
  skills: [{
    type: String,
    trim: true,
  }],
  experience: {
    type: Number, // Years of experience
    default: 0,
    min: 0,
    max: 50,
  },
  targetRole: {
    type: String,
    trim: true,
    default: '',
  },
  resumeText: {
    type: String,
    default: '',
  },
  // Interview statistics (denormalized for fast dashboard)
  totalInterviews: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },
  // Preferences
  preferredLanguage: {
    type: String,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'hi', 'zh'],
  },
  preferredDifficulty: {
    type: String,
    default: 'medium',
    enum: ['easy', 'medium', 'hard'],
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
