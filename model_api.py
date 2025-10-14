import requests
import json
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

    except FileNotFoundError:
        print(f"Error: The file '{image_path}' was not found. Please check the path.")
    except requests.exceptions.HTTPError as e:
        print(f"An HTTP error occurred: {e.response.status_code} {e.response.reason}")
        print(f"Response body: {e.response.text}")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred while making the request: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")


if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Predict waste type from a local image using Azure Custom Vision."
    )
    parser.add_argument("image_path", help="Path to the local image file for prediction.")
    args = parser.parse_args()

    # Call the prediction function with the provided image path
    predict_local_image(args.image_path)
