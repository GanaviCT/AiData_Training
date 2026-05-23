import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_assignment_email(username: str, task_id: int, task_type: str, recipient_email: str, role: str = "annotator"):
        from app.services.queue import BackgroundQueueService
        BackgroundQueueService.enqueue("EMAIL", {
            "email_type": "assignment",
            "username": username,
            "task_id": task_id,
            "task_type": task_type,
            "recipient_email": recipient_email,
            "role": role
        })

    @staticmethod
    def send_assignment_email_sync(username: str, task_id: int, task_type: str, recipient_email: str, role: str = "annotator"):
        subject = f"🆕 TrainLyft AI: Task #{task_id:03d} Assigned to You"
        
        # Route dynamically depending on user role
        target_page = "annotation"
        if role == "reviewer":
            target_page = "qa"
        elif role == "admin":
            target_page = "tasks"
            
        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0f172a; padding: 15px; text-align: center; border-radius: 6px 6px 0 0;">
              <h2 style="color: #38bdf8; margin: 0;">TrainLyft AI Platform</h2>
            </div>
            <div style="padding: 20px;">
              <p>Hello <strong>@{username}</strong>,</p>
              <p>A new training task has been assigned to you by the administrator.</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; width: 30%;">Task ID</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">#{task_id:03d}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Task Type</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; text-transform: capitalize;">{task_type}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Status</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;"><span style="background-color: #ecfeff; color: #0891b2; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">In Progress</span></td>
                </tr>
              </table>
              
              <p>Please log in to your dashboard to complete the annotation workspace.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="http://192.168.1.97:3000/?page={target_page}" style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">Go to Workspace</a>
              </div>
              
              <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                <strong>Note:</strong> If you are opening this on your phone, make sure you are connected to the same Wi-Fi network as your Mac. You can also open this link directly in your browser:
                <br />
                <code style="background-color: #f1f5f9; color: #0f172a; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 5px; font-size: 11px;">http://192.168.1.97:3000/?page={target_page}</code>
              </p>
            </div>
            <div style="font-size: 11px; color: #64748b; text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an automated notification from the TrainLyft AI Platform. Please do not reply directly to this message.
            </div>
          </body>
        </html>
        """
        
        logger.info(f"Triggering assignment email notification for @{username} to {recipient_email}")
        print(f"\n=======================================================")
        print(f"📧 [EMAIL SENT] To: {recipient_email}")
        print(f"📧 Subject: {subject}")
        print(f"📧 Task ID: #{task_id:03d} ({task_type})")
        print(f"=======================================================\n")
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USERNAME or "notifications@trainlyft-ai.com"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html_content, "html"))
        
        try:
            # SSL port connection vs TLS port connection setup
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5.0)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5.0)
                if settings.SMTP_USE_TLS:
                    server.starttls()
            
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                
            server.sendmail(msg["From"], [recipient_email], msg.as_string())
            server.quit()
            logger.info("Email successfully sent via SMTP.")
        except Exception as e:
            logger.warning(f"SMTP delivery skipped: {e} (Email logged to console instead).")

    @staticmethod
    def send_qa_review_email(
        submitter_username: str,
        reviewer_username: str,
        recipient_email: str,
        task_id: int,
        task_type: str,
        task_data: str,
        label: str,
        confidence: float,
        approved: bool,
        comments: str
    ):
        from app.services.queue import BackgroundQueueService
        BackgroundQueueService.enqueue("EMAIL", {
            "email_type": "qa_review",
            "submitter_username": submitter_username,
            "reviewer_username": reviewer_username,
            "recipient_email": recipient_email,
            "task_id": task_id,
            "task_type": task_type,
            "task_data": task_data,
            "label": label,
            "confidence": confidence,
            "approved": approved,
            "comments": comments
        })

    @staticmethod
    def send_qa_review_email_sync(
        submitter_username: str,
        reviewer_username: str,
        recipient_email: str,
        task_id: int,
        task_type: str,
        task_data: str,
        label: str,
        confidence: float,
        approved: bool,
        comments: str
    ):
        decision = "✅ Approved" if approved else "❌ Rejected"
        decision_color = "#10b981" if approved else "#ef4444"
        status_bg = "#ecfdf5" if approved else "#fef2f2"
        subject = f"{'✅' if approved else '❌'} TrainLyft AI: Task #{task_id:03d} has been {('Approved' if approved else 'Rejected')}"

        # Truncate long text data for email display
        display_data = task_data[:150] + "..." if len(task_data) > 150 else task_data

        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0f172a; padding: 15px; text-align: center; border-radius: 6px 6px 0 0;">
              <h2 style="color: #38bdf8; margin: 0;">TrainLyft AI Platform</h2>
              <p style="color: #94a3b8; font-size: 12px; margin: 5px 0 0;">Quality Assurance Review Notification</p>
            </div>
            <div style="padding: 20px;">
              <p>Hello <strong>@{submitter_username}</strong>,</p>
              <p>Your annotation submission has been reviewed by <strong>@{reviewer_username}</strong>.</p>

              <div style="background-color: {status_bg}; border: 2px solid {decision_color}; border-radius: 8px; padding: 12px; text-align: center; margin: 20px 0;">
                <span style="font-size: 18px; font-weight: bold; color: {decision_color};">{decision}</span>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold; width: 35%;">Task ID</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">#{task_id:03d}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Task Type</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; text-transform: capitalize;">{task_type}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Payload</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-size: 12px; word-break: break-word;">
                    {f'"{display_data}"' if task_type == 'text' else f'<a href="{display_data}" style="color: #0ea5e9;">View Image</a>'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Submitted Label</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">
                    <span style="background-color: #ecfeff; color: #0891b2; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold;">{label}</span>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Confidence</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">{confidence * 100:.0f}%</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Submitted by</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">@{submitter_username}</td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Reviewed by</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">@{reviewer_username} (Admin)</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Decision</td>
                  <td style="padding: 10px; border: 1px solid #cbd5e1;">
                    <span style="color: {decision_color}; font-weight: bold;">{decision}</span>
                  </td>
                </tr>
                {'<tr style="background-color: #f8fafc;"><td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Reviewer Comments</td><td style="padding: 10px; border: 1px solid #cbd5e1;">' + comments + '</td></tr>' if comments else ''}
              </table>

              {'<p style="color: #ef4444; font-weight: bold;">⚠️ Your task has been returned to the queue for re-annotation. Please log in to review the feedback and re-submit.</p>' if not approved else '<p style="color: #10b981;">Your annotation has been verified and approved. Great work! 🎉</p>'}

            </div>
            <div style="font-size: 11px; color: #64748b; text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              This is an automated notification from the TrainLyft AI Platform. Please do not reply directly to this message.
            </div>
          </body>
        </html>
        """

        logger.info(f"Triggering QA review email for @{submitter_username} to {recipient_email}")
        print(f"\n=======================================================")
        print(f"📧 [QA REVIEW EMAIL SENT] To: {recipient_email}")
        print(f"📧 Subject: {subject}")
        print(f"📧 Task ID: #{task_id:03d} ({task_type}) | Label: {label} | Decision: {decision}")
        print(f"📧 Submitted by: @{submitter_username} | Reviewed by: @{reviewer_username}")
        if comments:
            print(f"📧 Comments: {comments}")
        print(f"=======================================================\n")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USERNAME or "notifications@trainlyft-ai.com"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html_content, "html"))

        try:
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5.0)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5.0)
                if settings.SMTP_USE_TLS:
                    server.starttls()

            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            server.sendmail(msg["From"], [recipient_email], msg.as_string())
            server.quit()
            logger.info("QA review email successfully sent via SMTP.")
        except Exception as e:
            logger.warning(f"SMTP delivery skipped for QA review: {e} (Email logged to console instead).")
