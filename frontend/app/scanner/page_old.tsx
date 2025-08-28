'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProducts } from '../contexts/ProductsContext';
import { useRouter } from 'next/navigation';
import { stockAPI } from '../lib/api';
import Navigation from '../components/Navigation';
import toast from 'react-hot-toast';

// Import scanning libraries
let QrScanner: any = null;
let Quagga: any = null;

// Load scanning libraries
const loadScanningLibraries = async () => {
  try {
    console.log('Loading scanning libraries...');
    
    // Load QR Scanner
    if (!QrScanner) {
      const qrModule = await import('qr-scanner');
      QrScanner = qrModule.default;
      console.log('✅ QR Scanner loaded');
    }
    
    // Load QuaggaJS for barcode scanning
    if (!Quagga) {
      const quaggaModule = await import('quagga');
      Quagga = quaggaModule.default;
      console.log('✅ QuaggaJS loaded');
    }
    
    return { QrScanner, Quagga };
  } catch (error) {
    console.error('❌ Error loading scanning libraries:', error);
    return { QrScanner: null, Quagga: null };
  }
};
  }
  return null;
};

// Simple pattern matching for common barcode formats
const detectBarcodePattern = (text: string): string | null => {
  // Remove any non-digit characters and check if it looks like a barcode
  const cleaned = text.replace(/[^0-9]/g, '');
  
  // Check for common barcode lengths
  if (cleaned.length === 12 || cleaned.length === 13 || cleaned.length === 8) {
    return cleaned;
  }
  
  // Check for UPC-A (12 digits)
  if (/^\d{12}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Check for EAN-13 (13 digits)
  if (/^\d{13}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Check for EAN-8 (8 digits)
  if (/^\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
};

interface Product {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  qrCode: string;
  image?: string;
  category: string;
  expirationDate: string;
  minimumStock?: number;
}

export default function ScannerPage() {
  const { user } = useAuth();
  const { products, refreshProducts } = useProducts();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [operation, setOperation] = useState('add');
  const [scanning, setScanning] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load QR Scanner library on component mount
  useEffect(() => {
    loadQrScanner().then((scanner) => {
      setLibraryLoaded(!!scanner);
      if (scanner) {
        console.log('QR Scanner ready');
      } else {
        toast.error('Failed to load scanner. Please refresh the page.');
      }
    });
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // Vibration feedback
  const vibrateDevice = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([200]);
      }
    } catch (error) {
      console.log('Vibration not supported');
    }
  };

  // Enhanced file scanning with detailed logging
  const scanFromFile = async (file: File) => {
    if (!file) return;

    console.log('=== FILE SCANNING DEBUG ===');
    console.log('File info:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    setUploading(true);
    let foundCode = false;

    try {
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file type:', file.type);
        toast.error('Please select an image file');
        return;
      }

      // Store image locally for debugging
      const imageUrl = URL.createObjectURL(file);
      console.log('Local image URL created:', imageUrl);

      const scanner = await loadQrScanner();
      
      // Try QR code scanning first
      if (scanner) {
        try {
          console.log('Starting QR code scanning...');
          const qrResult = await scanner.scanImage(file, {
            returnDetailedScanResult: true,
          });

          console.log('QR scan result:', qrResult);

          if (qrResult && qrResult.data) {
            const scannedCode = qrResult.data.trim();
            console.log('QR Code successfully found:', scannedCode);
            
            vibrateDevice();
            setQrCode(scannedCode);
            await searchProduct(scannedCode);
            
            toast.success(`QR Code scanned: ${scannedCode}`);
            foundCode = true;
            return;
          }
        } catch (qrError) {
          console.log('QR scanning failed:', qrError);
        }
      } else {
        console.error('QR Scanner not available');
      }

      // Try browser BarcodeDetector API
      if (!foundCode) {
        console.log('Trying browser BarcodeDetector API...');
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          await new Promise<void>((resolve, reject) => {
            img.onload = async () => {
              try {
                console.log('Image loaded, dimensions:', img.width, 'x', img.height);
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);

                // Try browser barcode detection
                if ('BarcodeDetector' in window) {
                  console.log('BarcodeDetector available, starting detection...');
                  const barcodeDetector = new (window as any).BarcodeDetector({
                    formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
                  });
                  
                  const barcodes = await barcodeDetector.detect(img);
                  console.log('Barcode detection results:', barcodes);
                  
                  if (barcodes.length > 0) {
                    const scannedCode = barcodes[0].rawValue.trim();
                    console.log('Barcode found:', scannedCode);
                    
                    vibrateDevice();
                    setQrCode(scannedCode);
                    await searchProduct(scannedCode);
                    
                    toast.success(`Barcode scanned: ${scannedCode}`);
                    foundCode = true;
                  } else {
                    console.log('No barcodes detected by BarcodeDetector');
                  }
                } else {
                  console.log('BarcodeDetector not supported in this browser');
                }
                
                resolve();
              } catch (error) {
                console.error('Error in image processing:', error);
                reject(error);
              }
            };
            
            img.onerror = (error) => {
              console.error('Image load error:', error);
              reject(error);
            };
            
            img.src = imageUrl;
          });

        } catch (browserError) {
          console.error('Browser detection failed:', browserError);
        }
      }

      // If no code found, provide detailed feedback
      if (!foundCode) {
        console.log('No QR code or barcode detected in image');
        toast.error('No QR code or barcode found in the image. Please ensure the code is clear and visible.');
        
        // For debugging: Create a download link for the processed image
        if (typeof window !== 'undefined') {
          console.log('Image available for manual inspection at:', imageUrl);
          console.log('You can right-click and save this URL to inspect the image manually');
        }
      }

    } catch (error) {
      console.error('=== SCANNING ERROR ===');
      console.error('Error details:', error);
      console.error('Stack trace:', (error as Error).stack);
      toast.error('Error scanning image: ' + (error as Error).message);
    } finally {
      setUploading(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      console.log('=== FILE SCANNING COMPLETE ===');
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected for scanning:', file.name, file.type);
      scanFromFile(file);
    }
  };

  const triggerFileUpload = () => {
    if (!libraryLoaded) {
      toast.error('Scanner is still loading. Please wait.');
      return;
    }
    fileInputRef.current?.click();
  };

  const searchProduct = async (code: string) => {
    if (!code) return;
    
    console.log('Searching for product with code:', code);
    console.log('Available products:', products.map(p => ({ name: p.name, code: p.qrCode })));
    
    setLoading(true);
    try {
      const product = products.find(p => 
        p.qrCode === code.trim() || 
        p.qrCode.toLowerCase() === code.trim().toLowerCase()
      );
      
      if (product) {
        setSelectedProduct(product);
        toast.success(`Product found: ${product.name}`);
        console.log('Product matched:', product);
      } else {
        setSelectedProduct(null);
        toast.error(`Product not found for code: ${code}`);
        console.log('No matching product found');
      }
    } catch (error) {
      console.error('Error searching product:', error);
      toast.error('Error searching for product');
    } finally {
      setLoading(false);
    }
  };

    const startCamera = async () => {
    if (!libraryLoaded || !QrScanner) {
      toast.error('Scanner library not loaded. Please refresh.');
      return;
    }

    console.log('=== CAMERA SCANNING DEBUG ===');
    console.log('Starting camera...');
    
    setCameraError(null);
    setScanning(true);

    try {
      // Check HTTPS requirement for mobile
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

      console.log('Security check:', { 
        protocol: window.location.protocol, 
        hostname: window.location.hostname, 
        isSecure 
      });

      if (!isSecure) {
        throw new Error('HTTPS required for camera access on mobile devices');
      }

      // Check camera availability
      const hasCamera = await QrScanner.hasCamera();
      console.log('Camera availability:', hasCamera);
      
      if (!hasCamera) {
        throw new Error('No camera available on this device');
      }

      // Wait for video element
      if (!videoRef.current) {
        console.log('Waiting for video element...');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!videoRef.current) {
          throw new Error('Video element not available');
        }
      }

      console.log('Creating QR scanner instance...');

      // Create scanner with enhanced logging
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result: any) => {
          try {
            console.log('=== SCAN RESULT ===');
            console.log('Raw result:', result);
            console.log('Scanned data:', result.data);
            
            const scannedCode = result.data.trim();
            console.log('Processed code:', scannedCode);
            
            vibrateDevice();
            setQrCode(scannedCode);
            searchProduct(scannedCode);
            
            toast.success(`Code scanned: ${scannedCode}`);
            console.log('=== SCAN COMPLETE ===');
          } catch (error) {
            console.error('Error processing scan result:', error);
          }
        },
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 2,
          preferredCamera: 'environment',
        }
      );

      // Try to use rear camera for mobile
      try {
        console.log('Setting rear camera...');
        await qrScannerRef.current.setCamera('environment');
        console.log('Using rear camera');
      } catch (error) {
        console.log('Using default camera:', error);
      }

      // Start the scanner
      console.log('Starting scanner...');
      await qrScannerRef.current.start();
      setUseCamera(true);
      
      console.log('Camera started successfully');
      toast.success('Camera ready! Point at QR code or barcode');
      console.log('=== CAMERA READY ===');
      
    } catch (error: any) {
      console.error('=== CAMERA ERROR ===');
      console.error('Error details:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      setScanning(false);
      setCameraError(error.message);
      
      if (error.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access.', { duration: 6000 });
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera found on this device');
      } else if (error.name === 'NotReadableError') {
        toast.error('Camera is being used by another app');
      } else if (error.message.includes('HTTPS')) {
        toast.error('HTTPS required for camera access on mobile devices', { duration: 6000 });
      } else {
        toast.error(`Camera error: ${error.message}`);
      }
      console.log('=== CAMERA ERROR END ===');
    }
  };

  const stopCamera = () => {
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        console.log('Camera stopped');
      } catch (error) {
        console.log('Error stopping camera:', error);
      }
      qrScannerRef.current = null;
    }
    setScanning(false);
    setUseCamera(false);
    setCameraError(null);
  };

  const updateStock = async () => {
    if (!selectedProduct || quantity <= 0) return;
    
    if (operation === 'remove' && quantity > selectedProduct.quantity) {
      toast.error(`Insufficient stock. Available: ${selectedProduct.quantity}`);
      return;
    }

    if (operation === 'remove') {
      const confirmed = confirm(`Remove ${quantity} units of ${selectedProduct.name}?`);
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      if (operation === 'remove') {
        await stockAPI.reduce({
          qrCode: selectedProduct.qrCode,
          quantity: quantity,
          reason: 'Scanner reduction'
        });
      } else {
        await stockAPI.increase({
          productId: selectedProduct._id,
          quantity: quantity,
          reason: 'Scanner addition'
        });
      }

      toast.success(`${operation === 'add' ? 'Added' : 'Removed'} ${quantity} units`);
      await refreshProducts();
      searchProduct(selectedProduct.qrCode);
      
    } catch (error: any) {
      console.error('Stock update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Product Scanner
          </h1>

          {/* Status indicators */}
          <div className="bg-gray-50 border rounded-lg p-4 mb-6">
            <div className="text-sm space-y-1">
              <div>Scanner ready: {libraryLoaded ? '✅' : '⏳ Loading...'}</div>
              <div>Protocol: {typeof window !== 'undefined' ? window.location.protocol : 'unknown'}</div>
              <div>Products loaded: {products.length}</div>
            </div>
          </div>

          {/* Upload section */}
          <div className="mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-green-800 mb-2">📸 Upload Image</h3>
              <p className="text-sm text-green-600 mb-3">
                Take a photo or upload an image containing a QR code or barcode
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                capture="environment"
              />
              <button
                onClick={triggerFileUpload}
                disabled={uploading || !libraryLoaded}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {uploading ? 'Scanning...' : '📷 Take Photo / Upload Image'}
              </button>
            </div>

            <div className="text-center text-gray-400 mb-4">or</div>

            {/* Manual entry */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manual Code Entry
              </label>
              <input
                type="text"
                placeholder="Enter QR code or barcode manually"
                value={qrCode}
                onChange={(e) => {
                  const value = e.target.value;
                  setQrCode(value);
                  if (value.trim()) {
                    searchProduct(value.trim());
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="text-center text-gray-400 mb-4">or</div>

            {/* Camera section */}
            {!useCamera ? (
              <div>
                <button
                  onClick={startCamera}
                  disabled={scanning || !libraryLoaded}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {scanning ? 'Starting Camera...' : '📹 Use Camera'}
                </button>
                
                {cameraError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{cameraError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-64 bg-black rounded-lg object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg opacity-75"></div>
                  </div>
                </div>
                
                <button
                  onClick={stopCamera}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Stop Camera
                </button>
                
                <p className="text-center text-gray-600 text-sm">
                  Position code within the dashed square. Detection is automatic.
                </p>
              </div>
            )}
          </div>

          {/* Product display */}
          {selectedProduct && (
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold mb-4">Found Product</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p><strong>Name:</strong> {selectedProduct.name}</p>
                  <p><strong>Category:</strong> {selectedProduct.category}</p>
                  <p><strong>Current Stock:</strong> {selectedProduct.quantity}</p>
                </div>
                <div>
                  <p><strong>Price:</strong> £{selectedProduct.price}</p>
                  <p><strong>Code:</strong> {selectedProduct.qrCode}</p>
                  <p><strong>Min Stock:</strong> {selectedProduct.minimumStock}</p>
                </div>
              </div>

              {/* Stock operations */}
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-4">Update Stock</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Operation</label>
                    <select
                      value={operation}
                      onChange={(e) => setOperation(e.target.value)}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="add">Add Stock (+)</option>
                      <option value="remove">Remove Stock (-)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">New Total</label>
                    <div className="w-full p-3 bg-gray-100 border rounded-lg font-semibold">
                      {operation === 'add' 
                        ? selectedProduct.quantity + quantity 
                        : Math.max(0, selectedProduct.quantity - quantity)
                      }
                    </div>
                  </div>
                </div>

                <button
                  onClick={updateStock}
                  disabled={loading || (operation === 'remove' && quantity > selectedProduct.quantity)}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading ? 'Updating...' : `${operation === 'add' ? 'Add' : 'Remove'} ${quantity} Units`}
                </button>

                {operation === 'remove' && quantity > selectedProduct.quantity && (
                  <p className="text-red-600 text-sm mt-2 text-center">
                    ⚠️ Not enough stock available
                  </p>
                )}
              </div>
            </div>
          )}

          {qrCode && !selectedProduct && !loading && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                Code "{qrCode}" was scanned but no matching product found in your inventory.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}