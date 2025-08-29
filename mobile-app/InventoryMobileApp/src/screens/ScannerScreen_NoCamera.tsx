import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {productsAPI} from '../services/api';

const ScannerScreen = () => {
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleManualScan = async () => {
    if (!manualCode.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Please enter a barcode',
      });
      return;
    }

    await handleBarcodeDetection(manualCode.trim());
  };

  const handleBarcodeDetection = async (code: string) => {
    console.log('Barcode detected:', code);
    setIsProcessing(true);

    try {
      // Try to find product by barcode
      const response = await productsAPI.getAll();
      const products = response.data.products || response.data;
      const product = products.find((p: any) => 
        p.qrCode === code || p.barcode === code || p.sku === code
      );

      if (product) {
        Alert.alert(
          'Product Found',
          `${product.name}\nCurrent Stock: ${product.quantity}\nPrice: $${product.price}`,
          [
            {
              text: 'Update Stock',
              onPress: () => showStockUpdateDialog(product),
            },
            {text: 'Cancel', style: 'cancel'},
          ]
        );
      } else {
        Alert.alert(
          'Product Not Found',
          `No product found with code: ${code}\n\nWould you like to add it?`,
          [
            {text: 'Add Product', onPress: () => console.log('Add product:', code)},
            {text: 'Cancel', style: 'cancel'},
          ]
        );
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Toast.show({
        type: 'error',
        text1: 'Error processing barcode',
      });
    } finally {
      setIsProcessing(false);
      setManualCode('');
    }
  };

  const showStockUpdateDialog = (product: any) => {
    Alert.prompt(
      'Update Stock',
      `Current stock: ${product.quantity}`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Update',
          onPress: async (newQuantity?: string) => {
            if (newQuantity && !isNaN(parseInt(newQuantity))) {
              try {
                await productsAPI.update(product._id, {quantity: parseInt(newQuantity)});
                Toast.show({
                  type: 'success',
                  text1: 'Stock updated successfully',
                });
              } catch (error) {
                Toast.show({
                  type: 'error',
                  text1: 'Error updating stock',
                });
              }
            }
          },
        },
      ],
      'plain-text',
      product.quantity.toString()
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory Scanner</Text>
        <Text style={styles.subtitle}>Scan or enter barcode manually</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Entry</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter barcode (e.g., ABC-abc-1234)"
          value={manualCode}
          onChangeText={setManualCode}
          autoCapitalize="none"
        />
        <TouchableOpacity 
          style={[styles.scanButton, isProcessing && styles.scanButtonDisabled]} 
          onPress={handleManualScan}
          disabled={isProcessing}
        >
          <Text style={styles.scanButtonText}>
            {isProcessing ? 'Processing...' : 'Process Barcode'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Barcode</Text>
        <TouchableOpacity 
          style={styles.testButton}
          onPress={() => setManualCode('ABC-abc-1234')}
        >
          <Text style={styles.testButtonText}>Use Test Barcode: ABC-abc-1234</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <Text style={styles.infoText}>
          1. Enter a barcode manually{'\n'}
          2. Tap "Process Barcode"{'\n'}
          3. View product details{'\n'}
          4. Update stock quantities{'\n\n'}
          Camera scanning will be available in the next update!
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    margin: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default ScannerScreen;
