const multer = require('multer');
const azureBlobService = require('../services/azureBlobService');
const path = require('path');

// Enhanced MIME type detection
const getMimeTypeByExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.json': 'application/json'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types with proper MIME types
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'image/bmp': ['.bmp'],
    'image/svg+xml': ['.svg'],
    'application/pdf': ['.pdf'],
    'text/csv': ['.csv'],
    'text/plain': ['.txt'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
  };

  const fileExtension = path.extname(file.originalname).toLowerCase();
  let mimeType = file.mimetype.toLowerCase();
  
  // Fallback to extension-based MIME type detection if needed
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = getMimeTypeByExtension(file.originalname);
  }

  // Ensure the detected MIME type matches the file extension
  const expectedMimeType = getMimeTypeByExtension(file.originalname);
  if (expectedMimeType !== 'application/octet-stream') {
    mimeType = expectedMimeType;
  }

  if (allowedTypes[mimeType] && allowedTypes[mimeType].includes(fileExtension)) {
    // Override the file's MIME type with the correct one
    file.mimetype = mimeType;
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: ${Object.keys(allowedTypes).join(', ')}`), false);
  }
};

// Multer configuration for memory storage (files will be uploaded to Azure)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: fileFilter
});

/**
 * Middleware to upload single file to Azure Blob Storage
 * @param {string} fieldName - Field name for the file input
 * @param {string} folder - Optional folder path in Azure
 */
const uploadSingleToAzure = (fieldName, folder = '') => {
  return async (req, res, next) => {
    console.log(`[uploadSingleToAzure] Called for field: ${fieldName}, folder: ${folder}`);
    // Use multer to handle file upload to memory
    upload.single(fieldName)(req, res, async (err) => {
      if (err) {
        console.error('[uploadSingleToAzure] Multer error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Unexpected field name for file upload.' });
          }
        }
        return res.status(400).json({ message: err.message });
      }

      // If no file uploaded, continue
      if (!req.file) {
        console.log('[uploadSingleToAzure] No file uploaded, continuing.');
        return next();
      }

      try {
        console.log('[uploadSingleToAzure] File received:', req.file.originalname, req.file.mimetype, req.file.size);
        // Upload to Azure Blob Storage if available
        if (azureBlobService.isAvailable()) {
          console.log('[uploadSingleToAzure] Azure Blob Service is available. Uploading to Azure...');
          const uploadResult = await azureBlobService.uploadFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            folder
          );
          console.log('[uploadSingleToAzure] Azure upload result:', uploadResult);

          // Attach Azure upload result to request
          req.azureFile = uploadResult;
          req.file.azureUrl = uploadResult.url;
          req.file.azureBlobName = uploadResult.blobName;
        } else {
          // Fallback to local storage if Azure is not configured
          console.warn('[uploadSingleToAzure] Azure Blob Storage not available, using local storage fallback');
          // You can implement local storage fallback here if needed
          req.file.localPath = `/uploads/${folder}/${Date.now()}-${req.file.originalname}`;
        }

        next();
      } catch (error) {
        console.error('[uploadSingleToAzure] File upload error:', error);
        res.status(500).json({ 
          message: 'Failed to upload file',
          error: error.message 
        });
      }
    });
  };
};

/**
 * Middleware to upload multiple files to Azure Blob Storage
 * @param {string} fieldName - Field name for the file inputs
 * @param {number} maxCount - Maximum number of files
 * @param {string} folder - Optional folder path in Azure
 */
const uploadMultipleToAzure = (fieldName, maxCount = 5, folder = '') => {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'One or more files are too large. Maximum size is 10MB per file.' });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Too many files or unexpected field name.' });
          }
        }
        return res.status(400).json({ message: err.message });
      }

      // If no files uploaded, continue
      if (!req.files || req.files.length === 0) {
        return next();
      }

      try {
        // Upload all files to Azure Blob Storage if available
        if (azureBlobService.isAvailable()) {
          const uploadPromises = req.files.map(async (file) => {
            const uploadResult = await azureBlobService.uploadFile(
              file.buffer,
              file.originalname,
              file.mimetype,
              folder
            );

            file.azureUrl = uploadResult.url;
            file.azureBlobName = uploadResult.blobName;
            return uploadResult;
          });

          const uploadResults = await Promise.all(uploadPromises);
          req.azureFiles = uploadResults;
        } else {
          console.warn('Azure Blob Storage not available, using local storage fallback');
          // Implement local storage fallback for multiple files if needed
        }

        next();
      } catch (error) {
        console.error('Multiple file upload error:', error);
        res.status(500).json({ 
          message: 'Failed to upload one or more files',
          error: error.message 
        });
      }
    });
  };
};

/**
 * Middleware to handle different types of file uploads
 * @param {Object} fields - Object defining field names and their types
 * @param {string} folder - Optional folder path in Azure
 */
const uploadFieldsToAzure = (fields, folder = '') => {
  return async (req, res, next) => {
    upload.fields(fields)(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'One or more files are too large. Maximum size is 10MB per file.' });
          }
        }
        return res.status(400).json({ message: err.message });
      }

      // If no files uploaded, continue
      if (!req.files) {
        return next();
      }

      try {
        if (azureBlobService.isAvailable()) {
          const uploadResults = {};

          // Process each field
          for (const [fieldName, files] of Object.entries(req.files)) {
            const fieldResults = await Promise.all(
              files.map(async (file) => {
                const uploadResult = await azureBlobService.uploadFile(
                  file.buffer,
                  file.originalname,
                  file.mimetype,
                  folder
                );

                file.azureUrl = uploadResult.url;
                file.azureBlobName = uploadResult.blobName;
                return uploadResult;
              })
            );
            uploadResults[fieldName] = fieldResults;
          }

          req.azureFiles = uploadResults;
        }

        next();
      } catch (error) {
        console.error('Fields upload error:', error);
        res.status(500).json({ 
          message: 'Failed to upload files',
          error: error.message 
        });
      }
    });
  };
};

/**
 * Helper function to delete file from Azure Blob Storage
 * @param {string} blobName - Blob name to delete
 */
const deleteFromAzure = async (blobName) => {
  if (!azureBlobService.isAvailable()) {
    throw new Error('Azure Blob Storage not available');
  }
  return await azureBlobService.deleteFile(blobName);
};

module.exports = {
  uploadSingleToAzure,
  uploadMultipleToAzure,
  uploadFieldsToAzure,
  deleteFromAzure,
  azureBlobService
};
