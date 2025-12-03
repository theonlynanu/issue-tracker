from functools import wraps
from flask import session, jsonify
from db import get_db
from pymysql.connections import Connection
from pymysql.cursors import DictCursor

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

def can_modify_issue(issue, user_id, role):
    """Checks if user can edit issue, either as a LEAD or as the assigned developer
    
    issue should be passed as a dict with at least the two fields:
        {project_id: <project_id>, "assignee_id": assignee_id ...}
    """
    if role == "LEAD":
        return True
    if issue["assignee_id"] == user_id:
        return True
    
    return False

def get_project_visibility(project_id, user_id):
    """
    Returns a dict with:
    
    {
        "exists": bool,
        "is_public": bool,
        "user_role": "LEAD"|"DEVELOPER"|"VIEWER"|None,
        "visible": bool
    }
    """
    conn = get_db()
    
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT p.is_public, pm.role AS user_role
            FROM projects p LEFT JOIN project_memberships pm ON p.project_id = pm.project_id
                AND pm.user_id = %s
            WHERE p.project_id = %s
            """,
            (user_id, project_id)
        )
        row = cursor.fetchone()
        
        if not row:
            return {
                "exists": False,
                "is_public": False,
                "user_role": None,
                "visible": False
            }
            
        is_public = bool(row["is_public"])
        user_role = row["user_role"]
        visible = is_public or (user_role is not None)
        
        return {
            "exists": True,
            "is_public": is_public,
            "user_role": user_role,
            "visible": visible
        }
    
    
def is_visible_to_user(project_id: int, user_id: int):
    vis = get_project_visibility(project_id, user_id)
    
    if not vis["exists"]:
        return (False, 404)
    elif not vis["visible"]:
        return (False, 403)
    else:
        return (True, 0)
    

def attach_labels_to_issues(conn: Connection[DictCursor], issues):
    """
    Returns a copy of a list of issue objects with attached label_id and label_name 
    using a DictCursor connection object.
    
    """
    
    if not issues:
        return issues
    
    issue_ids = [i["issue_id"] for i in issues]
    placeholders = ", ".join(["%s"] * len(issue_ids))
    
    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT il.issue_id, l.label_id, l.name
            FROM issue_labels il JOIN labels l on l.label_id = il.label_id
            WHERE il.issue_id IN ({placeholders})
            ORDER BY l.name ASC
            """,
            issue_ids
        )
        label_rows = cursor.fetchall()
        
    labels_by_issue_id = {}
    for row in label_rows:
        iid = row["issue_id"]
        labels_by_issue_id.setdefault(iid, []).append({
            "label_id": row["label_id"],
            "name": row["name"]
        })
        
    for issue in issues:
        iid = issue["issue_id"]
        issue["labels"] = labels_by_issue_id.get(iid, [])
        
    return issues

def fetch_issue_or_404(issue_id: int):
    conn = get_db()
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT * FROM issues WHERE issue_id = %s
            """,
            (issue_id,)
        )
        issue = cursor.fetchone()
    return issue

def ensure_issue_visible(issue, user_id: int):
    project_id = issue["project_id"]
    visible, err = is_visible_to_user(project_id, user_id)
    if not visible:
        if err == 404:
            return jsonify({"error": "Issue not found"}), 404
        elif err == 403:
            return jsonify({"error": "Not authorized to view this issue"}), 403
        else:
            return jsonify({"Unable to verify project membership"}), 400
        
    return None

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