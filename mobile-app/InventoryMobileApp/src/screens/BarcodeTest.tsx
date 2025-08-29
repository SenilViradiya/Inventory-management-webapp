import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert} from 'react-native';

// Test component to simulate barcode scanning without actual camera
const BarcodeTest = () => {
  const testBarcode = 'ABC-abc-1234';

  const simulateBarcodeScanning = () => {
    // This simulates what happens when the barcode is scanned
    const scannedCode = testBarcode;
    
    console.log('Scanned barcode:', scannedCode);
    
    // This matches the logic from ScannerScreen.tsx
    if (scannedCode) {
      Alert.alert(
        'Barcode Scanned',
        `Successfully scanned: ${scannedCode}`,
        [
          {text: 'Update Stock', onPress: () => console.log('Update stock for:', scannedCode)},
          {text: 'View Product', onPress: () => console.log('View product:', scannedCode)},
          {text: 'Cancel', style: 'cancel'},
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Barcode Scanner Test</Text>
      <Text style={styles.subtitle}>Test barcode: {testBarcode}</Text>
      
      <TouchableOpacity style={styles.testButton} onPress={simulateBarcodeScanning}>
        <Text style={styles.buttonText}>Simulate Barcode Scan</Text>
      </TouchableOpacity>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          This test simulates scanning the barcode "ABC-abc-1234"{'\n\n'}
          In the actual app, the camera will detect this barcode automatically.{'\n\n'}
          Camera permissions are configured for both Android and iOS.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  testButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default BarcodeTest;
