# Azure Blob Storage Integration Documentation

## Overview
This implementation adds Azure Blob Storage support for file uploads in the inventory management system. Files can be uploaded directly to Azure Blob Storage, providing better scalability, reliability, and global accessibility.

## Features
- ✅ Single and multiple file uploads
- ✅ Automatic file type validation
- ✅ File size limits (10MB per file)
- ✅ Organized folder structure (products, avatars, documents, etc.)
- ✅ Automatic cleanup of old files when updating
- ✅ Fallback to local storage if Azure is not configured
- ✅ Public URL generation for uploaded files
- ✅ File listing and management APIs

## Setup Instructions

### 1. Create Azure Storage Account
1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new **Storage Account**
3. Choose **Standard** performance tier
4. Select **Hot** access tier for frequently accessed files
5. Enable **Blob public access** if you want public URLs

### 2. Get Connection String
1. Go to your Storage Account
2. Navigate to **Access Keys** under **Security + networking**
3. Copy the **Connection string** from Key1 or Key2

### 3. Create Container
1. Go to **Containers** under **Data storage**
2. Create a new container named `inventory-uploads` (or your preferred name)
3. Set **Public access level** to:
   - **Blob** - for public read access to files
   - **Private** - for restricted access (requires authentication)

### 4. Configure Environment Variables
Add these to your `.env` file:

```bash
# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=yourstorageaccount;AccountKey=youraccountkey;EndpointSuffix=core.windows.net
AZURE_CONTAINER_NAME=inventory-uploads
```

## API Endpoints

### Upload Single File
```http
POST /api/upload/single
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- file: [binary file]
- folder: "products" (optional)
```

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "url": "https://yourstorageaccount.blob.core.windows.net/inventory-uploads/products/uuid-filename.jpg",
    "blobName": "products/uuid-filename.jpg",
    "originalName": "product-image.jpg",
    "size": 1024567,
    "mimeType": "image/jpeg",
    "uploadedAt": "2025-08-30T10:30:00.000Z"
  }
}
```

### Upload Multiple Files
```http
POST /api/upload/multiple
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- files: [multiple binary files]
- folder: "documents" (optional)
```

### Upload Product Image
```http
POST /api/upload/product-image
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- image: [binary file]
```

### Delete File
```http
DELETE /api/upload/delete/{blobName}
Authorization: Bearer <token>
```

### List Files
```http
GET /api/upload/list/products
Authorization: Bearer <token>
```

### Get Upload Status
```http
GET /api/upload/status
Authorization: Bearer <token>
```

## Usage in Product Management

### Creating Product with Image
```http
POST /api/products
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- name: "Beer Bottle"
- price: 5.99
- category: "beer"
- quantity: 100
- qrCode: "12345"
- expirationDate: "2025-12-31"
- image: [binary file]
```

The image will be automatically uploaded to Azure Blob Storage in the `products` folder.

### Updating Product with New Image
```http
PUT /api/products/{productId}
Content-Type: multipart/form-data
Authorization: Bearer <token>

Form Data:
- name: "Updated Beer Bottle"
- image: [new binary file]
```

The old image will be automatically deleted from Azure and replaced with the new one.

## File Organization

Files are organized in folders within the Azure container:

```
inventory-uploads/
├── products/           # Product images
├── avatars/           # User profile pictures
├── documents/         # PDF documents, CSV files
├── general/          # Miscellaneous uploads
└── temp/             # Temporary files
```

## Supported File Types

**Images:**
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

**Documents:**
- PDF (.pdf)
- CSV (.csv)
- Excel (.xls, .xlsx)

## File Size Limits
- Maximum file size: **10MB** per file
- Maximum files per request: **5 files**

## Error Handling

The system provides comprehensive error handling:

```json
{
  "success": false,
  "message": "File too large. Maximum size is 10MB.",
  "error": "LIMIT_FILE_SIZE"
}
```

Common error codes:
- `LIMIT_FILE_SIZE` - File exceeds size limit
- `LIMIT_UNEXPECTED_FILE` - Unexpected field name or too many files
- `FILE_TYPE_NOT_ALLOWED` - Unsupported file type
- `AZURE_NOT_CONFIGURED` - Azure Blob Storage not set up

## Fallback Behavior

If Azure Blob Storage is not configured:
1. Files are stored locally in `uploads/` directory
2. API endpoints still work but return local file paths
3. Console warnings indicate Azure is not available
4. No upload failures - seamless fallback

## Security Features

1. **Authentication Required**: All upload endpoints require valid JWT token
2. **File Type Validation**: Only allowed file types are accepted
3. **File Size Limits**: Prevents large file uploads
4. **Unique Filenames**: UUIDs prevent file name conflicts
5. **Folder Isolation**: Files organized in separate folders

## Monitoring and Logging

The system logs:
- Upload success/failure events
- Azure connectivity status
- File deletion events
- Fallback usage warnings

## Cost Optimization Tips

1. **Choose Right Storage Tier**:
   - Hot: Frequently accessed files
   - Cool: Infrequently accessed (30+ days)
   - Archive: Rarely accessed (180+ days)

2. **Set Lifecycle Policies**:
   - Automatically move old files to cooler tiers
   - Delete temporary files after certain period

3. **Monitor Usage**:
   - Track storage costs in Azure portal
   - Set up alerts for unusual usage

## Troubleshooting

### Connection Issues
```bash
# Test Azure connection
curl -X GET "http://localhost:5001/api/upload/status" \
  -H "Authorization: Bearer <token>"
```

### Debug Mode
Set `NODE_ENV=development` to see detailed logs.

### Common Issues

1. **"Azure Blob Storage not configured"**
   - Check environment variables
   - Verify connection string format
   - Ensure container exists

2. **"Failed to upload file to Azure"**
   - Check network connectivity
   - Verify Azure account permissions
   - Check storage account key validity

3. **Files not publicly accessible**
   - Set container access level to "Blob"
   - Check Azure firewall settings

## Performance Considerations

- Files are uploaded directly to Azure (not through server)
- Multiple files are uploaded in parallel
- Large files are automatically chunked by Azure SDK
- CDN can be added for global distribution

## Migration from Local Storage

To migrate existing local files to Azure:

1. Use the Azure Storage Explorer tool
2. Upload files maintaining folder structure
3. Update database records with new Azure URLs
4. Remove local files after verification

## Integration with Frontend

Frontend can upload files using FormData:

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', 'products');

const response = await fetch('/api/upload/single', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```
