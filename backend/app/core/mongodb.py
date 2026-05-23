from pymongo import MongoClient
from app.core.config import settings

# Global MongoClient singleton
client = MongoClient(settings.MONGO_URL)
db = client[settings.MONGO_DB_NAME]

def get_mongo_db():
    """
    Get the MongoDB database instance.
    """
    return db

def get_mongo_client():
    """
    Get the MongoDB client instance.
    """
    return client
