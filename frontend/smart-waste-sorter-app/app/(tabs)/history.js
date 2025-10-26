import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// The API_URL from .env should be the base URL of your service.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const HistoryItem = ({ item }) => {
  const imageUrl = `${API_BASE_URL}/history/image/${item.id}`;
  const probabilityPercent = (item.probability * 100).toFixed(1);

  return (
    <View style={styles.itemContainer}>
      {/* Conditionally render image or a placeholder icon */}
      {item.probability !== null ? (
        <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.iconPlaceholder]}>
          <Ionicons name="text" size={40} color="#8E8E93" />
        </View>
      )}
      <View style={styles.infoContainer}>
        <Text style={styles.tagText}>{item.predicted_tag}</Text>
        {/* Conditionally render confidence score */}
        {item.probability !== null && (
          <Text style={styles.detailText}>Confidence: {probabilityPercent}%</Text>
        )}
        <Text style={styles.detailText}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false); // Start with false, as fetch is triggered by focus
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      // Don't set loading to true on manual refresh, only on initial load if needed
      const response = await fetch(`${API_BASE_URL}/history`);
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history:", error);
      alert('Failed to load history. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // This effect runs every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true); // Show loader when screen is focused
      fetchHistory().finally(() => setLoading(false));
    }, [fetchHistory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  if (loading) {
    return <ActivityIndicator size="large" style={styles.centered} />;
  }

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => <HistoryItem item={item} />}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.centered}>No history found.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { backgroundColor: '#f0f0f0' },
  listContent: { padding: 10 },
  itemContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  thumbnail: { width: 80, height: 80, borderRadius: 8, marginRight: 10 },
  iconPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoContainer: { flex: 1, justifyContent: 'center' },
  tagText: { fontSize: 18, fontWeight: 'bold', textTransform: 'capitalize' },
  detailText: { fontSize: 14, color: '#666', marginTop: 4 },
});