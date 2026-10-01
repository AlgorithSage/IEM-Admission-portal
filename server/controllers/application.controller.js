const Application = require('../models/Application');
const path = require('path');

// State Machine Transition Graph
const ALLOWED_TRANSITIONS = {
  Submitted: ['Review'],
  Review: ['Selected', 'Rejected', 'Submitted'],
  Selected: [], // Terminal state
  Rejected: []  // Terminal state
};

// @desc    Submit a new admission application with file upload
// @route   POST /api/applications
// @access  Private (Applicant)
const submitApplication = async (req, res, next) => {
  try {
    const applicantId = req.user.id;

    // Check if applicant has already submitted an application
    const existingApp = await Application.findOne({ applicant: applicantId });
    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted an application. Check status tracker to track your application status.'
      });
    }

    const {
      fullName,
      email,
      phone,
      dob,
      gender,
      address,
      department,
      qualifyingExam,
      passingYear,
      percentage
    } = req.body;

    if (!fullName || !department || !qualifyingExam || !passingYear || !percentage) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all required fields.'
      });
    }

    // Process uploaded document metadata from Multer
    let documentData = {};
    if (req.file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      documentData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: `${baseUrl}/uploads/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedAt: new Date()
      };
    } else {
      documentData = {
        fileName: 'sample-marksheet.pdf',
        originalName: '12th_Standard_Marksheet.pdf',
        filePath: `${req.protocol}://${req.get('host')}/uploads/sample-marksheet.pdf`,
        mimeType: 'application/pdf',
        fileSize: 1048576,
        uploadedAt: new Date()
      };
    }

    const newApplication = new Application({
      applicant: applicantId,
      fullName,
      email: email || req.user.email,
      phone: phone || req.user.phone || '',
      dob: dob || '',
      gender: gender || 'Male',
      address: address || '',
      department,
      qualifyingExam,
      passingYear: Number(passingYear),
      percentage: Number(percentage),
      document: documentData,
      status: 'Submitted',
      adminRemarks: 'Application submitted successfully. Awaiting scrutiny.',
      statusHistory: [
        {
          fromStatus: 'Submitted',
          toStatus: 'Submitted',
          changedAt: new Date(),
          changedBy: applicantId,
          remarks: 'Submitted by applicant via portal'
        }
      ]
    });

    const savedApp = await newApplication.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      application: savedApp
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged in applicant's application dossier
// @route   GET /api/applications/my-application
// @access  Private (Applicant)
const getMyApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({ applicant: String(req.user.id) });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'No active application found for this account.'
      });
    }

    res.status(200).json({
      success: true,
      application
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all applications (with optional search, status & department filters)
// @route   GET /api/applications
// @access  Private (Admin)
const getAllApplications = async (req, res, next) => {
  try {
    const { status, department, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (department && department !== 'all') {
      filter.department = department;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }

    const applications = await Application.find(filter)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single application by ID
// @route   GET /api/applications/:id
// @access  Private
const getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    // Ensure applicants can only view their own dossier
    if (req.user.role !== 'admin' && String(application.applicant) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this application.'
      });
    }

    res.status(200).json({
      success: true,
      application
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update application status enforcing deterministic state machine
// @route   PATCH /api/applications/:id/status
// @access  Private (Admin only)
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status: targetStatus, remarks } = req.body;
    const { id } = req.params;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    const currentStatus = application.status;

    // Validate State Machine Transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Illegal state transition: Cannot change status from '${currentStatus}' directly to '${targetStatus}'. Allowed next states: [${allowed.join(', ') || 'None (Terminal)'}].`
      });
    }

    // Append to status history
    application.statusHistory.push({
      fromStatus: currentStatus,
      toStatus: targetStatus,
      changedAt: new Date(),
      changedBy: req.user.id,
      remarks: remarks || `Status updated to ${targetStatus} by scrutiny committee.`
    });

    application.status = targetStatus;
    if (remarks) {
      application.adminRemarks = remarks;
    }

    const updatedApp = await application.save();

    res.status(200).json({
      success: true,
      message: `Status successfully updated to '${targetStatus}'.`,
      application: updatedApp
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Execute MongoDB Aggregation Pipeline for real-time KPI metrics
// @route   GET /api/applications/admin/stats
// @access  Private (Admin only)
const getAdminStats = async (req, res, next) => {
  try {
    const stats = await Application.aggregate([
      {
        $facet: {
          totalCount: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byDepartment: [
            { $group: { _id: '$department', count: { $sum: 1 } } }
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { $project: { fullName: 1, department: 1, status: 1, createdAt: 1, percentage: 1 } }
          ]
        }
      }
    ]);

    // Format aggregation results
    const facetResult = stats[0] || {};
    const total = facetResult.totalCount?.[0]?.count || 0;

    const statusMap = { Submitted: 0, Review: 0, Selected: 0, Rejected: 0 };
    facetResult.byStatus?.forEach((s) => {
      if (statusMap.hasOwnProperty(s._id)) {
        statusMap[s._id] = s.count;
      }
    });

    const departmentMap = { 'B.Tech': 0, 'M.Tech': 0, MBA: 0, MCA: 0, BBA: 0 };
    facetResult.byDepartment?.forEach((d) => {
      if (departmentMap.hasOwnProperty(d._id)) {
        departmentMap[d._id] = d.count;
      }
    });

    res.status(200).json({
      success: true,
      stats: {
        total,
        statusBreakdown: statusMap,
        departmentBreakdown: departmentMap,
        recentSubmissions: facetResult.recent || []
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitApplication,
  getMyApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  getAdminStats
};
