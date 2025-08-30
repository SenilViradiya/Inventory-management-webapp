const { BlobServiceClient } = require('@azure/storage-blob');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

class AzureBlobService {
  constructor() {
    // Initialize Azure Blob Service Client
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_CONTAINER_NAME || 'inventory-uploads';
    
    if (!this.connectionString) {
      console.warn('Azure Storage connection string not found. File uploads will be stored locally.');
      this.blobServiceClient = null;
      return;
    }

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
      this.initializeContainer();
    } catch (error) {
      console.error('Failed to initialize Azure Blob Service:', error);
      this.blobServiceClient = null;
    }
  }

  async initializeContainer() {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists({
        access: 'blob' // Allow public read access to blobs
      });
      console.log(`Azure container "${this.containerName}" initialized successfully`);
    } catch (error) {
      console.error('Failed to initialize Azure container:', error);
    }
  }

  /**
   * Upload file to Azure Blob Storage
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - Optional folder path (e.g., 'products', 'avatars')
   * @returns {Promise<Object>} Upload result with URL and blob name
   */
  async uploadFile(fileBuffer, originalName, mimeType, folder = '') {
    if (!this.blobServiceClient) {
      throw new Error('Azure Blob Storage not configured');
    }

    try {
      // Generate unique filename
      const fileExtension = path.extname(originalName);
      const fileName = `${uuidv4()}${fileExtension}`;
      const blobName = folder ? `${folder}/${fileName}` : fileName;

      // Get container client
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Upload file with metadata and proper headers for browser display
      const isImage = mimeType.startsWith('image/');
      const isPDF = mimeType === 'application/pdf';
      const isViewableInBrowser = isImage || isPDF;

      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: mimeType,
          // Use 'inline' for images and PDFs to display in browser, 'attachment' for downloads
          blobContentDisposition: isViewableInBrowser 
            ? `inline; filename="${originalName}"` 
            : `attachment; filename="${originalName}"`,
          // Add cache control for better performance
          blobCacheControl: isImage ? 'public, max-age=31536000' : 'public, max-age=3600'
        },
        metadata: {
          originalName: originalName,
          uploadedAt: new Date().toISOString(),
          isViewableInBrowser: isViewableInBrowser.toString()
        }
      };

      await blockBlobClient.upload(fileBuffer, fileBuffer.length, uploadOptions);

      // Return file information
      return {
        success: true,
        url: blockBlobClient.url,
        blobName: blobName,
        originalName: originalName,
        size: fileBuffer.length,
        mimeType: mimeType
      };
    } catch (error) {
      console.error('Azure Blob upload error:', error);
      throw new Error(`Failed to upload file to Azure: ${error.message}`);
    }
  }

  /**
   * Delete file from Azure Blob Storage
   * @param {string} blobName - Blob name to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(blobName) {
    if (!this.blobServiceClient) {
      throw new Error('Azure Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.deleteIfExists();
      return true;
    } catch (error) {
      console.error('Azure Blob delete error:', error);
      throw new Error(`Failed to delete file from Azure: ${error.message}`);
    }
  }

  /**
   * Get file URL from Azure Blob Storage
   * @param {string} blobName - Blob name
   * @returns {string} File URL
   */
  getFileUrl(blobName) {
    if (!this.blobServiceClient) {
      return null;
    }

    const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    return blockBlobClient.url;
  }

  /**
   * List files in a folder
   * @param {string} folder - Folder path
   * @returns {Promise<Array>} List of files
   */
  async listFiles(folder = '') {
    if (!this.blobServiceClient) {
      throw new Error('Azure Blob Storage not configured');
    }

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const files = [];

      const prefix = folder ? `${folder}/` : '';
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        files.push({
          name: blob.name,
          url: this.getFileUrl(blob.name),
          size: blob.properties.contentLength,
          lastModified: blob.properties.lastModified,
          contentType: blob.properties.contentType
        });
      }

      return files;
    } catch (error) {
      console.error('Azure Blob list error:', error);
      throw new Error(`Failed to list files from Azure: ${error.message}`);
    }
  }

  /**
   * Check if Azure Blob Storage is available
   * @returns {boolean} Availability status
   */
  isAvailable() {
    return !!this.blobServiceClient;
  }
}

// Create singleton instance
const azureBlobService = new AzureBlobService();

module.exports = azureBlobService;
