from fastapi import APIRouter, Depends, HTTPException, Request, Response
import httpx
from app.core.config import settings
from app.auth import get_current_user
from app.models import User

router = APIRouter(
    prefix="/discord",
    tags=["discord"],
    dependencies=[Depends(get_current_user)]
)

async def check_discord_role(user: User = Depends(get_current_user)):
    if user.discord_role != 1:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return user

async def proxy_request(method: str, path: str, request: Request, user: User = None, **kwargs):
    url = f"{settings.DISCORD_BOT_API_URL.rstrip('/')}/{path.lstrip('/')}"
    headers = {"X-API-Key": settings.DISCORD_BOT_API_KEY}
    if user:
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        if full_name:
            headers["X-Actor-Name"] = full_name
        if user.email:
            headers["X-Actor-Email"] = user.email
    
    # Forward query parameters
    params = dict(request.query_params)
    
    # Forward JSON body if present
    json_data = None
    if method in ["POST", "PUT", "PATCH"]:
        try:
            json_data = await request.json()
        except:
            pass

    async with httpx.AsyncClient() as client:
        try:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                params=params,
                json=json_data
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            print(f"HTTPStatusError: {exc}")
            raise HTTPException(status_code=exc.response.status_code, detail=exc.response.text)
        except httpx.RequestError as exc:
            print(f"RequestError: {exc}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to Discord Bot API: {exc}")

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def catch_all(path: str, request: Request, user: User = Depends(check_discord_role)):
    return await proxy_request(request.method, path, request, user=user)
