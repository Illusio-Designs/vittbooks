require('dotenv').config();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || './uploads';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create tenant-specific directory if tenant_id is available
    const tenantId = req.tenant_id || 'default';
    const tenantDir = path.join(uploadDir, tenantId);
    
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true });
    }
    
    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allow common document and image types, plus XML for Tally imports
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|csv|xml/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and documents are allowed.'));
  }
};

// Profile image storage configuration
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const profileDir = path.join(uploadDir, 'profile');
    
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    
    cb(null, profileDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// Image-only file filter for profile images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images are allowed for profile pictures.'));
  }
};

// Configure multer - default upload (10MB)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
  },
  fileFilter: fileFilter,
});

// Configure multer for Tally imports - larger file size limit (50MB)
// Tally XML files can be very large, especially for companies with extensive transaction history
const uploadTally = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_TALLY_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default for Tally imports
  },
  fileFilter: fileFilter,
});

// Profile image upload configuration
const uploadProfile = multer({
  storage: profileStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_PROFILE_IMAGE_SIZE) || 5 * 1024 * 1024, // 5MB default for profile images
  },
  fileFilter: imageFilter,
});

// Company logo storage configuration
const companyLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenant_id || 'default';
    const companyDir = path.join(uploadDir, tenantId, 'company');
    
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }
    
    cb(null, companyDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

// Company DSC/Signature storage configuration
const companySignatureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenant_id || 'default';
    const companyDir = path.join(uploadDir, tenantId, 'company');
    
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }
    
    cb(null, companyDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `signature-${uniqueSuffix}${ext}`);
  },
});

// Signature file filter (images and PDFs)
const signatureFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed for signatures.'));
  }
};

// DSC Certificate storage configuration
const dscCertificateStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = req.tenant_id || 'default';
    const companyDir = path.join(uploadDir, tenantId, 'company', 'dsc');
    
    if (!fs.existsSync(companyDir)) {
      fs.mkdirSync(companyDir, { recursive: true });
    }
    
    cb(null, companyDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `dsc-cert-${uniqueSuffix}${ext}`);
  },
});

// DSC Certificate file filter (.pfx, .p12, .cer, .pem)
const dscCertificateFilter = (req, file, cb) => {
  const allowedTypes = /pfx|p12|cer|pem|crt|key/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /application\/x-pkcs12|application\/pkcs12|application\/x-x509-ca-cert|application\/x-pem-file|application\/octet-stream/.test(file.mimetype);

  if ((mimetype || extname) && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only certificate files (.pfx, .p12, .cer, .pem) are allowed.'));
  }
};

// Company logo upload configuration
const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_COMPANY_LOGO_SIZE) || 2 * 1024 * 1024, // 2MB default for company logos
  },
  fileFilter: imageFilter,
});

// Company signature/DSC upload configuration
const uploadCompanySignature = multer({
  storage: companySignatureStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_SIGNATURE_SIZE) || 2 * 1024 * 1024, // 2MB default for signatures
  },
  fileFilter: signatureFilter,
});

// DSC Certificate upload configuration
const uploadDSCCertificate = multer({
  storage: dscCertificateStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_DSC_CERT_SIZE) || 5 * 1024 * 1024, // 5MB default for DSC certificates
  },
  fileFilter: dscCertificateFilter,
});

/**
 * Magic-byte validator middleware factory.
 *
 * Multer trusts whatever Content-Type the client sent. After multer has
 * written the upload to disk, we sniff the real bytes and reject if the
 * content doesn't match the route's allow list. Use it like:
 *
 *   router.post('/foo', uploadProfile.single('image'),
 *     validateUploadedFile(['image/png', 'image/jpeg']),
 *     controller.handler);
 *
 * The middleware unlinks the rejected file before responding so we
 * never leave attacker-controlled content on disk.
 */
function validateUploadedFile(allowedMimes, options = {}) {
  const { detectMime } = require('../utils/fileMagic');
  return async function validateUploadedFileMiddleware(req, res, next) {
    try {
      const files = []
        .concat(req.file ? [req.file] : [])
        .concat(req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : []);

      for (const f of files) {
        if (!f || !f.path) continue;
        const detected = await detectMime(f.path);
        const ok = detected
          ? allowedMimes.includes(detected)
          : Boolean(options.allowExtensionFallback);
        if (!ok) {
          try { fs.unlinkSync(f.path); } catch (_e) { /* ignore */ }
          return res.status(400).json({
            success: false,
            message: 'Uploaded file content does not match an allowed type',
            detected: detected || 'unknown',
            allowed: allowedMimes,
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  upload,
  uploadTally, // Separate upload instance for Tally imports with higher file size limit
  uploadProfile,
  uploadCompanyLogo,
  uploadCompanySignature,
  uploadDSCCertificate,
  uploadDir,
  validateUploadedFile,
};
