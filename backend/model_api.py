import requests
import argparse
import os
from dotenv import load_dotenv
import sys

# Load environment variables from a .env file
load_dotenv()

# --- Configuration ---

# Load from environment variables
PREDICTION_URL = os.getenv("PREDICTION_URL")
PREDICTION_KEY = os.getenv("PREDICTION_KEY")
RENDER_BACKEND_URL = os.getenv("RENDER_BACKEND_URL")

# --- Sanity Check ---
if not PREDICTION_URL or not PREDICTION_KEY:
    print("Error: PREDICTION_URL and PREDICTION_KEY must be set in your environment.")
    print("Please create a .env file and add the variables there.")
    sys.exit(1)

def predict_local_image(image_path):
    """
    Sends a local image file to the Azure Custom Vision prediction endpoint.
    """
    try:
        # Read the image file in binary mode
        with open(image_path, "rb") as image_data:
            headers = {
                "Prediction-Key": PREDICTION_KEY,
                "Content-Type": "application/octet-stream" # Use 'application/octet-stream' for local files
            }
            
            print(f"Sending request to {PREDICTION_URL}...")
            
            # Make the POST request
            response = requests.post(PREDICTION_URL, headers=headers, data=image_data)
            
            # Raise an exception for bad status codes (4xx or 5xx)
            response.raise_for_status()
            
            # --- Process the Response ---
            print("Request successful!")
            
            # The response is in JSON format
            results = response.json()
            
            print("\n--- Prediction Results ---")
            # Nicely print the JSON output
            # print(json.dumps(results, indent=4))
            
            # You can also iterate through predictions
            for prediction in results.get("predictions", []):
                tag = prediction.get("tagName")
                probability = prediction.get("probability") * 100
                print(f"- Tag: {tag}, Probability: {probability:.2f}%")

    except requests.exceptions.HTTPError as e:
        print(f"An HTTP error occurred: {e.response.status_code} {e.response.reason}")
        print(f"Response body: {e.response.text}")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while making the request: {e}")
    except FileNotFoundError:
        print(f"Error: The file '{image_path}' was not found. Please check the path.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

def predict_from_text(description):
    """
    Sends a text description to the local Flask server's /predict-text endpoint.
    """
    # The URL for your local server
    url = "http://127.0.0.1:5000/predict-text"
    # Use the deployed Render URL if available, otherwise default to the local server.
    base_url = RENDER_BACKEND_URL or "http://127.0.0.1:5000"
    url = f"{base_url}/predict-text"

    headers = {"Content-Type": "application/json"}
    payload = {"description": description}

    try:
        print(f"Sending text prediction request to: {url}")
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()

        print("Request successful!")
        results = response.json()

        print("\n--- Text Prediction Result ---")
        print(f"- Item: {results.get('item')}")
        print(f"- Category: {results.get('category')}")

    except requests.exceptions.HTTPError as e:
        print(f"An HTTP error occurred: {e.response.status_code} - {e.response.text}")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while making the request: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Test prediction endpoints. Use --image for Azure Custom Vision or --text for local text prediction."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image", dest="image_path", help="Path to a local image file for prediction via Azure.")
    group.add_argument("--text", dest="text_description", help="A text description for prediction via the local server.")
    args = parser.parse_args()

    if args.image_path:
        predict_local_image(args.image_path)
    elif args.text_description:
        predict_from_text(args.text_description)
