import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

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

  // Permissions state
  const [cameraPermissionInformation, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [mediaLibraryPermissionInformation, requestMediaLibraryPermission] = MediaLibrary.usePermissions();

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

  // Function to verify permissions and then launch the camera
  const takePhoto = async () => {
    const hasPermission = await verifyPermissions();
    if (!hasPermission) {
      return;
    }

    const image = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!image.canceled) {
      setSelectedImage(image.assets[0]);
      setPredictions([]);
      // Save the photo to the device's library
      await MediaLibrary.saveToLibraryAsync(image.assets[0].uri);
      Alert.alert("Success", "Photo saved to your library!");
      handleUpload(image.assets[0]);
    }
  };

  // Helper function to request camera permissions
  async function verifyPermissions() {
    // Request camera permissions if not determined
    if (cameraPermissionInformation.status === ImagePicker.PermissionStatus.UNDETERMINED) {
      const cameraResponse = await requestCameraPermission();
      if (!cameraResponse.granted) {
        Alert.alert("Insufficient Permissions", "You need to grant camera permissions to take a photo.");
        return false;
      }
    }

    // Request media library permissions if not determined
    if (mediaLibraryPermissionInformation.status === MediaLibrary.PermissionStatus.UNDETERMINED) {
      const mediaResponse = await requestMediaLibraryPermission();
      if (!mediaResponse.granted) {
        Alert.alert("Insufficient Permissions", "You need to grant media library permissions to save the photo.");
        return false;
      }
    }

    if (cameraPermissionInformation.status === ImagePicker.PermissionStatus.DENIED || mediaLibraryPermissionInformation.status === MediaLibrary.PermissionStatus.DENIED) {
      Alert.alert("Insufficient Permissions", "Please grant camera and media library permissions in your device settings to use this feature.");
      return false;
    }

    return true;
  }

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
      <View style={styles.buttonContainer}>
        <Button title="Select an Image" onPress={pickImage} />
        <Button title="Take a Photo" onPress={takePhoto} />
      </View>

      {selectedImage && (
        <Image source={{ uri: selectedImage.uri }} style={styles.image} />
      )}

      {isLoading && <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 20 }} />}

      {predictions.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Top 3 Predictions:</Text>
          {predictions
            .sort((a, b) => b.probability - a.probability) // Sort by probability descending
            .slice(0, 3) // Get the top 3
            .map((p, index) => (
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
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