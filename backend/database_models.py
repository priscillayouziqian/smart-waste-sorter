from extensions import db
from datetime import datetime

class PredictionHistory(db.Model):
    """
    Represents a single prediction record in the database.
    Maps to the 'prediction_history' table.
    """
    __tablename__ = 'prediction_history'

    id = db.Column(db.Integer, primary_key=True)
    # Store the compressed image thumbnail data directly in the database
    image_thumbnail = db.Column(db.LargeBinary, nullable=True)
    predicted_tag = db.Column(db.String(100), nullable=False)
    probability = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        """
        Provides a developer-friendly string representation of the object.
        """
        if self.probability is not None:
            return f'<PredictionHistory {self.id}: {self.predicted_tag} ({self.probability:.2f}%)>'
        else:
            return f'<PredictionHistory {self.id}: {self.predicted_tag} (Text-based)>'