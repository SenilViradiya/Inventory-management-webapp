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
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              try {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                addDebugLog(`📐 Canvas prepared: ${canvas.width}x${canvas.height}`);
                
                // Use QuaggaJS
                Quagga.decodeSingle({
                  src: canvas.toDataURL(),
                  numOfWorkers: 0,
                  inputStream: {
                    size: 800
                  },
                  decoder: {
                    readers: [
                      "code_128_reader",
                      "code_39_reader", 
                      "ean_reader",
                      "ean_8_reader",
                      "code_93_reader"
                    ]
                  },
                }, (result: any) => {
                  if (result && result.codeResult) {
                    const scannedCode = result.codeResult.code.trim();
                    addDebugLog(`✅ QuaggaJS found: ${scannedCode}`);
                    
                    foundCode = true;
                    vibrateDevice();
                    setQrCode(scannedCode);
                    searchProduct(scannedCode);
                    toast.success(`Barcode scanned: ${scannedCode}`);
                  } else {
                    addDebugLog('❌ QuaggaJS found no codes');
                  }
                  resolve();
                });
              } catch (error) {
                addDebugLog(`❌ QuaggaJS error: ${error}`);
                reject(error);
              }
            };
            
            img.onerror = reject;
            img.src = imageUrl;
          });
          
        } catch (quaggaError) {
          addDebugLog(`❌ QuaggaJS failed: ${quaggaError}`);
        }
      }

      // If no code found
      if (!foundCode) {
        addDebugLog('❌ No codes detected by any method');
        toast.error('No QR code or barcode found. Please ensure the code is clear and try again.');
        
        // Create a downloadable image for manual inspection
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `debug-${file.name}`;
        addDebugLog(`💾 Debug image available: ${file.name}`);
      }

    } catch (error) {
      addDebugLog(`❌ SCANNING ERROR: ${error}`);
      console.error('Scanning error details:', error);
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

      if (!videoRef.current) {
        addDebugLog('⏳ Waiting for video element...');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!videoRef.current) {
          throw new Error('Video element not available');
        }
      }

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
      
      addDebugLog('✅ Camera ready!');
      toast.success('Camera ready! Point at QR code or barcode');
      
    } catch (error: any) {
      addDebugLog(`❌ Camera error: ${error.message}`);
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
      if (operation === 'add') {
        await stockAPI.increase({ productId: selectedProduct._id, quantity });
        toast.success(`Added ${quantity} units to ${selectedProduct.name}`);
      } else {
        await stockAPI.reduce({ qrCode: selectedProduct.qrCode, quantity });
        toast.success(`Removed ${quantity} units from ${selectedProduct.name}`);
      }
      
      await refreshProducts();
      setSelectedProduct(null);
      setQrCode('');
      setQuantity(1);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update stock');
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
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Barcode/QR Scanner</h1>
          
          {/* Debug Panel */}
          <div className="mb-6 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-green-300 font-bold">🔧 Debug Console</h3>
              <button
                onClick={clearDebugLogs}
                className="text-green-400 hover:text-green-300 text-xs"
              >
                Clear
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {debugLogs.slice(-10).map((log, index) => (
                <div key={index} className="text-xs">{log}</div>
              ))}
              {debugLogs.length === 0 && <div className="text-gray-500">No debug logs yet...</div>}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Scanner Section */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Scan Method</h2>
                
                {/* File Upload */}
                <div className="space-y-4">
                  <button
                    onClick={triggerFileUpload}
                    disabled={!librariesLoaded || uploading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Scanning Image...' : '📷 Upload Image to Scan'}
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <div className="text-center text-gray-500">or</div>
                  
                  {/* Camera Toggle */}
                  {!useCamera ? (
                    <button
                      onClick={startCamera}
                      disabled={!librariesLoaded || scanning}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {scanning ? 'Starting Camera...' : '📹 Start Camera Scanner'}
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700"
                    >
                      ⏹️ Stop Camera
                    </button>
                  )}
                  
                  {cameraError && (
                    <div className="text-red-600 text-sm mt-2">
                      ⚠️ {cameraError}
                    </div>
                  )}
                </div>
              </div>

              {/* Camera Video */}
              {useCamera && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <video
                    ref={videoRef}
                    className="w-full rounded-lg"
                    style={{ maxHeight: '300px' }}
                  />
                  <p className="text-center text-gray-600 mt-2">
                    Point camera at QR code or barcode
                  </p>
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
                    placeholder="Enter QR code or barcode"
                    className="flex-1 p-2 border rounded-lg"
                  />
                  <button
                    onClick={() => searchProduct(qrCode)}
                    disabled={!qrCode.trim() || loading}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            {/* Product Actions */}
            <div className="space-y-6">
              {selectedProduct ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Product Found</h2>
                  <div className="space-y-4">
                    <div className="border-l-4 border-green-500 pl-4">
                      <h3 className="font-medium">{selectedProduct.name}</h3>
                      <p className="text-gray-600">Code: {selectedProduct.qrCode}</p>
                      <p className="text-gray-600">Category: {selectedProduct.category}</p>
                      <p className="text-gray-600">Price: ${selectedProduct.price.toFixed(2)}</p>
                      <p className="text-gray-600">Current Stock: {selectedProduct.quantity}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Operation
                      </label>
                      <select
                        value={operation}
                        onChange={(e) => setOperation(e.target.value)}
                        className="w-full p-2 border rounded-lg"
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
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <button
                      onClick={updateStock}
                      disabled={loading || quantity <= 0}
                      className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : `${operation === 'add' ? 'Add' : 'Remove'} ${quantity} Unit(s)`}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-8 text-center">
                  <div className="text-gray-400 text-6xl mb-4">📱</div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Scan a Code</h3>
                  <p className="text-gray-600">
                    Upload an image or use camera to scan QR codes and barcodes
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
