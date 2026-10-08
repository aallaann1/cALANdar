import smtplib
from email.message import EmailMessage
from email.utils import make_msgid
import mimetypes
import os
from urllib.parse import unquote
from app.core.config import settings

def _get_logo_data(team_logo: str):
    if not team_logo:
        return None, None
    try:
        filename = unquote(team_logo.split('/')[-1])
        upload_dir = os.path.abspath(settings.UPLOAD_DIR)
        filepath = os.path.join(upload_dir, filename)
        if not os.path.exists(filepath):
            filepath = os.path.join("uploads", filename)
        if os.path.exists(filepath):
            image_cid = make_msgid()[1:-1]
            with open(filepath, 'rb') as f:
                img_data = f.read()
            maintype, subtype = mimetypes.guess_type(filepath)[0].split('/')
            return image_cid, (img_data, maintype, subtype)
    except Exception as e:
        print(f"Error reading logo: {e}")
    return None, None

def _get_base_url(request=None):
    if request:
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
        if host:
            return f"{proto}://{host}"
    return settings.FRONTEND_URL

def send_member_welcome_email(to_email: str, team_name: str, team_logo: str, request=None):
    msg = EmailMessage()
    msg['Subject'] = f"Bienvenue dans l'équipe {team_name}"
    msg['From'] = f"{settings.SMTP_SENDER_NAME} <{settings.SMTP_SENDER_EMAIL}>"
    msg['To'] = to_email
    msg.set_content("Veuillez utiliser un client mail supportant le HTML.")
    
    frontend_url = _get_base_url(request)
    
    image_cid, logo_details = _get_logo_data(team_logo)
    logo_html = f'<div style="text-align: center; margin-bottom: 24px;"><img src="cid:{image_cid}" alt="Logo" style="max-height: 72px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>' if image_cid else ''

    html_content = f"""
    <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            </style>
        </head>
        <body style="font-family: 'Inter', sans-serif; background-color: #f8fafc; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
                {logo_html}
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.5px;">cALANdar</span>
                </div>
                <h1 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 12px; line-height: 1.3;">Bienvenue dans l'équipe <span style="color: #2563eb;">{team_name}</span></h1>
                <p style="font-size: 15px; color: #64748b; line-height: 1.6; text-align: center; margin-bottom: 32px;">Vous avez été invité(e) à rejoindre l'équipe sur cALANdar pour consulter votre planning partagé.</p>
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="{frontend_url}" style="background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">Accéder à mon planning</a>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0;">Connectez-vous de façon sécurisée avec votre compte Google ({to_email}).</p>
                </div>
            </div>
        </body>
    </html>
    """
    msg.add_alternative(html_content, subtype='html')
    
    if image_cid and logo_details:
        img_data, maintype, subtype = logo_details
        msg.get_payload()[1].add_related(img_data, maintype=maintype, subtype=subtype, cid=f"<{image_cid}>")
    
    _send_email(msg)

def send_manager_welcome_email(to_email: str, team_name: str, team_logo: str, request=None):
    msg = EmailMessage()
    msg['Subject'] = f"Vous êtes gestionnaire de l'équipe {team_name}"
    msg['From'] = f"{settings.SMTP_SENDER_NAME} <{settings.SMTP_SENDER_EMAIL}>"
    msg['To'] = to_email
    msg.set_content("Veuillez utiliser un client mail supportant le HTML.")
    
    frontend_url = _get_base_url(request)
    
    image_cid, logo_details = _get_logo_data(team_logo)
    logo_html = f'<div style="text-align: center; margin-bottom: 24px;"><img src="cid:{image_cid}" alt="Logo" style="max-height: 72px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></div>' if image_cid else ''

    html_content = f"""
    <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            </style>
        </head>
        <body style="font-family: 'Inter', sans-serif; background-color: #f8fafc; padding: 40px 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
                {logo_html}
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.5px;">cALANdar</span>
                </div>
                <h1 style="color: #0f172a; text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 12px; line-height: 1.3;">Nouveau rôle : <span style="color: #10b981;">Gestionnaire</span></h1>
                <p style="font-size: 15px; color: #64748b; line-height: 1.6; text-align: center; margin-bottom: 32px;">Vous avez été désigné(e) comme gestionnaire de l'équipe <strong>{team_name}</strong>. Vous pouvez dès à présent créer des créneaux et gérer votre équipe.</p>
                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="{frontend_url}" style="background: linear-gradient(135deg, #10b981 0%, #34d399 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">Accéder à la gestion</a>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                    <p style="font-size: 13px; color: #94a3b8; text-align: center; margin: 0;">Connectez-vous de façon sécurisée avec votre compte Google ({to_email}).</p>
                </div>
            </div>
        </body>
    </html>
    """
    msg.add_alternative(html_content, subtype='html')
    
    if image_cid and logo_details:
        img_data, maintype, subtype = logo_details
        msg.get_payload()[1].add_related(img_data, maintype=maintype, subtype=subtype, cid=f"<{image_cid}>")

    _send_email(msg)

def _send_email(msg):
    try:
        if settings.SMTP_TLS and settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                if settings.SMTP_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
    except Exception as e:
        print(f"Failed to send email: {e}")
