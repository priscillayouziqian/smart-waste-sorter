import os
import sys
import requests
import logging
import uuid
from io import BytesIO
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from extensions import db
from PIL import Image

# --- Initialization ---
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
load_dotenv()

# --- Database Configuration ---
# Use the DATABASE_URL from environment variables for production (e.g., on Render).
# Fall back to a local SQLite database for local development.
DATABASE_URL = os.getenv("DATABASE_URL")
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or 'sqlite:///' + os.path.join(os.path.abspath(os.path.dirname(__file__)), 'history.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # Optional: to suppress a warning

# Connect the SQLAlchemy object to the Flask app
db.init_app(app)

# Import the database model. This is now safe from circular imports.
from database_models import PredictionHistory

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


# --- Configuration & Sanity Check ---
PREDICTION_URL = os.getenv("PREDICTION_URL")
PREDICTION_KEY = os.getenv("PREDICTION_KEY")

if not all([PREDICTION_URL, PREDICTION_KEY]):
    logging.error("FATAL: PREDICTION_URL and PREDICTION_KEY must be set in environment.")
    sys.exit(1)

if not DATABASE_URL:
    logging.warning("DATABASE_URL not set, falling back to local SQLite database.")

@app.route("/")
def health_check():
    """
    A simple health check endpoint to confirm the server is running.
    """
    return jsonify({"status": "ok"}), 200

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
        # Read image data into memory for prediction
        image_data = file.read()

        headers = {
            "Prediction-Key": PREDICTION_KEY,
            "Content-Type": "application/octet-stream"
        }

        # Make the POST request to Azure Custom Vision
        logging.info("Sending prediction request to Azure...")
        response = requests.post(PREDICTION_URL, headers=headers, data=image_data)
        response.raise_for_status()  # Raise an exception for bad status codes

        # --- 2. Process the response and save to database ---
        results = response.json()
        
        # Find the prediction with the highest probability
        if results.get("predictions"):
            top_prediction = max(results["predictions"], key=lambda p: p["probability"])
            tag = top_prediction.get("tagName")
            probability = top_prediction.get("probability")

            # --- Create and save a compressed thumbnail ---
            # Rewind the stream and open with Pillow
            file.seek(0)
            img = Image.open(file)
            img.thumbnail((256, 256)) # Create a thumbnail (max 256x256 pixels)
            
            # Save the thumbnail to an in-memory buffer
            thumb_io = BytesIO()
            img.save(thumb_io, 'JPEG', quality=85)
            thumbnail_data = thumb_io.getvalue()

            # Create a new history record
            new_history_entry = PredictionHistory(
                image_thumbnail=thumbnail_data,
                predicted_tag=tag,
                probability=probability
            )
            db.session.add(new_history_entry)
            db.session.commit()
            logging.info(f"Successfully saved prediction and compressed thumbnail to database.")

        # Return the JSON response from Azure to the mobile app
        return jsonify(results)

    except requests.exceptions.HTTPError as e:
        logging.error(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        return jsonify({"error": f"HTTP error: {e.response.status_code}", "details": e.response.text}), 500
    except Exception as e:
        logging.error(f"An unexpected error occurred: {str(e)}")
        return jsonify({"error": "An unexpected error occurred", "details": str(e)}), 500

@app.route("/history", methods=["GET"])
def get_history():
    """
    Retrieves the prediction history from the database.
    """
    try:
        # Query the database for all history records, ordered by the most recent first
        history_records = PredictionHistory.query.order_by(PredictionHistory.timestamp.desc()).all()

        # Convert the list of SQLAlchemy objects to a list of dictionaries
        history_list = []
        for record in history_records:
            history_list.append({
                "id": record.id,
                "predicted_tag": record.predicted_tag,
                "probability": record.probability,
                "timestamp": record.timestamp.isoformat()  # Use ISO format for consistency
            })
        return jsonify(history_list)
    except Exception as e:
        logging.error(f"An error occurred while fetching history: {str(e)}")
        return jsonify({"error": "Failed to retrieve history", "details": str(e)}), 500

@app.route("/history/image/<int:record_id>", methods=["GET"])
def get_history_image(record_id):
    """
    Retrieves a specific image thumbnail from the database by its ID.
    """
    try:
        # Find the specific history record by its primary key, or return 404
        record = PredictionHistory.query.get_or_404(record_id)

        # Use send_file to send the binary data with the correct MIME type
        return send_file(BytesIO(record.image_thumbnail), mimetype='image/jpeg')

    except Exception as e:
        logging.error(f"An error occurred while fetching image {record_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve image", "details": str(e)}), 500

if __name__ == "__main__":
    # Run the server on all available network interfaces
    app.run(host="0.0.0.0", port=5000, debug=True)