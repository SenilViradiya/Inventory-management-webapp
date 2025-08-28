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
    console.log('📚 Loading scanning libraries...');
    
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
  const [cameraActive, setCameraActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add debug log
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugLogs(prev => [...prev.slice(-20), logMessage]); // Keep last 20 logs
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Load scanning libraries on mount
  useEffect(() => {
    loadScanningLibraries().then((libs) => {
      if (libs.QrScanner || libs.Quagga) {
        setLibrariesLoaded(true);
        addDebugLog('🎉 Scanning libraries ready!');
      } else {
        addDebugLog('❌ Failed to load scanning libraries');
        toast.error('Scanner libraries failed to load. Please refresh the page.');
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Vibration feedback
  const vibrateDevice = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([200]);
        addDebugLog('📳 Device vibration triggered');
      }
    } catch (error) {
      addDebugLog('📳 Vibration not supported');
    }
  };

  // Enhanced file scanning with multiple detection methods
  const scanFromFile = async (file: File) => {
    if (!file) return;

    addDebugLog('🔍 === STARTING FILE SCAN ===');
    addDebugLog(`📁 File: ${file.name} (${file.type}, ${(file.size/1024).toFixed(1)}KB)`);

    setUploading(true);
    let foundCode = false;

    try {
      if (!file.type.startsWith('image/')) {
        addDebugLog('❌ Invalid file type');
        toast.error('Please select an image file (JPG, PNG, etc.)');
        return;
      }

      const imageUrl = URL.createObjectURL(file);
      addDebugLog(`🖼️ Image URL created: ${imageUrl.substring(0, 50)}...`);

      // Method 1: Try QR code scanning first
      if (QrScanner) {
        try {
          addDebugLog('🔍 Method 1: QR Scanner');
          const qrResult = await QrScanner.scanImage(file, {
            returnDetailedScanResult: true,
          });

          if (qrResult && qrResult.data) {
            const scannedCode = qrResult.data.trim();
            addDebugLog(`✅ QR Code found: ${scannedCode}`);
            
            foundCode = true;
            vibrateDevice();
            setQrCode(scannedCode);
            await searchProduct(scannedCode);
            toast.success(`QR Code scanned: ${scannedCode}`);
            return;
          }
        } catch (qrError) {
          addDebugLog(`❌ QR Scanner failed: ${qrError}`);
        }
      }

      // Method 2: Try browser BarcodeDetector
      if (!foundCode && 'BarcodeDetector' in window) {
        try {
          addDebugLog('🔍 Method 2: Browser BarcodeDetector');
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'upc_e']
          });
          
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageUrl;
          });

          addDebugLog(`📐 Image dimensions: ${img.width}x${img.height}`);
          
          const barcodes = await barcodeDetector.detect(img);
          addDebugLog(`🔍 BarcodeDetector found ${barcodes.length} codes`);
          
          if (barcodes.length > 0) {
            const scannedCode = barcodes[0].rawValue.trim();
            addDebugLog(`✅ Barcode found: ${scannedCode}`);
            
            foundCode = true;
            vibrateDevice();
            setQrCode(scannedCode);
            await searchProduct(scannedCode);
            toast.success(`Barcode scanned: ${scannedCode}`);
            return;
          }
        } catch (browserError) {
          addDebugLog(`❌ BarcodeDetector failed: ${browserError}`);
        }
      }

      // Method 3: Try QuaggaJS for barcode scanning
      if (!foundCode && Quagga) {
        try {
          addDebugLog('🔍 Method 3: QuaggaJS');
          
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imageUrl;
          });

          addDebugLog(`📐 QuaggaJS processing: ${img.width}x${img.height}`);

          const result = await new Promise<any>((resolve) => {
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            
            if (!ctx) {
              addDebugLog('❌ Canvas context unavailable');
              resolve(null);
              return;
            }

            const targetSize = Math.max(img.width, img.height, 640);
            tempCanvas.width = targetSize;
            tempCanvas.height = targetSize;
            
            // Center the image on canvas
            const offsetX = (targetSize - img.width) / 2;
            const offsetY = (targetSize - img.height) / 2;
            ctx.drawImage(img, offsetX, offsetY);

            addDebugLog(`🔧 Canvas prepared: ${tempCanvas.width}x${tempCanvas.height}`);

            Quagga.decodeSingle({
              src: tempCanvas.toDataURL('image/jpeg', 0.9),
              numOfWorkers: 0,
              inputStream: {
                size: targetSize
              },
              locator: {
                patchSize: "medium",
                halfSample: false
              },
              decoder: {
                readers: [
                  "code_128_reader",
                  "ean_reader",
                  "ean_8_reader", 
                  "code_39_reader",
                  "code_39_vin_reader",
                  "codabar_reader",
                  "i2of5_reader"
                ],
                debug: {
                  showCanvas: false,
                  showPatches: false,
                  showFoundPatches: false,
                  showSkeleton: false,
                  showLabels: false,
                  showPatchLabels: false,
                  showRemainingPatchLabels: false,
                  boxFromPatches: {
                    showTransformed: false,
                    showTransformedBox: false,
                    showBB: false
                  }
                }
              }
            }, (result: any) => {
              resolve(result);
            });
          });

          if (result && result.codeResult) {
            const scannedCode = result.codeResult.code.trim();
            addDebugLog(`✅ QuaggaJS Barcode found: ${scannedCode}`);
            
            foundCode = true;
            vibrateDevice();
            setQrCode(scannedCode);
            await searchProduct(scannedCode);
            toast.success(`Barcode scanned: ${scannedCode}`);
            return;
          } else {
            addDebugLog('❌ QuaggaJS found no codes');
          }
        } catch (quaggaError) {
          addDebugLog(`❌ QuaggaJS failed: ${quaggaError}`);
        }
      }

      // No codes found
      if (!foundCode) {
        addDebugLog('❌ No codes detected by any method');
        toast.error('No QR code or barcode found in image. Try a clearer image.');
      }

    } catch (error) {
      addDebugLog(`❌ Scan error: ${error}`);
      toast.error('Error scanning image: ' + (error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      addDebugLog('🏁 === FILE SCAN COMPLETE ===');
    }
  };

  const searchProduct = async (code: string) => {
    if (!code) return;
    
    addDebugLog(`🔍 Searching for product with code: ${code}`);
    addDebugLog(`📦 Available products: ${products.length}`);
    
    setLoading(true);
    try {
      const product = products.find(p => 
        p.qrCode === code.trim() || 
        p.qrCode.toLowerCase() === code.trim().toLowerCase()
      );
      
      if (product) {
        setSelectedProduct(product);
        addDebugLog(`✅ Product found: ${product.name}`);
        toast.success(`Product found: ${product.name}`);
      } else {
        setSelectedProduct(null);
        addDebugLog(`❌ No product found for code: ${code}`);
        addDebugLog(`Available codes: ${products.map(p => p.qrCode).join(', ')}`);
        toast.error(`Product not found for code: ${code}`);
      }
    } catch (error) {
      addDebugLog(`❌ Search error: ${error}`);
      toast.error('Error searching for product');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      addDebugLog(`📁 File selected: ${file.name}`);
      scanFromFile(file);
    }
  };

  const triggerFileUpload = () => {
    if (!librariesLoaded) {
      toast.error('Scanner is still loading. Please wait.');
      return;
    }
    fileInputRef.current?.click();
  };

  const startCamera = async () => {
    if (!librariesLoaded || !QrScanner) {
      toast.error('Scanner library not loaded. Please refresh.');
      return;
    }

    addDebugLog('📷 === STARTING CAMERA ===');
    
    setCameraError(null);
    setScanning(true);
    // Don't set useCamera true here - wait for camera to actually start

    try {
      const isSecure = window.location.protocol === 'https:' || 
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

      addDebugLog(`🔒 Security check: ${window.location.protocol} on ${window.location.hostname} = ${isSecure}`);

      if (!isSecure) {
        throw new Error('HTTPS required for camera access on mobile devices');
      }

      const hasCamera = await QrScanner.hasCamera();
      addDebugLog(`📷 Camera available: ${hasCamera}`);
      
      if (!hasCamera) {
        throw new Error('No camera available on this device');
      }

      // Wait for video element to be rendered in DOM
      let attempts = 0;
      const maxAttempts = 20; // 2 seconds max wait
      
      while (!videoRef.current && attempts < maxAttempts) {
        addDebugLog(`⏳ Waiting for video element... (attempt ${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!videoRef.current) {
        throw new Error('Video element not available after waiting');
      }

      addDebugLog(`✅ Video element ready: ${videoRef.current.tagName}`);
      addDebugLog('🎯 Creating scanner instance...');

      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result: any) => {
          try {
            const scannedCode = result.data.trim();
            addDebugLog(`✅ Camera scanned: ${scannedCode}`);
            
            vibrateDevice();
            setQrCode(scannedCode);
            searchProduct(scannedCode);
            
            toast.success(`Code scanned: ${scannedCode}`);
          } catch (error) {
            addDebugLog(`❌ Camera scan error: ${error}`);
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

      try {
        addDebugLog('📱 Setting rear camera...');
        await qrScannerRef.current.setCamera('environment');
        addDebugLog('✅ Using rear camera');
      } catch (error) {
        addDebugLog('⚠️ Using default camera');
      }

      addDebugLog('▶️ Starting camera...');
      await qrScannerRef.current.start();
      setUseCamera(true);
      setCameraActive(true);
      
      addDebugLog('✅ Camera ready!');
      toast.success('Camera ready! Point at QR code or barcode');
      
    } catch (error: any) {
      addDebugLog(`❌ Camera error: ${error.message}`);
      setScanning(false);
      setCameraActive(false);
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
    }
  };

  const stopCamera = () => {
    addDebugLog('⏹️ Stopping camera...');
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop();
        qrScannerRef.current.destroy();
        addDebugLog('✅ Camera stopped');
      } catch (error) {
        addDebugLog(`⚠️ Camera stop error: ${error}`);
      }
      qrScannerRef.current = null;
    }
    setScanning(false);
    setUseCamera(false);
    setCameraActive(false);
    setCameraError(null);
  };

  const handleCameraCapture = async () => {
    if (!videoRef.current || !cameraActive) {
      addDebugLog('❌ Camera not ready for capture');
      toast.error('Camera not ready');
      return;
    }

    try {
      addDebugLog('📸 Capturing camera frame...');
      
      // Create canvas to capture current video frame
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        addDebugLog('❌ Canvas context not available');
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      addDebugLog(`📐 Captured frame: ${canvas.width}x${canvas.height}`);

      // Convert to blob and process like a file upload
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          addDebugLog(`📁 Created file from capture: ${file.name}`);
          await scanFromFile(file);
        }
      }, 'image/jpeg', 0.9);

    } catch (error) {
      addDebugLog(`❌ Camera capture error: ${error}`);
      toast.error('Failed to capture camera frame');
    }
  };

  const updateStock = async () => {
    if (!selectedProduct) return;

    setLoading(true);
    addDebugLog(`📦 Updating stock for ${selectedProduct.name}: ${operation} ${quantity}`);
    
    try {
      const newQuantity = operation === 'add' 
        ? selectedProduct.quantity + quantity
        : selectedProduct.quantity - quantity;

      addDebugLog(`🔢 Current: ${selectedProduct.quantity}, Change: ${quantity}, New: ${newQuantity}`);

      if (newQuantity < 0) {
        addDebugLog('❌ Insufficient stock');
        toast.error('Insufficient stock');
        return;
      }

      if (operation === 'add') {
        await stockAPI.increase({
          productId: selectedProduct._id,
          quantity: quantity,
          reason: 'Scanner restock'
        });
      } else {
        await stockAPI.reduce({
          qrCode: selectedProduct.qrCode,
          quantity: quantity,
          reason: 'Scanner sale'
        });
      }

      await refreshProducts();
      toast.success(`Stock updated successfully`);
      
      setSelectedProduct(null);
      setQrCode('');
      setQuantity(1);
      addDebugLog('✅ Stock update complete');
      
    } catch (error) {
      addDebugLog(`❌ Update error: ${error}`);
      toast.error('Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
    addDebugLog('🧹 Debug logs cleared');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Scanner</h1>
          <p className="text-gray-600">
            Scan QR codes or barcodes to quickly update inventory
          </p>
          
          {!librariesLoaded && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">📚 Loading scanner libraries...</p>
            </div>
          )}
        </div>

        <div className="grid gap-6">
          {/* Scanning Options */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Scan Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* File Upload */}
              <button
                onClick={triggerFileUpload}
                disabled={uploading || !librariesLoaded}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50"
              >
                <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium">
                  {uploading ? 'Scanning...' : 'Upload Image'}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  JPG, PNG, etc.
                </span>
              </button>

              {/* Camera Toggle */}
              <button
                onClick={useCamera ? stopCamera : startCamera}
                disabled={scanning || !librariesLoaded}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors disabled:opacity-50 ${
                  useCamera ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-green-500'
                }`}
              >
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">
                  {useCamera ? 'Stop Camera' : (scanning ? 'Starting...' : 'Use Camera')}
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  Live scanning
                </span>
              </button>

              {/* Debug Console Toggle */}
              <button
                onClick={() => setDebugLogs(prev => prev.length > 0 ? [] : ['🔧 Debug console activated'])}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 transition-colors"
              >
                <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="text-sm font-medium">Debug Console</span>
                <span className="text-xs text-gray-500 mt-1">
                  {debugLogs.length > 0 ? 'Clear logs' : 'Show logs'}
                </span>
              </button>
            </div>

            {/* Camera Error */}
            {cameraError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">❌ Camera Error: {cameraError}</p>
              </div>
            )}
          </div>

          {/* Camera Video */}
          {useCamera && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <video
                ref={videoRef}
                className="w-full rounded-lg"
                style={{ maxHeight: '400px', minHeight: '300px' }}
                autoPlay
                playsInline
                muted
              />
              <p className="text-center text-gray-600 mt-2">
                Point camera at QR code or barcode
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    addDebugLog('📸 Manual capture triggered');
                    handleCameraCapture();
                  }}
                  disabled={!cameraActive}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  Capture Frame
                </button>
                <button
                  onClick={stopCamera}
                  className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
                >
                  Stop Camera
                </button>
              </div>
            </div>
          )}

          {/* Manual Code Entry */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-medium mb-3">Manual Entry</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Enter QR code or barcode manually"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => searchProduct(qrCode)}
                disabled={!qrCode || loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Debug Console */}
          {debugLogs.length > 0 && (
            <div className="bg-black rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-green-400">🔧 Debug Console</h3>
                <button
                  onClick={clearDebugLogs}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Clear
                </button>
              </div>
              <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
                {debugLogs.map((log, index) => (
                  <div key={index} className="text-green-300 text-sm font-mono mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Details */}
          {selectedProduct && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium mb-3">Product Found</h3>
              <div className="flex items-start gap-4">
                {selectedProduct.image && (
                  <img
                    src={`http://localhost:5000${selectedProduct.image}`}
                    alt={selectedProduct.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h4 className="text-xl font-semibold">{selectedProduct.name}</h4>
                  <p className="text-gray-600">Price: ${selectedProduct.price}</p>
                  <p className="text-gray-600">Current Stock: {selectedProduct.quantity}</p>
                  <p className="text-gray-600">Category: {selectedProduct.category}</p>
                </div>
              </div>

              {/* Stock Update Controls */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Operation
                  </label>
                  <select
                    value={operation}
                    onChange={(e) => setOperation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="add">Add Stock</option>
                    <option value="remove">Remove Stock</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action
                  </label>
                  <button
                    onClick={updateStock}
                    disabled={loading}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : `${operation === 'add' ? 'Add' : 'Remove'} ${quantity}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
