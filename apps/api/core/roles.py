ROLE_HIERARCHY = {"guest": 0, "resident": 1, "driver": 2, "admin": 3}

REGISTERABLE_ROLES = {"resident", "driver"}


def role_satisfies(user_role: str, required_role: str) -> bool:
    return ROLE_HIERARCHY[user_role] >= ROLE_HIERARCHY[required_role]
