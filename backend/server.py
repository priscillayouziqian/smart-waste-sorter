import os
import sys
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# --- Initialization ---
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
load_dotenv()

# --- Configuration & Sanity Check ---
PREDICTION_URL = os.getenv("PREDICTION_URL")
PREDICTION_KEY = os.getenv("PREDICTION_KEY")

if not PREDICTION_URL or not PREDICTION_KEY:
    print("Error: PREDICTION_URL and PREDICTION_KEY must be set in your environment.")
    sys.exit(1)

@app.route("/predict", methods=["POST"])
def predict():
    """
    Receives an image file in a POST request and returns the prediction from Azure.
    """
    # Check if an image file is present in the request
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No image selected for uploading"}), 400

    try:
        image_data = file.read()
        headers = {
            "Prediction-Key": PREDICTION_KEY,
            "Content-Type": "application/octet-stream"
        }

        # Make the POST request to Azure Custom Vision
        response = requests.post(PREDICTION_URL, headers=headers, data=image_data)
        response.raise_for_status()  # Raise an exception for bad status codes

        # --- Process and Log the Response on the Server ---
        results = response.json()
        print("\n--- Prediction Results (Server Log) ---")
        for prediction in results.get("predictions", []):
            tag = prediction.get("tagName")
            probability = prediction.get("probability") * 100
            print(f"- Tag: {tag}, Probability: {probability:.2f}%")
        print("-------------------------------------\n")

        # Return the JSON response from Azure to the mobile app
        return jsonify(results)

    except requests.exceptions.HTTPError as e:
        return jsonify({"error": f"HTTP error: {e.response.status_code}", "details": e.response.text}), 500
    except Exception as e:
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

if __name__ == "__main__":
    # Run the server on all available network interfaces
    app.run(host="0.0.0.0", port=5000, debug=True)