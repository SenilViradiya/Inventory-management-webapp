import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {analyticsAPI} from '../services/api';

const DashboardScreen = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await analyticsAPI.getDashboard();
      setDashboardData(response);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Dashboard</Text>
        <Text style={styles.subtitle}>Inventory Overview</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{dashboardData?.totalProducts || 0}</Text>
          <Text style={styles.statLabel}>Total Products</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{dashboardData?.lowStock || 0}</Text>
          <Text style={styles.statLabel}>Low Stock Items</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>${dashboardData?.totalValue || 0}</Text>
          <Text style={styles.statLabel}>Inventory Value</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{dashboardData?.todaysSales || 0}</Text>
          <Text style={styles.statLabel}>Today's Sales</Text>
        </View>
      </View>

      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>📱 Mobile Features</Text>
        <Text style={styles.featureText}>✅ Barcode Scanning</Text>
        <Text style={styles.featureText}>✅ Stock Management</Text>
        <Text style={styles.featureText}>✅ Product Search</Text>
        <Text style={styles.featureText}>✅ Real-time Analytics</Text>
      </View>
    </ScrollView>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  recentSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#059669',
    marginBottom: 8,
  },
});

export default DashboardScreen;
