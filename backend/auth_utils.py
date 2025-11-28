from functools import wraps
from flask import session, jsonify
from db import get_db

##################################
#        HELPER FUNCTIONS        #
##################################
def get_current_user_id():
    """Return the user_id of the currently logged in user, or None"""
    return session.get("user_id")

def get_project_role(project_id: int, user_id: int):
    """
    Retrieves user role in project.
    
    Returns "LEAD", "DEVELOPER", "VIEWER", or None in the case that the user is not a member
    """
    conn = get_db()
    
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT role FROM project_memberships
            WHERE project_id = %s AND user_id = %s
            """,
            (project_id, user_id)
        )
        row = cursor.fetchone()
        
    return row["role"] if row else None
    

##################################
#            WRAPPERS            #
##################################
def login_required(f):
    """Decorator requiring a valid session for protected routes"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Authentication required, please log in"}), 401
        
        return f(*args, **kwargs)
    
    return wrapper 


def require_project_role(allowed_roles):
    """Early exit wrapper for role-restricted endpoints. If checks pass, execution
    continues as normal. 
    
    Assumes that the route is given a project_id paramater via the endpoint url,
    such as with `/projects/<int:project_id>/members`, or similar

    Args:
        allowed_roles (List[String]): list or set, e.g. ['LEAD'] or ['LEAD', 'DEVELOPER']
    """
    allowed_roles = set(allowed_roles)
    
    def decorator(f):
        @wraps(f)
        def wrapper(project_id, *args, **kwargs):
            user_id = get_current_user_id()
            if not user_id:
                return jsonify({"error": "Authentication required"}), 401
            
            role = get_project_role(project_id, user_id)
            if role is None:
                return jsonify({"error": "Not a member of this project"}), 403
            
            if role not in allowed_roles:
                return jsonify({"error": "Insufficient role permissions"}), 403
            
            return f(project_id, *args, **kwargs)
        
        return wrapper
    return decorator