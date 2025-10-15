# Smart Waste Sorter

A full-stack mobile application that uses a phone's camera and an image classification model to identify waste items. The app sends an image to a backend server, which communicates with the Azure Custom Vision service to classify the item and return the top predictions.

## Features

-   **Image Classification**: Identifies waste items using a trained Azure Custom Vision model.
-   **React Native App**: Cross-platform mobile app built with Expo.
-   **Camera & Gallery**: Users can take a new photo or select an existing one from their device's gallery.
-   **Python Backend**: A Flask API acts as a secure bridge between the app and the Azure service.
-   **Top Results**: Displays the top 3 predictions with their confidence scores.

## Technologies Used

-   **Frontend**: React Native, Expo
-   **Backend**: Python, Flask, Gunicorn
-   **Cloud AI**: Microsoft Azure Custom Vision
-   **Deployment**: Render (for the backend API)

## Project Structure

This repository is a monorepo containing two main parts:
-   **`backend/`**: A Python Flask server that communicates with the **Azure Custom Vision** prediction API.
-   **`frontend/smart-waste-sorter-app/`**: A React Native mobile app built with Expo.

## Running the Application

### Option 1: Run Locally

This method runs both the frontend and backend on your local machine. It's ideal for development and testing.

Backend: backend/python server.py

Frontend: frontend/smart-waste-sorter-app/npx expo start

**run both commands in different terminals**

### Option 2: Run with a Deployed Backend (Render)

This method connects your local frontend to the live backend server deployed on Render.

1.  **Configure Frontend Environment:**
    -   Navigate to the `frontend/smart-waste-sorter-app` directory.
    -   Create or open the `.env` file.
    -   Update the `EXPO_PUBLIC_API_URL` to point to your live Render service URL.
        ```
        # Replace with your actual Render URL
        EXPO_PUBLIC_API_URL="https://your-app-name.onrender.com/predict"
        ```

2.  **Start the Frontend App:**
    (Ensure you are in the `frontend/smart-waste-sorter-app` directory)
    ```bash
    npx expo start
    ```
    Scan the QR code with the Expo Go app on your phone. The app will now communicate with the live server.
