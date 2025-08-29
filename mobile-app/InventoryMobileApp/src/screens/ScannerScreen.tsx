import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {productsAPI} from '../services/api';

const ScannerScreen = () => {
  const [barcode, setBarcode] = useState('');
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async () => {
    if (!barcode.trim()) {
      Alert.alert('Error', 'Please enter a barcode');
      return;
    }

    setLoading(true);
    try {
      const product = await productsAPI.getByBarcode(barcode.trim());
      if (product) {
        setScannedProduct(product);
        Alert.alert(
          'Product Found!',
          `${product.name}\nStock: ${product.quantity}\nPrice: $${product.price}`
        );
      } else {
        Alert.alert('Not Found', 'Product not found in inventory');
        setScannedProduct(null);
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Error', 'Failed to scan product');
      setScannedProduct(null);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (change: number) => {
    if (!scannedProduct) return;

    try {
      await productsAPI.updateQuantity(scannedProduct._id, change);
      
      // Refresh product data
      const updatedProduct = await productsAPI.getByBarcode(barcode);
      setScannedProduct(updatedProduct);
      
      Alert.alert(
        'Success', 
        `Quantity ${change > 0 ? 'increased' : 'decreased'} successfully!`
      );
    } catch (error) {
      console.error('Update quantity error:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const clearScan = () => {
    setBarcode('');
    setScannedProduct(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 Barcode Scanner</Text>
        <Text style={styles.subtitle}>Scan or Enter Barcode</Text>
      </View>

      <View style={styles.scannerContainer}>
        <TextInput
          style={styles.barcodeInput}
          placeholder="Enter barcode (e.g., ABC-abc-1234)"
          value={barcode}
          onChangeText={setBarcode}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.scanButton, loading && styles.buttonDisabled]}
          onPress={handleScan}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.scanButtonText}>🔍 Scan Product</Text>
          )}
        </TouchableOpacity>

        {scannedProduct && (
          <View style={styles.productCard}>
            <Text style={styles.productName}>{scannedProduct.name}</Text>
            <Text style={styles.productBarcode}>Barcode: {scannedProduct.barcode}</Text>
            <Text style={styles.productPrice}>Price: ${scannedProduct.price}</Text>
            <Text style={styles.productCategory}>Category: {scannedProduct.category}</Text>
            <Text style={[
              styles.productQuantity,
              scannedProduct.quantity <= 10 && styles.lowStock
            ]}>
              Stock: {scannedProduct.quantity} 
              {scannedProduct.quantity <= 10 && ' (Low Stock)'}
            </Text>

            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => updateQuantity(-1)}>
                <Text style={styles.buttonText}>Remove 1</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.quantityButton, styles.addButton]}
                onPress={() => updateQuantity(1)}>
                <Text style={styles.buttonText}>Add 1</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.clearButton} onPress={clearScan}>
          <Text style={styles.clearButtonText}>🗑️ Clear</Text>
        </TouchableOpacity>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
          <Text style={styles.instructionText}>• Enter barcode manually</Text>
          <Text style={styles.instructionText}>• Try: ABC-abc-1234 (demo)</Text>
          <Text style={styles.instructionText}>• View product details</Text>
          <Text style={styles.instructionText}>• Update stock quantities</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  scannerContainer: {
    flex: 1,
    padding: 20,
  },
  barcodeInput: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  productBarcode: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  productQuantity: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
  },
  lowStock: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  quantityControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quantityButton: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    flex: 0.48,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#6b7280',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
});

export default ScannerScreen;
