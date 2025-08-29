import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import {productsAPI} from '../services/api';

interface Product {
  _id: string;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  category: string;
  imageUrl?: string;
}

const ProductsScreen = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response);
    } catch (error) {
      console.error('Products error:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId: string, change: number) => {
    try {
      await productsAPI.updateQuantity(productId, {quantityChange: change});
      loadProducts(); // Reload to get updated data
    } catch (error) {
      console.error('Update quantity error:', error);
      Alert.alert('Error', 'Failed to update quantity');
    }
  };

  const renderProduct = ({item}: {item: Product}) => (
    <View style={styles.productCard}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productCode}>Barcode: {item.barcode}</Text>
        <Text style={styles.productPrice}>Price: ${item.price}</Text>
        <Text style={styles.productCategory}>Category: {item.category}</Text>
        <Text style={[
          styles.productQuantity,
          item.quantity <= 10 && styles.lowStock
        ]}>
          Stock: {item.quantity} {item.quantity <= 10 && '(Low Stock)'}
        </Text>
      </View>
      
      {item.imageUrl && (
        <Image source={{uri: item.imageUrl}} style={styles.productImage} />
      )}
      
      <View style={styles.quantityControls}>
        <TouchableOpacity
          style={styles.quantityButton}
          onPress={() => updateQuantity(item._id, -1)}>
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quantityButton, styles.addButton]}
          onPress={() => updateQuantity(item._id, 1)}>
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📦 Products</Text>
        <Text style={styles.subtitle}>Manage Inventory</Text>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
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
  listContainer: {
    padding: 16,
  },
  productCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  productCode: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 14,
    color: '#374151',
  },
  lowStock: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginLeft: 12,
  },
  quantityControls: {
    flexDirection: 'column',
    marginLeft: 12,
  },
  quantityButton: {
    backgroundColor: '#ef4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#10b981',
    marginBottom: 0,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ProductsScreen;
