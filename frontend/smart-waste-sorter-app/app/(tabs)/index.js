import React, { useState } from 'react';
import { StyleSheet, View, Image, Alert, Platform, Linking } from 'react-native';
import { Button, Text, ActivityIndicator, Portal, Dialog, Card } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

// --- Configuration ---
// The API URL is loaded from an environment variable.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

// --- Waste Category Mapping (based on NYC rules) ---
const WASTE_CATEGORIES = {
  recyclable: {
    tags: ['cardboard', 'plastic', 'metal', 'glass', 'paper'],
    color: '#007AFF', // Blue for Recyclable
  },
  compostable: {
    tags: ['leaf', 'vegetation', 'food organics'],
    color: '#34C759', // Green for Compostable
  },
  landfill: {
    tags: ['miscellaneous trash'],
    color: '#8E8E93' }, // Gray for Landfill
};

const getCategory = (tagName) => {
  for (const category in WASTE_CATEGORIES) {
    if (WASTE_CATEGORIES[category].tags.includes(tagName.toLowerCase())) return category;
  }
  return 'landfill'; // Default to landfill if not found
};

export default function PredictScreen() {
  // Sanity check to ensure the environment variable is set.
  if (!API_URL) {
    Alert.alert("Configuration Error", "The API URL is not configured. Please create a .env file. See .env.example for details.");
  }
  const [selectedImage, setSelectedImage] = useState(null);
  const [classificationResult, setClassificationResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogVisible, setIsDialogVisible] = useState(false);

  // Permissions state
  const [cameraPermissionInformation, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [mediaLibraryPermissionInformation, requestMediaLibraryPermission] = MediaLibrary.usePermissions();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
      setClassificationResult(null); // Clear previous result
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
      setClassificationResult(null);
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

    // Handle case where permissions are denied
    const cameraDenied = cameraPermissionInformation.status === ImagePicker.PermissionStatus.DENIED;
    const mediaDenied = mediaLibraryPermissionInformation.status === MediaLibrary.PermissionStatus.DENIED;

    if (cameraDenied || mediaDenied) {
      Alert.alert(
        "Insufficient Permissions",
        "To use this feature, you need to grant camera and media library access in your device settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]
      );
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
      const response = await fetch(`${API_URL}/predict`, {
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

      // Process the prediction to determine the category
      if (result.predictions && result.predictions.length > 0) {
        const topPrediction = result.predictions.sort((a, b) => b.probability - a.probability)[0];
        const category = getCategory(topPrediction.tagName);
        
        setClassificationResult({
          category: category,
          color: WASTE_CATEGORIES[category].color,
          item: topPrediction.tagName,
          confidence: topPrediction.probability,
        });
        setIsDialogVisible(true);
      } else {
        setClassificationResult(null);
      }
    } catch (error) {
      console.error("Upload Error:", error);
      Alert.alert("Error", `Failed to get prediction: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const hideDialog = () => setIsDialogVisible(false);

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button icon="image" mode="contained" onPress={pickImage}>Select Image</Button>
        <Button icon="camera" mode="contained" onPress={takePhoto}>Take Photo</Button>
      </View>

      {selectedImage && (
        <Image source={{ uri: selectedImage.uri }} style={styles.image} />
      )}

      {isLoading && <ActivityIndicator animating={true} size="large" style={{ marginVertical: 20 }} />}

      {/* This Card will display the result on the main screen after the dialog is dismissed */}
      {classificationResult && !isLoading && !isDialogVisible && (
        <Card style={styles.resultCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.resultCardCategory}>{classificationResult.category.toUpperCase()}</Text>
            <Text variant="bodyLarge">Item: <Text style={styles.bold}>{classificationResult.item}</Text></Text>
            <Text variant="bodyLarge">Confidence: <Text style={styles.bold}>{(classificationResult.confidence * 100).toFixed(2)}%</Text></Text>
          </Card.Content>
        </Card>
      )}

      {classificationResult && (
        <Portal>
          <Dialog visible={isDialogVisible} onDismiss={hideDialog}>
            <Dialog.Title style={styles.resultCardCategory}>{classificationResult.category.toUpperCase()}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyLarge" style={styles.resultCardText}>Item: <Text style={styles.bold}>{classificationResult.item}</Text></Text>
              <Text variant="bodyLarge" style={styles.resultCardText}>Confidence: <Text style={styles.bold}>{(classificationResult.confidence * 100).toFixed(2)}%</Text></Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={hideDialog}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 20, // Adds space between the buttons
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  resultCard: {
    width: '90%',
    marginTop: 20,
  },
  resultCardCategory: {
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  resultCardText: {
    marginTop: 4,
  },
  bold: {
    fontWeight: 'bold',
  },
});
