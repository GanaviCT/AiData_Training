from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models.task import Task
from app.models.annotation import Annotation
from app.models.user import User
from app.models.qa import QAResult
import math

class AgreementService:
    @staticmethod
    def calculate_iaa(db: Session) -> Dict[str, Any]:
        # 1. Fetch all tasks that have at least one annotation
        tasks = db.query(Task).join(Annotation).all()
        
        # --- Human-Human Agreement (Fleiss' Kappa & Percentage Agreement) ---
        multi_annotated_tasks = []
        all_categories = set()
        
        for task in tasks:
            # Get latest annotation per unique user for this task
            user_annotations = {}
            for ann in task.annotations:
                if ann.created_by_id not in user_annotations:
                    user_annotations[ann.created_by_id] = ann
                else:
                    # Keep the annotation with the higher version
                    if ann.version > user_annotations[ann.created_by_id].version:
                        user_annotations[ann.created_by_id] = ann
            
            # If we have at least 2 unique annotators
            if len(user_annotations) >= 2:
                multi_annotated_tasks.append(list(user_annotations.values()))
                for ann in user_annotations.values():
                    all_categories.add(ann.label)
        
        total_human_tasks = len(multi_annotated_tasks)
        percentage_agreement = 0.0
        fleiss_kappa = 0.0
        unanimous_count = 0
        
        if total_human_tasks > 0:
            categories_list = sorted(list(all_categories))
            category_to_idx = {cat: idx for idx, cat in enumerate(categories_list)}
            num_categories = len(categories_list)
            
            p_j_numerator = [0.0] * num_categories
            total_ratings = 0
            P_i_list = []
            
            for task_annotations in multi_annotated_tasks:
                n_i = len(task_annotations)
                counts = [0] * num_categories
                for ann in task_annotations:
                    idx = category_to_idx[ann.label]
                    counts[idx] += 1
                
                # Check if all annotators chose the same label (unanimous agreement)
                if max(counts) == n_i:
                    unanimous_count += 1
                
                # Update category numerator counts
                for j in range(num_categories):
                    p_j_numerator[j] += counts[j]
                total_ratings += n_i
                
                # Calculate P_i for this task
                sum_sq_counts = sum(c * c for c in counts)
                P_i = (sum_sq_counts - n_i) / (n_i * (n_i - 1))
                P_i_list.append(P_i)
            
            # Average agreement P_bar
            P_bar = sum(P_i_list) / total_human_tasks
            percentage_agreement = (unanimous_count / total_human_tasks) * 100.0
            
            # Expected agreement P_bar_e
            if total_ratings > 0:
                p_j = [num / total_ratings for num in p_j_numerator]
                P_bar_e = sum(p * p for p in p_j)
            else:
                P_bar_e = 0.0
            
            # Calculate Kappa
            denominator = 1.0 - P_bar_e
            if denominator == 0.0:
                fleiss_kappa = 1.0 if P_bar == 1.0 else 0.0
            else:
                fleiss_kappa = (P_bar - P_bar_e) / denominator
                
        # --- Human-AI Agreement Rate ---
        # Find all annotations that were AI assisted:
        # 1. confidence < 1.0, or
        # 2. corrected_label is not None (meaning it was modified from an AI suggestion)
        ai_annotations = db.query(Annotation).filter(
            (Annotation.confidence < 1.0) | (Annotation.corrected_label != None)
        ).all()
        
        total_ai_tasks = len(ai_annotations)
        ai_agreement_rate = 100.0
        ai_accepted = 0
        ai_corrected = 0
        
        if total_ai_tasks > 0:
            for ann in ai_annotations:
                if ann.corrected_label is None:
                    ai_accepted += 1
                else:
                    ai_corrected += 1
            ai_agreement_rate = (ai_accepted / total_ai_tasks) * 100.0
            
        # --- Human-QA Agreement Rate ---
        # Look at all completed/reviewed tasks with QA Results
        qa_results = db.query(QAResult).all()
        total_qa_reviews = len(qa_results)
        qa_agreement_rate = 100.0
        qa_approved = 0
        qa_rejected = 0
        
        if total_qa_reviews > 0:
            for qa in qa_results:
                if qa.approved:
                    qa_approved += 1
                else:
                    qa_rejected += 1
            qa_agreement_rate = (qa_approved / total_qa_reviews) * 100.0
            
        # Compile detailed list of multi-annotated tasks for the UI
        detailed_tasks = []
        for task_annotations in multi_annotated_tasks:
            task = task_annotations[0].task
            detailed_tasks.append({
                "task_id": task.id,
                "type": task.type,
                "data": task.data[:80] if task.type == "text" else task.data,
                "annotations": [
                    {
                        "username": ann.created_by.username,
                        "label": ann.label,
                        "version": ann.version,
                        "created_at": ann.created_at.isoformat()
                    }
                    for ann in task_annotations
                ],
                "agreement_rate": round(sum(1 for ann in task_annotations if ann.label == task_annotations[0].label) / len(task_annotations) * 100.0, 1)
            })
            
        return {
            "human_human": {
                "total_tasks": total_human_tasks,
                "percentage_agreement": round(percentage_agreement, 1),
                "fleiss_kappa": round(max(-1.0, min(1.0, fleiss_kappa)), 3),
                "unanimous_count": unanimous_count,
                "details": detailed_tasks
            },
            "human_ai": {
                "total_tasks": total_ai_tasks,
                "agreement_rate": round(ai_agreement_rate, 1),
                "accepted": ai_accepted,
                "corrected": ai_corrected
            },
            "human_qa": {
                "total_tasks": total_qa_reviews,
                "agreement_rate": round(qa_agreement_rate, 1),
                "approved": qa_approved,
                "rejected": qa_rejected
            }
        }
