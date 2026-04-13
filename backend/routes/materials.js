import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { uploadMaterial } from '../middleware/upload.js';
import * as materialController from '../controllers/materialController.js';

const router = express.Router();

/**
 * @route   GET /api/materials
 * @desc    Get all teaching materials
 * @access  Private (Admin/Superadmin/Teacher)
 */
router.get('/', authenticate, materialController.getMaterials);

/**
 * @route   GET /api/materials/:id
 * @desc    Get material by ID
 * @access  Public
 */
router.get('/:id', materialController.getMaterialById);

/**
 * @route   POST /api/materials
 * @desc    Create teaching material (Admin/Teacher)
 * @access  Private (Admin/Superadmin/Teacher)
 */
router.post(
  '/',
  authenticate,
  (req, res, next) => {
    // Allow admin/superadmin or teacher
    if (req.user.userType === 'superadmin' || req.user.userType === 'admin' || req.user.userType === 'teacher') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Teacher role required.',
    });
  },
  (req, res, next) => {
    uploadMaterial.single('file')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file too large, invalid file type, etc.)
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  },
  // Validation - note: body() won't work with multipart/form-data, so we validate in controller
  materialController.createMaterial
);

/**
 * @route   PUT /api/materials/:id
 * @desc    Update teaching material (Admin/Superadmin/Teacher own)
 * @access  Private (Admin/Superadmin/Teacher own)
 */
router.put(
  '/:id',
  authenticate,
  (req, res, next) => {
    if (req.user.userType === 'superadmin' || req.user.userType === 'admin' || req.user.userType === 'teacher') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Teacher role required.',
    });
  },
  (req, res, next) => {
    uploadMaterial.single('file')(req, res, (err) => {
      if (err) {
        // Handle multer errors (file too large, invalid file type, etc.)
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error',
        });
      }
      next();
    });
  },
  // Validation - note: body() won't work with multipart/form-data, so we validate in controller
  materialController.updateMaterial
);

/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete teaching material (Admin/Superadmin/Teacher own)
 * @access  Private (Admin/Superadmin/Teacher own)
 */
router.delete(
  '/:id',
  authenticate,
  (req, res, next) => {
    if (req.user.userType === 'superadmin' || req.user.userType === 'admin' || req.user.userType === 'teacher') {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Teacher role required.',
    });
  },
  materialController.deleteMaterial
);

export default router;

