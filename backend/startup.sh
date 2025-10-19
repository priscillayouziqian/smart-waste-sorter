#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# This script is run by Render to start the application.

echo "--- Running database migrations ---"
python -c 'from server import app, db; app.app_context().push(); db.create_all()'

echo "--- Starting Gunicorn server ---"
gunicorn server:app