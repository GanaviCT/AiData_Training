import os
import pickle
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from app.models.annotation import Annotation
from app.models.qa import QAResult
from app.models.task import Task

MODEL_PATH = "model.pkl"

class TrainingService:
    @staticmethod
    def train_model(db: Session) -> dict:
        # Fetch annotations where the related QAResult is approved
        annotations = (
            db.query(Annotation)
            .join(QAResult, Annotation.id == QAResult.annotation_id)
            .filter(QAResult.approved == True)
            .all()
        )

        # Filter only text tasks
        data_samples = [
            (ann.task.data, ann.label)
            for ann in annotations
            if ann.task and ann.task.type == "text"
        ]

        if not data_samples:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No approved text tasks found to train the model. Please approve some annotations first."
            )

        X = [sample[0] for sample in data_samples]
        y = [sample[1] for sample in data_samples]

        # Check number of unique classes
        unique_classes = set(y)
        if len(unique_classes) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"At least 2 distinct classes are required to train the model. Found only: {list(unique_classes)}"
            )

        # Build and train pipeline
        pipeline = Pipeline([
            ('vectorizer', CountVectorizer()),
            ('classifier', LogisticRegression())
        ])
        
        pipeline.fit(X, y)

        # Save model
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(pipeline, f)

        return {
            "message": "Model trained successfully",
            "samples_trained": len(X),
            "classes": list(unique_classes)
        }

    @staticmethod
    def predict(text: str) -> dict:
        if not os.path.exists(MODEL_PATH):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model file not found. Please train the model first by calling POST /api/train-model"
            )

        try:
            with open(MODEL_PATH, "rb") as f:
                pipeline = pickle.load(f)
            
            prediction = pipeline.predict([text])[0]
            
            # Predict probabilities if supported
            try:
                probabilities = pipeline.predict_proba([text])[0]
                confidence = float(max(probabilities))
            except Exception:
                confidence = 1.0

            return {
                "text": text,
                "predicted_label": prediction,
                "confidence": round(confidence, 4)
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Prediction failed: {str(e)}"
            )
