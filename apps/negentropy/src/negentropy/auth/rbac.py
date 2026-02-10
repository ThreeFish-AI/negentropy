"""
RBAC (Role-Based Access Control) Module.

Implements permission definitions and role-permission mappings.
"""

from typing import Callable

from fastapi import Depends, HTTPException, status

from .deps import get_current_user
from .service import AuthUser


# Permission definitions
PERMISSIONS = {
    # Admin permissions
    "admin:read": "View admin panel",
    "admin:write": "Modify system configuration",
    # User management
    "users:read": "View user list",
    "users:write": "Modify user information",
    # Knowledge base
    "knowledge:read": "View knowledge base",
    "knowledge:write": "Edit knowledge base",
    # Memory
    "memory:read": "View memory",
    "memory:write": "Edit memory",
    # Chat
    "chat:read": "View chat history",
    "chat:write": "Send messages",
}

# Role-permission mappings
# Supports wildcard permissions (e.g., "admin:*" matches "admin:read", "admin:write")
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "admin": [
        "admin:*",
        "users:*",
        "knowledge:*",
        "memory:*",
        "chat:*",
    ],
    "user": [
        "knowledge:read",
        "memory:read",
        "chat:*",
    ],
}


def _match_permission(pattern: str, permission: str) -> bool:
    """Check if a permission pattern matches a specific permission."""
    if pattern == permission:
        return True
    if pattern.endswith(":*"):
        prefix = pattern[:-1]  # "admin:*" -> "admin:"
        return permission.startswith(prefix)
    return False


def has_permission(user_roles: list[str], permission: str) -> bool:
    """Check if a user with given roles has a specific permission."""
    for role in user_roles:
        role_perms = ROLE_PERMISSIONS.get(role, [])
        for perm_pattern in role_perms:
            if _match_permission(perm_pattern, permission):
                return True
    return False


def has_role(user_roles: list[str], required_role: str) -> bool:
    """Check if a user has a specific role."""
    return required_role in user_roles


def require_permission(permission: str) -> Callable[[AuthUser], AuthUser]:
    """Create a FastAPI dependency that checks for a specific permission."""

    def checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not has_permission(user.roles, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"permission required: {permission}",
            )
        return user

    return checker


def require_role(role: str) -> Callable[[AuthUser], AuthUser]:
    """Create a FastAPI dependency that checks for a specific role."""

    def checker(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not has_role(user.roles, role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"role required: {role}",
            )
        return user

    return checker


def get_all_permissions() -> dict[str, str]:
    """Get all available permissions."""
    return PERMISSIONS.copy()


def get_all_roles() -> dict[str, list[str]]:
    """Get all roles with their permissions."""
    return ROLE_PERMISSIONS.copy()


def get_user_permissions(user_roles: list[str]) -> list[str]:
    """Get all permissions available to a user based on their roles."""
    permissions = set()
    for role in user_roles:
        role_perms = ROLE_PERMISSIONS.get(role, [])
        for perm_pattern in role_perms:
            if perm_pattern.endswith(":*"):
                # Expand wildcard to matching permissions
                prefix = perm_pattern[:-1]
                for perm_key in PERMISSIONS:
                    if perm_key.startswith(prefix):
                        permissions.add(perm_key)
            else:
                if perm_pattern in PERMISSIONS:
                    permissions.add(perm_pattern)
    return sorted(permissions)
