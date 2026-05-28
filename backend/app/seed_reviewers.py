from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def seed_reviewers():
    db = SessionLocal()
    try:
        reviewers_to_seed = [
            {
                "username": "hg_reviewer",
                "password": "hg_reviewer123",
                "email": "hg_reviewer@hginfotech.io",
                "role": "reviewer"
            },
            {
                "username": "client_reviewer",
                "password": "client_reviewer123",
                "email": "client_reviewer@client.com",
                "role": "reviewer"
            }
        ]

        for u_data in reviewers_to_seed:
            existing = db.query(User).filter(User.username == u_data["username"]).first()
            if existing:
                print(f"User {u_data['username']} already exists. Updating email and role.")
                existing.email = u_data["email"]
                existing.role = u_data["role"]
                existing.hashed_password = get_password_hash(u_data["password"])
            else:
                print(f"Creating user {u_data['username']}...")
                user = User(
                    username=u_data["username"],
                    hashed_password=get_password_hash(u_data["password"]),
                    email=u_data["email"],
                    role=u_data["role"],
                    gdpr_consent=True
                )
                db.add(user)
        db.commit()
        print("Reviewers seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding reviewers: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_reviewers()
