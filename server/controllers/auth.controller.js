const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/postgres');
const User = require('../models/User');

// Helper to sign JWT token
const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET || 'iem_admission_portal_poc_secret_jwt_key_2026';
  return jwt.sign(
    {
      id: user.id || user._id,
      email: user.email,
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      role: user.role
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register a new applicant or admin (Persisted in PostgreSQL with Row Versioning)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, firstName, lastName, email, password, phone, address, role } = req.body;

    if ((!name && !firstName) || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.'
      });
    }

    const emailNormalized = email.toLowerCase().trim();

    // Check if user already exists in PostgreSQL
    const existingPg = await query('SELECT id FROM users WHERE email = $1', [emailNormalized]);
    if (existingPg.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    let newUser;
    try {
      // Split name into first and last name if needed
      let fName = firstName;
      let lName = lastName;
      if (!fName && name) {
        const parts = name.trim().split(' ');
        fName = parts[0];
        lName = parts.slice(1).join(' ') || '.';
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userRole = role === 'admin' ? 'admin' : 'applicant';

      // Insert into PostgreSQL with row_version = 1
      const insertRes = await query(
        `INSERT INTO users (first_name, last_name, email, password_hash, phone, address, role, row_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
         RETURNING id, first_name, last_name, email, phone, address, role, row_version, created_at`,
        [fName, lName, emailNormalized, passwordHash, phone || '', address || '', userRole]
      );
      newUser = insertRes.rows[0];
    } catch (pgErr) {
      // PostgreSQL offline or unavailable - fallback seamlessly to MongoDB
      const existingMongo = await User.findOne({ email: emailNormalized });
      if (existingMongo) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists.'
        });
      }
      const mongoUser = await User.create({
        name: name || `${firstName || ''} ${lastName || ''}`.trim(),
        email: emailNormalized,
        password,
        phone: phone || '',
        role: role === 'admin' ? 'admin' : 'applicant'
      });
      const token = generateToken(mongoUser);
      return res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        token,
        user: {
          _id: mongoUser._id,
          id: mongoUser._id,
          name: mongoUser.name,
          email: mongoUser.email,
          phone: mongoUser.phone,
          role: mongoUser.role
        }
      });
    }

    // Dual-write replica into MongoDB for seamless cross-collection joins
    try {
      await User.findOneAndUpdate(
        { email: emailNormalized },
        {
          name: `${newUser.first_name} ${newUser.last_name}`.trim(),
          email: emailNormalized,
          password: newUser.password_hash,
          phone: newUser.phone,
          role: newUser.role
        },
        { upsert: true, new: true }
      );
    } catch (mErr) {
      // Non-fatal if Mongo replica sync fails
    }

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        _id: newUser.id,
        id: newUser.id,
        name: `${newUser.first_name} ${newUser.last_name}`.trim(),
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email,
        phone: newUser.phone,
        address: newUser.address,
        role: newUser.role,
        rowVersion: newUser.row_version,
        createdAt: newUser.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user against PostgreSQL / MongoDB & issue JWT
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const emailNormalized = email.toLowerCase().trim();

    // 1. Try querying PostgreSQL users table
    try {
      const result = await query('SELECT * FROM users WHERE email = $1', [emailNormalized]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password.'
          });
        }

        if (role && user.role !== role) {
          return res.status(403).json({
            success: false,
            message: `Role mismatch. You cannot log into the ${role} portal with an account assigned to '${user.role}'.`
          });
        }

        const token = generateToken(user);
        return res.status(200).json({
          success: true,
          message: 'Logged in successfully.',
          token,
          user: {
            _id: user.id,
            id: user.id,
            name: `${user.first_name} ${user.last_name}`.trim(),
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            role: user.role,
            rowVersion: user.row_version,
            createdAt: user.created_at
          }
        });
      }
    } catch (pgErr) {
      // PostgreSQL is offline/unreachable - seamlessly fallback to MongoDB
    }

    // 2. Fallback to MongoDB User authentication
    const mongoUser = await User.findOne({ email: emailNormalized });
    if (!mongoUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await mongoUser.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (role && mongoUser.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Role mismatch. You cannot log into the ${role} portal with an account assigned to '${mongoUser.role}'.`
      });
    }

    const token = generateToken(mongoUser);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      user: {
        _id: mongoUser._id,
        id: mongoUser._id,
        name: mongoUser.name,
        email: mongoUser.email,
        phone: mongoUser.phone,
        role: mongoUser.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile from PostgreSQL
const getMe = async (req, res, next) => {
  try {
    try {
      const result = await query(
        `SELECT id, first_name, last_name, email, phone, address, role, row_version, created_at, updated_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (result.rows.length > 0) {
        const user = result.rows[0];
        return res.status(200).json({
          success: true,
          user: {
            _id: user.id,
            id: user.id,
            name: `${user.first_name} ${user.last_name}`.trim(),
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            phone: user.phone,
            address: user.address,
            role: user.role,
            rowVersion: user.row_version,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        });
      }
    } catch (pgErr) {
      // Fallback to MongoDB
    }

    const mongoUser = await User.findById(req.user.id) || await User.findOne({ email: req.user.email });
    if (!mongoUser) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        _id: mongoUser._id,
        id: mongoUser._id,
        name: mongoUser.name,
        email: mongoUser.email,
        phone: mongoUser.phone,
        role: mongoUser.role,
        createdAt: mongoUser.createdAt,
        updatedAt: mongoUser.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile demonstrating PostgreSQL Optimistic Row Versioning
// @route   PUT /api/auth/profile
// @access  Private (Applicant / Admin)
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { phone, address, expectedRowVersion } = req.body;

    // 1. Fetch current row state
    const current = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (current.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const currentRecord = current.rows[0];

    // Optimistic Concurrency Check (if client provided expected version)
    if (expectedRowVersion && currentRecord.row_version !== Number(expectedRowVersion)) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: This profile has been modified by another session. Please reload the latest data.'
      });
    }

    // 2. Archive previous state into user_history table (Audit Log Pattern)
    await query(
      `INSERT INTO user_history (user_id, phone, address, row_version, change_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, currentRecord.phone, currentRecord.address, currentRecord.row_version, 'Profile update']
    );

    // 3. Increment row_version and update timestamp
    const updateRes = await query(
      `UPDATE users
       SET phone = $1, address = $2, row_version = row_version + 1, updated_at = NOW()
       WHERE id = $3
       RETURNING id, first_name, last_name, email, phone, address, role, row_version, updated_at`,
      [phone || currentRecord.phone, address || currentRecord.address, userId]
    );

    const updatedUser = updateRes.rows[0];

    res.status(200).json({
      success: true,
      message: 'Profile updated with row versioning in PostgreSQL.',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile
};
