import os
import sys
import requests
import logging
import uuid
import openai
import json
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
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

if not all([PREDICTION_URL, PREDICTION_KEY]):
    logging.error("FATAL: PREDICTION_URL and PREDICTION_KEY must be set in environment.")
    sys.exit(1)

if not all([AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT_NAME]):
    logging.warning("Azure OpenAI environment variables are not fully set. The /predict-text endpoint will not work.")
    openai_client = None
else:
    openai_client = openai.AzureOpenAI(
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
        api_key=AZURE_OPENAI_KEY,
        api_version="2024-02-01" # A recent, stable API version
    )

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

@app.route("/predict-text", methods=["POST"])
def predict_text():
    """
    Receives a text description and uses Azure OpenAI to classify it.
    """
    if not openai_client:
        return jsonify({"error": "Azure OpenAI service is not configured on the server."}), 503

    data = request.get_json()
    if not data or 'description' not in data:
        return jsonify({"error": "Request must include a 'description' field."}), 400

    user_description = data['description']
    logging.info(f"Received text prediction request for: '{user_description}'")

    # This is the "System Prompt" that instructs the AI on how to behave.
    system_prompt = (
        "You are an expert waste sorting assistant for New York City. Based on the user's description of an item, "
        "determine if it is 'recyclable', 'compostable', or 'landfill'. "
        "Also, provide a simple, common name for the item. "
        "Respond ONLY with a valid JSON object containing 'category' and 'item'. "
        "Example: {\"category\": \"recyclable\", \"item\": \"plastic bottle\"}"
    )

    try:
        response = openai_client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_NAME,
            response_format={"type": "json_object"}, # Enforce JSON output
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_description}
            ]
        )

        # Extract the JSON string from the response
        result_json_string = response.choices[0].message.content
        logging.info(f"Received from OpenAI: {result_json_string}")

        # Parse the JSON string into a Python dictionary
        result_data = json.loads(result_json_string)

        # --- Save the text prediction to the database ---
        # We don't have an image, so image_thumbnail will be None.
        # We don't have a probability score, so probability will be None.
        text_history_entry = PredictionHistory(
            image_thumbnail=None,
            predicted_tag=result_data.get('item'),
            probability=None  # OpenAI does not provide a confidence score
        )
        db.session.add(text_history_entry)
        db.session.commit()
        logging.info(f"Successfully saved text prediction to database.")


        # The result_data should be like {"category": "...", "item": "..."}
        return jsonify(result_data)

    except json.JSONDecodeError:
        logging.error(f"Failed to decode JSON from OpenAI response: {result_json_string}")
        return jsonify({"error": "AI returned an invalid format."}), 500
    except Exception as e:
        logging.error(f"An error occurred with Azure OpenAI: {str(e)}")
        return jsonify({"error": "An error occurred while communicating with the AI service."}), 500

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