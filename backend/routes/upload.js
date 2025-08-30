const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  uploadSingleToAzure, 
  uploadMultipleToAzure, 
  deleteFromAzure,
  azureBlobService 
} = require('../middleware/upload');

/**
 * @swagger
 * /api/upload/single:
 *   post:
 *     summary: Upload a single file
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               folder:
 *                 type: string
 *                 description: Optional folder name (e.g., products, avatars)
 *     responses:
 *       200:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 file:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     blobName:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: number
 *                     mimeType:
 *                       type: string
 *       400:
 *         description: Bad request or file validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/single', authenticateToken, (req, res, next) => {
  const folder = req.body.folder || 'general';
  uploadSingleToAzure('file', folder)(req, res, next);
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Return file information with browser display optimization info
    const isImage = req.file.mimetype.startsWith('image/');
    const fileInfo = {
      url: req.file.azureUrl || req.file.localPath,
      blobName: req.file.azureBlobName,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      isImage: isImage,
      willDisplayInBrowser: isImage || req.file.mimetype === 'application/pdf'
    };

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: fileInfo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/upload/multiple:
 *   post:
 *     summary: Upload multiple files
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               folder:
 *                 type: string
 *                 description: Optional folder name
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 *       400:
 *         description: Bad request or file validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/multiple', authenticateToken, (req, res, next) => {
  const folder = req.body.folder || 'general';
  const maxCount = 5; // Maximum 5 files
  uploadMultipleToAzure('files', maxCount, folder)(req, res, next);
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Return files information
    const filesInfo = req.files.map(file => ({
      url: file.azureUrl || file.localPath,
      blobName: file.azureBlobName,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    }));

    res.json({
      success: true,
      message: `${req.files.length} files uploaded successfully`,
      files: filesInfo
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/upload/product-image:
 *   post:
 *     summary: Upload product image
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Product image uploaded successfully
 *       400:
 *         description: Bad request or file validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/product-image', authenticateToken, (req, res, next) => {
  uploadSingleToAzure('image', 'products')(req, res, next);
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    res.json({
      success: true,
      message: 'Product image uploaded successfully',
      imageUrl: req.file.azureUrl || req.file.localPath,
      blobName: req.file.azureBlobName
    });
  } catch (error) {
    console.error('Product image upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload product image',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/upload/delete/{blobName}:
 *   delete:
 *     summary: Delete a file from Azure Blob Storage
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blobName
 *         required: true
 *         schema:
 *           type: string
 *         description: The blob name to delete
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.delete('/delete/:blobName(*)', authenticateToken, async (req, res) => {
  try {
    const blobName = req.params.blobName;
    
    if (!blobName) {
      return res.status(400).json({
        success: false,
        message: 'Blob name is required'
      });
    }

    if (!azureBlobService.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Azure Blob Storage not available'
      });
    }

    await deleteFromAzure(blobName);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/upload/list/{folder}:
 *   get:
 *     summary: List files in a folder
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folder
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional folder name to list files from
 *     responses:
 *       200:
 *         description: Files listed successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/list/:folder?', authenticateToken, async (req, res) => {
  try {
    const folder = req.params.folder || '';

    if (!azureBlobService.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Azure Blob Storage not available'
      });
    }

    const files = await azureBlobService.listFiles(folder);

    res.json({
      success: true,
      folder: folder || 'root',
      files: files
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list files',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/upload/status:
 *   get:
 *     summary: Get upload service status
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upload service status
 */
router.get('/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    azureAvailable: azureBlobService.isAvailable(),
    containerName: process.env.AZURE_CONTAINER_NAME || 'inventory-uploads',
    maxFileSize: '10MB',
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'csv', 'xls', 'xlsx'],
    browserDisplaySupport: {
      images: 'All image types will display inline in browsers',
      pdfs: 'PDF files will display inline in browsers',
      others: 'Other files will be downloaded'
    }
  });
});

/**
 * @swagger
 * /api/upload/test-image/{blobName}:
 *   get:
 *     summary: Test image display with proper headers
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: blobName
 *         required: true
 *         schema:
 *           type: string
 *         description: The blob name to serve
 *     responses:
 *       200:
 *         description: Image served with proper headers
 *       404:
 *         description: Image not found
 */
router.get('/test-image/:blobName(*)', async (req, res) => {
  try {
    const blobName = req.params.blobName;
    
    if (!azureBlobService.isAvailable()) {
      return res.status(400).json({
        success: false,
        message: 'Azure Blob Storage not available'
      });
    }

    // Get the file URL and redirect with proper headers
    const fileUrl = azureBlobService.getFileUrl(blobName);
    
    // Set headers to ensure inline display
    res.set({
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000',
      'X-Content-Type-Options': 'nosniff'
    });
    
    // Redirect to the Azure URL
    res.redirect(302, fileUrl);
    
  } catch (error) {
    console.error('Test image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve test image',
      error: error.message
    });
  }
});

module.exports = router;
