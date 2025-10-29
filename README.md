# Smart Waste Sorter

A full-stack mobile application that uses Azure AI to identify waste items. Users can either take a photo for image classification or type a description for text-based analysis.

Link to demo video: [https://youtu.be/vm62C0FWiR8](https://youtu.be/vm62C0FWiR8)

-   **Image Classification**: Uses a trained **Azure Custom Vision** model to identify waste from a photo.
-   **Text-Based Prediction**: Uses **Azure OpenAI Service** (GPT) to determine the waste category from a user's text description.
-   **Prediction History**: Saves image-based predictions with thumbnails for later review.

## How to Start the App

### Option 1: Run Locally

This method runs both the frontend and backend on your local machine. It's ideal for development and testing.

1.  **Start the Backend:**
    (From the project root directory)

    ```bash
    python backend/server.py
    ```

2.  **Start the Frontend:**
    (From the `frontend/smart-waste-sorter-app` directory)

    ```bash
    npx expo start
    ```

**run both commands in different terminals**

### Option 2: Run with a Deployed Backend (Render)

This method connects your local frontend to the live backend server deployed on Render.

1.  **Configure Frontend Environment:**
    -   Navigate to the `frontend/smart-waste-sorter-app` directory.
    -   Create or open the `.env` file.
    -   Update the `EXPO_PUBLIC_API_URL` to point to your live Render service URL.

        ```
        # Replace with your actual Render service base URL
        EXPO_PUBLIC_API_URL="https://your-app-name.onrender.com"
        ```

2.  **Start the Frontend App:**
    (Ensure you are in the `frontend/smart-waste-sorter-app` directory)

    ```bash
    npx expo start
    ```

## How It's Made

### Technologies Used

-   **Frontend**: React Native, Expo
-   **Backend**: Python, Flask, Gunicorn
-   **Cloud AI**: Microsoft Azure Custom Vision, Azure OpenAI Service
-   **Deployment**: Render (for the backend API)

### Project Structure

This repository contains two main parts:

-   **`backend/`**: A Python Flask server that communicates with the **Azure Custom Vision** prediction API.
-   **`frontend/smart-waste-sorter-app/`**: A React Native mobile app built with Expo.

## Optimization

Future improvements could include:
-   **Image Compression**: Compressing images on the client-side before uploading to reduce bandwidth and improve response times.

-   **Model Retraining**: Periodically retraining the Azure Custom Vision model with new user-submitted images to improve accuracy.

## Lessons Learned

-   **Cloud AI Services**: trained and deployed classification model via Azure Cloud Platform, integrated cloud api with the app.
-   **Mobile Development Challenges**: handled camera permissions and managed image data across platforms.

## My Other Projects

**Job Application Tracker:** [https://github.com/priscillayouziqian/job-application-tracker](https://github.com/priscillayouziqian/job-application-tracker) <br>
**Member Management Panel:** [https://github.com/priscillayouziqian/Final-project-memberServicePanelApp](https://github.com/priscillayouziqian/Final-project-memberServicePanelApp) <br>
