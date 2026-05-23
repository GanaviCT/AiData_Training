import sys
import os

# Set python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.qa import QAService

def test():
    db = SessionLocal()
    try:
        service = QAService(db)
        
        # Check current tasks
        from app.models.task import Task
        completed_count = db.query(Task).filter(Task.status == 'completed').count()
        print(f"Total completed tasks in DB: {completed_count}")
        
        # Test default sample
        sample_all = service.get_audit_sample()
        print(f"Sampled all pending completed tasks: {len(sample_all)}")
        for t in sample_all:
            print(f"  - Task ID {t.id}, Type {t.type}, Cost {t.cost}")
            
        # Test percentage sample
        sample_pct = service.get_audit_sample(percentage=50.0)
        print(f"Sampled 50% of pending completed tasks: {len(sample_pct)}")
        
        # Test count sample
        sample_cnt = service.get_audit_sample(count=1)
        print(f"Sampled 1 task: {len(sample_cnt)}")
        
    finally:
        db.close()

if __name__ == '__main__':
    test()
