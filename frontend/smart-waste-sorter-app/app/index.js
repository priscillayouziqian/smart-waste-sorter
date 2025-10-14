import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// --- Configuration ---
// The API URL is loaded from an environment variable.
// See the .env.example file for more information.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function App() {
  // Sanity check to ensure the environment variable is set.
  if (!API_URL) {
    Alert.alert("Configuration Error", "The API URL is not configured. Please create a .env file in the frontend/smart-waste-sorter-app directory. See .env.example for details.");
  }
  const [selectedImage, setSelectedImage] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function to pick an image from the gallery
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
      setPredictions([]); // Clear previous predictions
      handleUpload(result.assets[0]);
    }
  };

  // Function to upload the image and get predictions
  const handleUpload = async (image) => {
    setIsLoading(true);
    const formData = new FormData();

    // The 'uri' needs to be formatted correctly for FormData
    formData.append('file', {
      uri: Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
      name: image.uri.split('/').pop(), // a file name
      type: `image/${image.uri.split('.').pop()}`, // e.g., image/jpeg
    });

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get prediction');
      }

      setPredictions(result.predictions || []);
    } catch (error) {
      console.error("Upload Error:", error);
      Alert.alert("Error", `Failed to get prediction: ${error.message}`);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart Waste Sorter</Text>
      <Button title="Select an Image" onPress={pickImage} />

      {selectedImage && (
        <Image source={{ uri: selectedImage.uri }} style={styles.image} />
      )}

      {isLoading && <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />}

      {predictions.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Prediction Results:</Text>
          {predictions.map((p, index) => (
            <Text key={index} style={styles.resultText}>
              - {p.tagName}: {(p.probability * 100).toFixed(2)}%
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  resultsContainer: { marginTop: 20, alignItems: 'flex-start' },
  resultsTitle: { fontSize: 18, fontWeight: 'bold' },
  resultText: { fontSize: 16, marginTop: 4 },
});