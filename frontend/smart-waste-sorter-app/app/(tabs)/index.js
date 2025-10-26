import React, { useState } from 'react';
import { StyleSheet, View, Image, Alert, Platform, Linking, ScrollView } from 'react-native';
import { Button, Text, ActivityIndicator, Portal, Dialog, Card, TextInput } from 'react-native-paper';
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
  const [textDescription, setTextDescription] = useState('');
  const [showTextFallback, setShowTextFallback] = useState(false);

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
      setShowTextFallback(false); // Hide fallback on new image selection
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
      setShowTextFallback(false); // Hide fallback on new photo
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

        // Conditionally show the text input fallback
        if (topPrediction.probability < 0.85) {
          setShowTextFallback(true);
        } else {
          setShowTextFallback(false);
        }
        
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

  // Function to get prediction from text description
  const handleTextPrediction = async () => {
    if (!textDescription.trim()) {
      Alert.alert("Input Required", "Please enter a description of the item.");
      return;
    }

    setIsLoading(true);
    setSelectedImage(null); // Clear any selected image
    setClassificationResult(null);
    setShowTextFallback(false); // Hide the fallback after using it

    try {
      const response = await fetch(`${API_URL}/predict-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: textDescription }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to get text-based prediction');
      }

      // The backend now returns a simplified object
      setClassificationResult({
        category: result.category,
        color: WASTE_CATEGORIES[result.category]?.color || '#8E8E93', // Use optional chaining and a fallback color
        item: result.item,
        confidence: null, // Confidence is not applicable for text predictions
      });
      setIsDialogVisible(true);
      setTextDescription(''); // Clear the input field for a better user experience

    } catch (error) {
      console.error("Text Prediction Error:", error);
      Alert.alert("Error", `Failed to get prediction: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const hideDialog = () => setIsDialogVisible(false);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.buttonContainer}>
        <Button icon="image" mode="contained" onPress={pickImage}>Select Image</Button>
        <Button icon="camera" mode="contained" onPress={takePhoto}>Take Photo</Button>
      </View>
      {isLoading && <ActivityIndicator animating={true} size="large" style={{ marginVertical: 20 }} />}

      {/* This Card will display the result on the main screen after the dialog is dismissed */}
      {classificationResult && !isLoading && !isDialogVisible && (
        <Card style={styles.resultCard}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.resultCardCategory}>{classificationResult.category.toUpperCase()}</Text>
            <Text variant="bodyLarge">Item: <Text style={styles.bold}>{classificationResult.item}</Text></Text>
            {classificationResult.confidence !== null && (
              <Text variant="bodyLarge">Confidence: <Text style={styles.bold}>{(classificationResult.confidence * 100).toFixed(2)}%</Text></Text>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Conditionally render the text input section as a fallback */}
      {showTextFallback && !isLoading && (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackText}>Not the right prediction? Describe the item instead.</Text>
          <TextInput
            label="Describe the item (e.g., 'greasy pizza box')"
            value={textDescription}
            onChangeText={setTextDescription}
            style={styles.textInput}
          />
          <Button 
            icon="text-box-search" 
            mode="contained" 
            onPress={handleTextPrediction} 
            style={styles.textButton}
          >Predict from Description</Button>
        </View>
      )}

      {selectedImage && (
        <Image source={{ uri: selectedImage.uri }} style={styles.image} />
      )}

      {classificationResult && (
        <Portal>
          <Dialog visible={isDialogVisible} onDismiss={hideDialog}>
            <Dialog.Title style={styles.resultCardCategory}>{classificationResult.category.toUpperCase()}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyLarge" style={styles.resultCardText}>Item: <Text style={styles.bold}>{classificationResult.item}</Text></Text>
              {classificationResult.confidence !== null && (
                <Text variant="bodyLarge" style={styles.resultCardText}>Confidence: <Text style={styles.bold}>{(classificationResult.confidence * 100).toFixed(2)}%</Text></Text>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={hideDialog}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, // Use flexGrow to allow the container to expand and enable scrolling
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
  fallbackContainer: {
    width: '100%',
    marginTop: 30,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 20,
  },
  fallbackText: {
    fontSize: 16,
    color: 'gray',
    marginBottom: 15,
    textAlign: 'center',
  },
  textInput: {
    width: '100%',
    marginBottom: 15,
  },
  textButton: { width: '100%', marginBottom: 20 },
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
