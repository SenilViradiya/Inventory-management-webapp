import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {analyticsAPI} from '../services/api';

const AnalyticsScreen = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const response = await analyticsAPI.getAnalytics();
      setAnalytics(response);
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading Analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📈 Analytics</Text>
        <Text style={styles.subtitle}>Performance Insights</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>📦 Total Products</Text>
          <Text style={styles.statValue}>{analytics?.totalProducts || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statTitle}>💰 Total Value</Text>
          <Text style={styles.statValue}>${analytics?.totalValue || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statTitle}>⚠️ Low Stock</Text>
          <Text style={styles.statValue}>{analytics?.lowStockCount || 0}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statTitle}>🛒 Today's Sales</Text>
          <Text style={styles.statValue}>{analytics?.todaysSales || 0}</Text>
        </View>
      </View>

      <View style={styles.trendsSection}>
        <Text style={styles.sectionTitle}>📊 Trends</Text>
        <Text style={styles.trendItem}>• Stock levels trending upward</Text>
        <Text style={styles.trendItem}>• Sales performance good</Text>
        <Text style={styles.trendItem}>• Inventory turnover optimal</Text>
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
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
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
  statTitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  trendsSection: {
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
  trendItem: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
  },
});

export default AnalyticsScreen;
