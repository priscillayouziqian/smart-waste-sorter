from flask_sqlalchemy import SQLAlchemy

# Create the extension instance without an app.
# It will be connected to the app later.
db = SQLAlchemy()