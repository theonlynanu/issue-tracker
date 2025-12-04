from flask import Flask, request, jsonify, session
from flask_cors import CORS
from config import Config
from db import get_db, close_db
from auth_utils import (login_required, get_current_user_id, require_project_role, 
                        get_project_visibility, get_project_role, is_visible_to_user, 
                        can_modify_issue, fetch_issue, ensure_issue_visible, fetch_comment)
from pymysql.err import IntegrityError

def create_app():
    """
    Application factory, not necessary to be a factory but could be nice for testing.
    
    This application DOES use server-side SQL rather than solely relying on database
    procedures and routines. The sheer number of unique operations required for validation,
    rule verification/enforcement, and general database updates seems intractable to 
    implement entirely on the DB side. Considering that API calls that use ORMs or protected
    SQL commands is industry standard, I don't see this as an issue. 
    
    Note that I rely on the safety provided by cursor.execute(), which allows user-defined
    arguments to be sanitized prior to request/query assembly, preventing SQL injection.
    """
    app = Flask(__name__)
    app.config.from_object(Config)
    
    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY must be set.")
    
    app.teardown_appcontext(close_db)
    
    CORS(
        app,
        resources={r"/*": {"origins": app.config["FRONTEND_ORIGIN"]}},
        supports_credentials=True
    )
    
    #########################################
    #           Basic Testing               #   
    #########################################
    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({'status': "ok"}), 200
    
    @app.route("/testget", methods=["GET"])
    def testget():
        conn = get_db()
        
        with conn.cursor() as cursor:
            try:
                cursor.execute(
                    """SHOW TABLES"""
                )
                conn.commit()
            except Exception as e:
                conn.rollback()
                return jsonify({"error": "Could not receive table details", "details": str(e)}), 404
        
            result = cursor.fetchall()
        print(result)
        return jsonify({"message": "Success"}), 200   
            
    
    ############################################
    #             Authentication               #
    ############################################  
    
    # A1
    @app.route("/auth/register", methods=["POST"])
    def register():
        """Register a new user account, given email, username, password, and first/last name"""
        data = request.get_json(force=True)
        email = data.get("email")
        username = data.get("username")
        password = data.get("password")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        
        if not all([email, username, password, first_name, last_name]):
            return jsonify({"error": "Missing fields"}), 400
        
        import bcrypt
        pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        pw_hash_str = pw_hash.decode('utf-8')
        
        conn = get_db()
        with conn.cursor() as cursor:
            try:
                cursor.execute(
                    """
                    INSERT INTO users (email, username, password_hash, first_name, last_name)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (email, username, pw_hash_str, first_name, last_name)
                )
                conn.commit()
                
            except IntegrityError as e:
                conn.rollback()
                
                # Duplicate entry for key
                if e.args[0] == 1062:
                    return jsonify({"error": "User already exists"}), 409
                
                # Other DB error
                return jsonify({"error": "Registration failed", "details": str(e)}), 400
            
        return jsonify({"message": "User created"}), 201
    
    # A2
    @app.route("/auth/login", methods=["POST"])
    def login():
        """Logs in and creates session for user. Returns user info:
            {
                user: {
                    "email": "<email>",
                    "first_name": "<name>",
                    "last_name": "<name>",
                    "user_id": <user_id> (int),
                    "username": <username>
                }
            }
        """
        data = request.get_json(force=True)
        identifier = data.get("identifier") # Since we take email or username
        password = data.get("password")
        
        if not identifier or not password:
            return jsonify({"error": "username/email and password required"}), 400
        
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, email, username, password_hash, first_name, last_name
                FROM users
                WHERE email = %s or username = %s
                LIMIT 1
                """,
                (identifier, identifier),
            )
            user = cursor.fetchone()
        
        import bcrypt    
        if not user:
            return jsonify({"error": "Invalid credentials"}), 401   # Avoid exposing whether username was not found or if password was incorrect
        
        if not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
            return jsonify({"error": "Invalid credentials"}), 401   # Avoid exposing whether username was not found or if password was incorrect
        
        session.clear()
        session["user_id"] = user["user_id"]
        
        user.pop("password_hash", None)
        
        return jsonify({"user": user}), 200
            
    
    # A3
    @app.route("/auth/logout", methods=["POST"])
    def logout():
        session.clear()
        return jsonify({"message": "Logged out"}), 200 
    
    
    # A4
    @app.route("/me", methods=["GET"])
    @login_required
    def me():
        """Get user information in format:
            {
                "user": {
                    "created_at": "<DATETIME>",
                    "email": "<email>",
                    "first_name": "<name>",
                    "last_name": "<name>",
                    "user_id": <user_id> (int),
                    "username": <username>
                }
            }
        """
        user_id = get_current_user_id()
        
        conn = get_db()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, email, username, first_name, last_name, created_at
                FROM users
                WHERE user_id = %s
                """,
                (user_id,)
            )
            
            user = cursor.fetchone()
            
            
        if not user:
            # Shouldn't really happen unless the account is deleted mid-session
            return jsonify({"error": "User not found"}), 404
        
        return jsonify({"user": user}), 200
    
    
    # A5
    @app.route("/me", methods=["PATCH"])
    @login_required
    def update_me():
        """
            Updates the user's info - either the username, first_name, or last_name.
            Email address cannot be updated for this first version.
            
            Request body expects one of those three fields with a new value.
            
            Returns user's updated info
        """
        user_id = get_current_user_id()
        data = request.get_json(force=True) or {}
        
        username = data.get("username")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        
        if not any([username, first_name, last_name]):
            return jsonify({"error": "No fields to update"}), 400
        
        
        fields = []
        params = []
        
        if username is not None:
            fields.append("username = %s")
            params.append(username)
        if first_name is not None:
            fields.append("first_name = %s")
            params.append(first_name)
        if last_name is not None:
            fields.append("last_name = %s")
            params.append(last_name )
        
        params.append(user_id)
        
        sql = "UPDATE users SET " + ", ".join(fields) + " WHERE user_id = %s"
        
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(sql, tuple(params))
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            if e.args[0] == 1062:
                return jsonify({"error": "Username already in use"}), 409
            return jsonify({"error": "Integrity error", "details": str(e)}), 400
        
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, email, username, first_name, last_name, created_at
                FROM users
                WHERE user_id = %s
                """,
                (user_id,),
            )
            user = cursor.fetchone()
            
        return jsonify({"user": user}), 200
    
    ####################################
    #        Project Management        #
    ####################################
    
    # P1
    @app.route("/projects", methods=["GET"])
    @login_required
    def list_projects():
        """Returns all visible projects to the logged-in user"""
        
        user_id = get_current_user_id()
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT p.project_id, p.project_key, p.name, p.description, p.is_public, p.created_by, p.created_at, pm.role AS user_role
                FROM projects p
                LEFT JOIN project_memberships pm ON p.project_id = pm.project_id AND pm.user_id = %s
                WHERE p.is_public = 1 OR pm.role IS NOT NULL
                ORDER BY p.project_key ASC
                """,
                (user_id,)
            )
            
            rows = cursor.fetchall()
            
        return jsonify({"projects": rows}), 200
    
    
    # P2
    @app.route("/projects", methods=["POST"])
    @login_required
    def create_project():
        """ 
        Create project and set current user as lead 
        
        Requires project_key, name, and optionally is_public and description.
        is_public defaults to 1 if not provided
        """
        
        user_id = get_current_user_id()
        data = request.get_json(force=True) or {}
        conn = get_db()
        
        project_key = data.get("project_key")
        project_name = data.get("name")
        project_description = data.get("description")
        raw = data.get("is_public")
        
        if raw is None:
            is_public = 1
        elif isinstance(raw, bool):
            is_public = 1 if raw else 0
        elif isinstance(raw, int) and raw in (0, 1):
            is_public = raw
        elif isinstance(raw, str) and raw.lower() in ("0", "1", "true", "false"):
            is_public = 1 if raw.lower() in ("1", "true") else 0
        else: 
            return jsonify({"error": "Invalid is_public value"}), 400
        
        if not project_key or not project_name:
            return jsonify({"error": "Project key and name are required"}), 400
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO projects (project_key, name, description, is_public, created_by)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (project_key, project_name, project_description, is_public, user_id)
                )
                
                project_id = cursor.lastrowid
                
                cursor.execute(
                    """
                    INSERT INTO project_memberships (project_id, user_id, role)
                    VALUES (%s, %s, 'LEAD')
                    """,
                    (project_id, user_id)
                )
                
            conn.commit()
        
        except IntegrityError as e:
            conn.rollback()
            
            if "uq_project_key" in str(e):
                return jsonify({"error": "Project key already exists"}), 409
            
            return jsonify({"error": "Unable to create project", "details": str(e)}), 400
        
        
        return jsonify({
            "message": "Project created",
            "project": {
                "project_id": project_id,
                "project_key": project_key,
                "name": project_name,
                "description": project_description,
                "is_public": is_public,
                "created_by": user_id
            }
        }), 201
            
    # P3
    @app.route("/projects/<int:project_id>", methods=["GET"])
    @login_required
    def get_project(project_id: int):
        """
        Return a single project, if that project is visible to the user
        
        Public projects are visible to all users, while private projects are only
        visible to members of that project.
        """
        user_id = get_current_user_id()
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT p.project_id, p.project_key, p.name, p.description, p.is_public, p.created_by, p.created_at, pm.role AS user_role
                FROM projects p
                LEFT JOIN project_memberships pm ON p.project_id = pm.project_id AND pm.user_id = %s
                WHERE p.project_id = %s AND (p.is_public = 1 OR pm.role IS NOT NULL)
                """,
                (user_id, project_id)
            )
            
            row = cursor.fetchone()
            
        # If no row is returned, it means either:
        # - project doesn't exist
        # - project is private and user is not a member
        if not row:
            return jsonify({"error": "Project not found"}), 404
        
        return jsonify({"project": row}), 200
    
    # P4
    @app.route("/projects/<int:project_id>", methods=["PATCH"])
    @require_project_role(["LEAD"])
    def edit_project(project_id: int):
        """
        Allows a project lead to change the name, key, or description of a project
        
        project_key must be unique - throw 409 if already present in db
        """
        conn = get_db()
        data = request.get_json(force=True) or {}
        
        new_name = data.get("name")
        new_description = data.get("description")
        new_key = data.get("project_key")
        
        if not any((new_name, new_description, new_key)):
            return jsonify({"error": "No new attributes provided"}), 400
        
        fields = []
        params = []
        
        if new_name is not None:
            fields.append("name = %s")
            params.append(new_name)
        if new_description is not None:
            fields.append("description = %s")
            params.append(new_description)
        if new_key is not None:
            fields.append("project_key = %s")
            params.append(new_key)
            
        params.append(project_id)
        
        sql = "UPDATE projects SET " + ", ".join(fields) + " WHERE project_id = %s"
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(sql, tuple(params))
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            if e.args[0] == 1062:
                return jsonify({"error": "Project key already in use"}), 409
            return jsonify({"error": "Integrity error", "details": str(e)}), 400
        
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM projects
                WHERE project_id = %s
                """,
                (project_id,)
            )
            project = cursor.fetchone()
            
        return jsonify({"project": project}), 200
            
    # P5
    @app.route("/projects/<int:project_id>/visibility", methods=["PATCH"])
    @require_project_role(["LEAD"])
    def update_visibility(project_id: int):
        data = request.get_json(force=True) or {}
        
        raw = data.get("is_public")

        if raw is None:
            return jsonify({"error": "is_public must be provided"}), 400
        
        if isinstance(raw, bool):
            is_public = 1 if raw else 0
            
        elif isinstance(raw, int) and raw in (0,1):
            is_public = raw
            
        elif isinstance(raw, str) and raw.lower() in ("0", "1", "true", "false"):
            is_public = 1 if raw.lower() in ("1", "true") else 0
            
        else:
            return jsonify({"error": "Invalid is_public (must be boolean or 0/1)"}), 400

        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE projects SET is_public = %s WHERE project_id = %s
                    """,
                    (is_public, project_id)
                )
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Integrity error", "details": str(e)}), 400
        
        with conn.cursor() as cursor:
            cursor.execute(
                """ SELECT * FROM projects WHERE project_id = %s""",
                (project_id,)
            )
            project = cursor.fetchone()
        
        return jsonify({"project": project}), 200
    
    # P6
    @app.route("/projects/<int:project_id>", methods=["DELETE"])
    @require_project_role(["LEAD"])
    def delete_project(project_id: int):
        """Deletes a project, assuming current user is a project LEAD"""
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM projects WHERE project_id = %s
                    """,
                    (project_id,)
                )    
                deleted = cursor.rowcount
                
            if deleted == 0:
                # Shouldn't happen unless there's an issue with DELETE CASCADE in project_memberships
                conn.rollback()
                return jsonify({"error": "Project not found"}), 404
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Integrity Error", "details": str(e)}), 400
        
        return jsonify({"success": True}), 200
    
    #######################################
    #        Membership Management        #
    #######################################
    
    # M1
    @app.route("/projects/<int:project_id>/members", methods=["GET"])
    @login_required
    def list_project_members(project_id: int):
        """Lists all members of a project"""
        user_id = get_current_user_id()
        
        visible, err = is_visible_to_user(project_id, user_id)
        if not visible:
            if err == 404:
                return jsonify({"error": "Project not found"}), 404
            elif err == 403:
                return jsonify({"error": "Not authorized to access this project"}), 403
            else:
                return jsonify({"error": "Unable to verify project membership/visibility"}), 400
        
        
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT pm.user_id, u.username, u.first_name, u.last_name, pm.role, pm.joined_at
                FROM project_memberships pm JOIN users u ON u.user_id = pm.user_id
                WHERE pm.project_id = %s
                ORDER BY
                    CASE pm.role
                        WHEN 'LEAD' THEN 1
                        WHEN 'DEVELOPER' THEN 2
                        ELSE 3
                    END,
                    u.username
                """,
                (project_id,)
            )
            
            members = cursor.fetchall()
            
        return jsonify({
            "project_id": project_id,
            "members": members
        }), 200
        
    # M2
    @app.route("/projects/<int:project_id>/members", methods=["POST"])
    @require_project_role(["LEAD"])
    def add_user_to_project(project_id: int):
        """
        Adds a user to a project with a given role.
        Expects an identifier (username or email) and a role: LEAD|DEVELOPER|VIEWER
        """
        data = request.get_json(force=True)
        identifier = data.get("identifier")
        role = str(data.get("role"))
        
        if not identifier or not role:
            return jsonify({"error": "Requires user identifier and role"}), 400
        
        if role.lower() not in ("lead", "developer", "viewer"):
            return jsonify({"error": "Invalid role"}), 400
        
        role = role.upper()
        
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id FROM users
                    WHERE username = %s OR email = %s
                    """,
                    (identifier, identifier)
                )
                new_user_id = cursor.fetchone()
                if new_user_id is None:
                    conn.rollback()
                    return jsonify({"error": "User not found"}), 404
                
                new_user_id = new_user_id["user_id"]
                
                cursor.execute(
                    """
                    INSERT INTO project_memberships (project_id, user_id, role)
                    VALUES (%s, %s, %s)
                    """,
                    (project_id, new_user_id, role)
                )
            conn.commit()
                
        except IntegrityError as e:
            conn.rollback()
            if e.args[0] == 1062:
                return jsonify({"error": "User is already a member of this project"}), 409
            return jsonify({"error": "Membership update failed", "details": str(e)}), 400
        
        return jsonify({
            "user_id": new_user_id,
            "project_id": project_id,
            "role": role
        })
        
    # M3
    @app.route("/projects/<int:project_id>/members/<int:member_id>", methods=["PATCH"])
    @require_project_role(["LEAD"])
    def change_member_role(project_id: int, member_id: int):
        """
        Changes role of an existing member in a project.
        
        Caller must be a project LEAD, target user must be a project member,
        and you cannot demote the last LEAD to a non-LEAD role
        """
        acting_user_id = get_current_user_id()
        data = request.get_json(force=True)
        new_role = str(data.get("role"))
        
        if new_role is None:
            return jsonify({"error": "Role is required"}), 400
        
        new_role = str(new_role).upper()
        
        if new_role not in ("LEAD", "DEVELOPER", "VIEWER"):
            return jsonify({"error": "Invalid role"}), 400
        
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT role FROM project_memberships 
                    WHERE project_id = %s AND user_id = %s
                    """,
                    (project_id, member_id)
                )
                membership = cursor.fetchone()
                
                if not membership:
                    return jsonify({"error": "User is not a member of this project"}), 404
                
                current_role = membership["role"]
                
                # Refuse to demote the last LEAD
                if current_role == "LEAD" and new_role != "LEAD":
                    cursor.execute(
                        """
                        SELECT COUNT(*) AS lead_count FROM project_memberships
                        WHERE project_id = %s and role='LEAD'
                        """,
                        (project_id,)
                    )
                    row = cursor.fetchone()
                    lead_count = row["lead_count"]
                    
                    if lead_count <= 1:
                        if member_id == acting_user_id:
                            msg = "Cannot demote yourself when you are the only lead on the project"
                        else:
                            msg = "Cannot demote the last lead on the project"
                            
                        return jsonify({"error": msg}), 409
                        
                cursor.execute(
                    """
                    UPDATE project_memberships
                    SET role = %s
                    WHERE project_id = %s AND user_id = %s
                    """,
                    (new_role, project_id, member_id)
                )
                updated = cursor.rowcount
                
            conn.commit()
        
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Could not update role", "details": str(e)}), 400
        
        if updated == 0:
            # Occurs if membership is changed to the same
            return jsonify({"message": "User already possesses that role"}), 200
        
        return jsonify({
            "message": "Role updated",
            "project_id": project_id,
            "user_id": member_id,
            "new_role": new_role
        }), 200
        
    # M4
    @app.route("/projects/<int:project_id>/members/<int:member_id>", methods=["DELETE"])
    @require_project_role(["LEAD"])
    def remove_member_from_project(project_id: int, member_id: int):
        """
        Removes a member from a project. Allows self-removal, but does not allow
        removal of the last LEAD on a project. Target must be a project member.
        """
        acting_user_id = get_current_user_id()
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute("SET @current_user_id := %s", (acting_user_id,))
                cursor.execute(
                    """
                    SELECT role FROM project_memberships
                    WHERE project_id = %s AND user_id = %s
                    """,
                    (project_id, member_id)
                )
                current_membership = cursor.fetchone()
                
                if not current_membership:
                    return jsonify({"error": "User is not a member of this project"}), 404
                
                current_role = current_membership["role"]
                
                if current_role == "LEAD":
                    cursor.execute(
                        """
                        SELECT COUNT(*) AS lead_count FROM project_memberships
                        WHERE project_id = %s AND role='LEAD'
                        """,
                        (project_id,)
                    )
                    row = cursor.fetchone()
                    lead_count = row["lead_count"]
                    
                    if lead_count <= 1:
                        if member_id == acting_user_id:
                            msg = "Cannot leave a project as the last lead"
                        else:
                            msg = "Cannot remove the last lead on the project"

                        return jsonify({"error": msg}), 409
                    
                # Check for issues assigned to removed user
                cursor.execute(
                    """
                    UPDATE issues
                    SET assignee_id = NULL
                    WHERE project_id = %s AND assignee_id = %s
                    """,
                    (project_id, member_id)
                )
                
                cursor.execute(
                    """
                    DELETE FROM project_memberships WHERE project_id = %s AND user_id = %s
                    """,
                    (project_id, member_id)
                )
                deleted = cursor.rowcount

            if deleted == 0:
                conn.rollback()
                return jsonify({"error": "Membership not found"}), 404

            conn.commit()
                
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Could not remove member from project", "details": str(e)}), 400
        
        
        return jsonify({
            "message": "Member removed from project",
            "user_id": member_id,
            "project_id": project_id
        })
        
    
    ################################
    #       Issues & History       #
    ################################
    
    # I1
    @app.route("/projects/<int:project_id>/issues", methods=["GET"])
    @login_required
    def show_project_issues(project_id: int):
        user_id = get_current_user_id()
        visible, err = is_visible_to_user(project_id, user_id)
        if not visible:
            if err == 404:
                return jsonify({"error": "Project not found"}), 404
            elif err == 403:
                return jsonify({"error": "Not authorized to access this project"}), 403
            else:
                return jsonify({"error": "Unable to verify project membership/visibility"}), 400
        
        
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT issue_number, issue_id, title, description, type, status, priority, reporter_id, assignee_id, due_date, created_at, updated_at
                FROM issues WHERE project_id = %s
                ORDER BY issue_number ASC
                """,
                (project_id,)
            )
            
            issues = cursor.fetchall()
            
            if not issues:
                return jsonify({"project_id": project_id, "issues": []}), 200
            
            issue_ids = [issue["issue_id"] for issue in issues]
            
            placeholders = ", ".join(["%s"] * len(issue_ids))
            cursor.execute(
                f"""
                SELECT il.issue_id, l.label_id, l.name FROM issue_labels il
                JOIN labels l on l.label_id = il.label_id
                WHERE il.issue_id IN ({placeholders})
                ORDER BY l.name ASC
                """,
                issue_ids       # This is still parameterized, even if it doesn't look it right away
            )
            label_rows = cursor.fetchall()
          
        labels_by_issue_id = {}
        
        for row in label_rows:
            issue_id = row["issue_id"]  
            labels_by_issue_id.setdefault(issue_id, []).append({
                "label_id": row["label_id"],
                "name": row["name"]
            })
            
        for issue in issues:
            iid = issue["issue_id"]
            issue["labels"] = labels_by_issue_id.get(iid, [])
            
            
            
        return jsonify({
            "project_id": project_id,
            "issues": issues
        }), 200
    
    
    # I2
    @app.route("/projects/<int:project_id>/issues", methods=["POST"])
    @require_project_role(["LEAD", "DEVELOPER", "VIEWER"])
    def create_issue(project_id: int):
        """Create an issue under a project
        
        Expects body shape:
        {
            "title": "Title"
            "description": [optional],
            "type": "BUG"| "FEATURE"|"TASK"|"OTHER", [optional]
            "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", [optional]
            "assignee_id": 2,   [optional - must be LEAD or DEVELOPER]
            "due_date": "YYYY-MM-DD", [optional]
            "labels": [label_ids], [optional]
        }
        
        - Caller must be a member of the project
        - title is required
        - status starts as OPEN
        - reporter_id set to current user
        - assignee_id is also optional
        - labels is a list of label_ids
        - issue_number is allocated per-project
        """
        user_id = get_current_user_id()
        data = request.get_json(force=True)
        
        title = data.get("title")
        description = data.get("description")
        issue_type = (data.get("type") or "TASK").upper()
        priority = (data.get("priority") or "MEDIUM").upper()
        assignee_id = data.get("assignee_id")
        due_date = data.get("due_date") # Optional YYYY-MM-DD
        labels = data.get("labels") or []
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        
        valid_types = {"BUG", "FEATURE", "TASK", "OTHER"}
        if issue_type not in valid_types:
            return jsonify({"error": "Invalid type", "allowed": list(valid_types)}), 400
        
        valid_priorities = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        if priority not in valid_priorities:
            return jsonify({"error": "Invalid priority", "allowed": list(valid_priorities)}), 400
        
        if assignee_id is not None:
            try:
                assignee_id = int(assignee_id)
            except (TypeError, ValueError):
                return jsonify({"error": "assignee_id must be an integer"}), 400
        
            role = get_project_role(project_id, assignee_id)
            if role not in ("LEAD", "DEVELOPER"):
                return jsonify({"error": "Can only assign a LEAD or DEVELOPER to an issue"}), 400
        
        if not isinstance(labels, list):
            return jsonify({"error": "labels must be an array of label_ids"}), 400
        
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute("SET @current_user_id := %s", (user_id,))
                if labels:
                    placeholders = ", ".join(["%s"] * len(labels))
                    cursor.execute(
                        f"""
                        SELECT label_id 
                        FROM labels WHERE project_id = %s AND label_id IN ({placeholders})
                        """,
                        [project_id, *labels]
                    )
                    
                    valid_label_ids = {row["label_id"] for row in cursor.fetchall()}
                    missing = set(labels) - valid_label_ids
                    if missing:
                        return jsonify({
                            "error": "Some labels do not belong to this project",
                            "invalid_label_ids": sorted(missing)
                        }), 400
                        
                cursor.callproc(
                    "sp_create_issue",
                    (
                        project_id,
                        title,
                        description,
                        issue_type,
                        priority,
                        user_id,
                        assignee_id,
                        due_date
                    )
                )
    
                # Since pymysql doesn't have OUT/INOUT for callproc()
                cursor.execute("SELECT LAST_INSERT_ID() AS issue_id")
                row = cursor.fetchone()
                if not row or not row["issue_id"]:
                    raise RuntimeError("sp_create_issue did not produce an insert id")
                issue_id = row["issue_id"]
                
                # Attach labels
                if labels:
                    cursor.executemany(
                        """
                        INSERT INTO issue_labels (issue_id, label_id)
                        VALUES (%s, %s)
                        """,
                        [(issue_id, lid) for lid in labels]
                    )
                    
                cursor.execute(
                    """
                    SELECT issue_id, project_id, issue_number, title, description,
                    type, status, priority, reporter_id, assignee_id, due_date, created_at, updated_at
                    FROM issues WHERE issue_id = %s
                    """,
                    (issue_id,)
                )
                
                issue = cursor.fetchone()
                
            conn.commit()
            
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Issue creation failed", "details": str(e)}), 400
        except Exception as e:
            conn.rollback()
            return jsonify({"error": "Unexpected error during issue creation", "details": str(e)}), 500
        
        issue = fetch_issue(issue_id, add_labels=True)
        
        return jsonify({
            "message": "Issue created",
            "issue": issue
        }), 201
    
    # I3
    @app.route("/issues/<int:issue_id>", methods=["GET"])
    @login_required
    def get_issue_details(issue_id: int):
        user_id = get_current_user_id()
        
        issue = fetch_issue(issue_id, add_labels=True)
            
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        return jsonify({"issue": issue}), 200
        
        
    # I4
    @app.route("/issues/<int:issue_id>", methods=["PATCH"])
    @login_required
    def edit_issue(issue_id: int):
        """
        Edits an existing issue in one or more of the following fields:
        - Title
        - Description
        - Type
        - Priority
        - Due_date
        - Status
        
        Only a project LEAD or the ASSIGNED developer ('assignee') may edit an issue's details
        
        I expect this endpoint to be hit often, as it's more of less the core of the application,
        so I'm trying to minimize the cost of roundtrip checks while still maintaining functionality
        """
        user_id = get_current_user_id()
        data = request.get_json(force=True)
        conn = get_db()
        
        new_title = data.get("title")
        new_description = data.get("description")
        new_type = data.get("type")
        new_priority = data.get("priority")
        new_due_date = data.get("due_date")
        new_status = data.get("status")
        
        
        if not any([new_title, new_description, new_type, new_priority, new_due_date, new_status]):
            return jsonify({"error": "No valid fields for change provided"}), 400
        
        valid_types = {"BUG", "FEATURE", "TASK", "OTHER"}
        valid_priorities = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        valid_statuses = {"OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"}
        
        fields = []
        params = []
        
        if new_title is not None:
            fields.append("title = %s")
            params.append(new_title)
            
        if new_description is not None:
            fields.append("description = %s")
            params.append(new_description)

        if new_type is not None:
            new_type = str(new_type).upper()
            if new_type not in valid_types:
                return jsonify({
                    "error": "Invalid type",
                    "allowed": sorted(list(valid_types)),
                }), 400
            fields.append("type = %s")
            params.append(new_type)

        if new_priority is not None:
            new_priority = str(new_priority).upper()
            if new_priority not in valid_priorities:
                return jsonify({
                    "error": "Invalid priority",
                    "allowed": sorted(list(valid_priorities)),
                }), 400
            fields.append("priority = %s")
            params.append(new_priority)

        if new_status is not None:
            new_status = str(new_status).upper()
            if new_status not in valid_statuses:
                return jsonify({
                    "error": "Invalid status",
                    "allowed": sorted(list(valid_statuses)),
                }), 400
            fields.append("status = %s")
            params.append(new_status)

        if new_due_date is not None:
            # Let MySQL enforce DATE format
            fields.append("due_date = %s")
            params.append(new_due_date)

        # Second sanity check
        if not fields:
            return jsonify({"error": "No valid fields to update"}), 400
        
        params.append(issue_id)
        sql = "UPDATE issues SET " + ", ".join(fields) + " WHERE issue_id = %s"
        
        
        issue = fetch_issue(issue_id)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        project_id = issue["project_id"]
        role = get_project_role(project_id, user_id)
        if not can_modify_issue(issue, user_id, role):
            return jsonify({"error": "Insufficient permission to modify this issue"}), 403
        
        try:
            with conn.cursor() as cursor:
                cursor.execute("SET @current_user_id := %s", (user_id,))
                cursor.execute(sql, tuple(params))
                cursor.execute(
                    """
                    SELECT * FROM issues WHERE issue_id = %s
                    """,
                    (issue_id,)
                )
                updated_issue = cursor.fetchone()
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Issue update failed", "details": str(e)}), 400
        
        return jsonify({"issue": updated_issue}), 200
    
    # I5
    @app.route("/issues/<int:issue_id>/assignee", methods=["PATCH"])
    @login_required
    def update_issue_assignee(issue_id: int):
        """
        Change the assigned LEAD/DEVELOPER on an issue. 
        
        Expects 'assignee_id', which can be null to unassign an issue
        
        Only a LEAD can reassign an issue
        """
        user_id = get_current_user_id()
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT issue_id, project_id, assignee_id
                FROM issues
                WHERE issue_id = %s
                """,
                (issue_id,)
            )
            issue = cursor.fetchone()
            
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        project_id = issue["project_id"]
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
            
        acting_role = get_project_role(project_id, user_id)
        if acting_role != "LEAD":
            return jsonify({"error": "Only project leads may change issue assignees"}), 403
        
        data = request.get_json(force=True)
        new_assignee = data.get("assignee_id")
        
        if new_assignee is not None:
            try:
                new_assignee = int(new_assignee)
            except (TypeError, ValueError):
                return jsonify({"error": "assignee_id must be an integer or null"}), 400
            
            assignee_role = get_project_role(project_id, new_assignee)
            if assignee_role not in ("LEAD", "DEVELOPER"):
                return jsonify({"error": "Assignee must be a LEAD or DEVELOPER in this project"}), 400
            
        try:
            with conn.cursor() as cursor:
                cursor.execute("SET @current_user_id := %s", (user_id,))
                cursor.execute(
                    """
                    UPDATE issues
                    SET assignee_id = %s
                    WHERE issue_id = %s
                    """,
                    (new_assignee, issue_id)
                )
                
                cursor.execute(
                    """
                    SELECT * FROM issues WHERE issue_id = %s
                    """,
                    (issue_id,)
                )
                updated_issue = cursor.fetchone()
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Assignee update failed", "details": str(e)}), 400
        
        return jsonify({"issue": updated_issue}), 200
        
    #######################
    #       HISTORY       #
    #######################
    
    # H1
    @app.route("/issues/<int:issue_id>/history", methods=["GET"])                
    @login_required
    def get_issue_history(issue_id: int):
        user_id = get_current_user_id()
        
        issue = fetch_issue(issue_id, add_labels=True)
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        conn = get_db()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM issue_history WHERE issue_id = %s
                ORDER BY changed_at ASC
                """,
                (issue_id,)
            )
            history = cursor.fetchall()
        
        return jsonify({"issue_id": issue_id, "history": history}), 200
            
    ########################        
    #        Labels        #
    ########################        
    
    # L1
    @app.route("/projects/<int:project_id>/labels", methods=["GET"])
    @login_required
    def get_project_labels(project_id):
        """
        Gets all labels associated with a given project
        """
        user_id = get_current_user_id()
        
        visibility = get_project_visibility(project_id, user_id)
        if not visibility["exists"]:
            return jsonify({"error": "Project not found"}), 404
        
        if not visibility["visible"]:
            return jsonify({"error": "Not authorized to access this project"}), 403
        
        conn = get_db()
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT label_id, name, project_id
                FROM labels
                WHERE project_id = %s
                ORDER BY name ASC
                """,
                (project_id,)
            )
            labels = cursor.fetchall()
            
        return jsonify({"project_id": project_id, "labels": labels}), 200
    
    # L2
    @app.route("/projects/<int:project_id>/labels", methods=["POST"])
    @require_project_role(["LEAD"])
    def add_label_to_project(project_id: int):
        """
        Create a new label for a given project
        
        Body:
        {
            "name": "<name>"
        }
        
        Requires caller to be a project LEAD, and enforces per-project uniqueness on (project_id, name)
        """
        data = request.get_json(force=True)
        name = data.get("name")
        
        if not name:
            return jsonify({"error": "Label name required"}), 400
        
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO labels (name, project_id)
                    VALUES (%s, %s)
                    """,
                    (name, project_id)
                )
                label_id = cursor.lastrowid
                
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            
            if e.args[0] == 1062:
                return jsonify({"error": "Label already exists with that name"}), 409
            return jsonify({"error": "Failed to create label", "details": str(e)}), 400
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT label_id, project_id, name
                FROM labels
                WHERE label_id = %s
                """,
                (label_id,)
            )
            label = cursor.fetchone()
        
        return jsonify({"project_id": project_id, "label": label}), 201
    
    
    # L3
    @app.route("/projects/<int:project_id>/labels/<int:label_id>", methods=["PATCH"])
    @require_project_role(["LEAD"])
    def edit_project_label(project_id: int, label_id: int):
        """
        Changes the name of a project's label.
        
        Body:
        {
            "name": "<name>"
        }
        
        Enforces name-collision restraint
        """
        data = request.get_json(force=True)
        new_name = data.get("name")
        
        if not new_name:
            return jsonify({"error": "Label name required"}), 400
        
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE labels
                    SET name=%s WHERE label_id=%s AND project_id=%s
                    """,
                    (new_name, label_id, project_id)
                )
                if cursor.rowcount == 0:
                    conn.rollback()
                    return jsonify({"error": "Label not found"}), 404
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            
            if e.args[0] == 1062:
                return jsonify({"error": "Label already exists with that name"}), 409
            return jsonify({"error": "Unable to update label name", "details": str(e)}), 400
        
        return jsonify({"project_id": project_id, "label_id": label_id, "name": new_name}), 200
    
    
    # L4
    @app.route("/projects/<int:project_id>/labels/<int:label_id>", methods=["DELETE"])
    @require_project_role(["LEAD"])
    def delete_project_label(project_id: int, label_id: int):
        """
        Remove a label from a project. As per DB CASCADE, this will also remove 
        this label from all issues in the project that currently have it.
        """
        conn = get_db()
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM labels WHERE project_id=%s AND label_id=%s
                    """,
                    (project_id, label_id)
                )
                if cursor.rowcount == 0:
                    conn.rollback()
                    return jsonify({"error": "Label not found"}), 404
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Unable to remove label from project", "details": str(e)}), 400
        
        return jsonify({"success": True}), 200
    
    
    # L5
    @app.route("/issues/<int:issue_id>/labels", methods=["POST"])
    @login_required
    def add_label_to_issue(issue_id: int):
        """
        Add existing project label to an issue.
        
        Requires that label exists in project, and that user is either a project
        LEAD or the issue assignee. No duplicate labels on an issue.
        
        Body:
        {
            "label_id": <label_id>
        }
        """
        user_id = get_current_user_id()
        data = request.get_json(force=True)
        
        raw_label_id = data.get("label_id")
        if raw_label_id is None:
            return jsonify({"error": "label_id is required"}), 400
        
        try:
            label_id = int(raw_label_id)
        except (TypeError, ValueError):
            return jsonify({"error": "label_id must be an integer"}), 400
        
        conn = get_db()
        
        issue = fetch_issue(issue_id)
        
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        project_id = issue["project_id"]
        
        user_role = get_project_role(project_id, user_id)
        if not can_modify_issue(issue, user_id, user_role):
            return jsonify({"error": "Insufficient permissions to modify this issue"}), 403
        
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT label_id, project_id, name
                    FROM labels
                    WHERE label_id = %s
                    """,
                    (label_id,)
                )
                label = cursor.fetchone()
                
                if not label or label["project_id"] != project_id:
                    return jsonify({"error": "Label not found in this project"}), 404
                
                try:
                    cursor.execute(
                        """
                        INSERT INTO issue_labels (issue_id, label_id)
                        VALUES (%s, %s)
                        """,
                        (issue_id, label_id)
                    )
                except IntegrityError as e:
                    conn.rollback()
                    if e.args[0] == 1062:
                        return jsonify({
                            "error": "Label already attached to this issue",
                            "label_id": label_id,
                            "issue_id": issue_id
                        }), 409
                    return jsonify({"error": "Failed to attach label", "details": str(e)}), 400
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Failed to attach label", "details": str(e)}), 400
        except Exception as e:
            return jsonify({"error": "Unexpected error while attaching label", "details": str(e)}), 500
        
        updated_issue = fetch_issue(issue_id, add_labels=True)
        
        return jsonify({"message": "label attached", "issue": updated_issue}), 200
    
    
    # L6
    @app.route("/issues/<int:issue_id>/labels/<int:label_id>", methods=["DELETE"])
    @login_required
    def remove_label_from_issue(issue_id: int, label_id: int):
        """
        Remove a label from an issue, provided it is already present on that issue.
        """
        user_id = get_current_user_id()
        
        issue = fetch_issue(issue_id)
        
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        project_id = issue["project_id"]
        
        user_role = get_project_role(project_id, user_id)
        if not can_modify_issue(issue, user_id, user_role):
            return jsonify({"error": "Insufficient permissions to modify this issue"}), 403
        
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM issue_labels
                    WHERE issue_id = %s AND label_id = %s
                    """,
                    (issue_id, label_id)
                )
                if cursor.rowcount == 0:
                    conn.rollback()
                    return jsonify({"error": "Label not found on this issue"}), 404
            conn.commit()
        except Exception as e:
            conn.rollback()
            return jsonify({"error": "Failed to remove label", "details": str(e)}), 400
        
        return jsonify({"success": True}), 200
    
    
    ##########################
    #        COMMENTS        #
    ##########################
    
    # C1
    @app.route("/issues/<int:issue_id>/comments", methods=["GET"])
    @login_required
    def list_issue_comments(issue_id: int):
        """
        Returns all comments on a given issue. Returns empty list if no comments 
        yet exist under the issue. 
        """
        user_id = get_current_user_id()
        
        issue = fetch_issue(issue_id)
        
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        conn = get_db()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM comments WHERE issue_id = %s
                ORDER BY created_at ASC
                """,
                (issue_id,)
            )
            comments = cursor.fetchall()
            
        return jsonify({"issue_id": issue_id, "comments": comments}), 200
        
            
    # C2
    @app.route("/issues/<int:issue_id>/comments", methods=["POST"])
    @login_required
    def post_comment(issue_id: int):
        """
        Post a comment to an issue.
        
        Body:
        {
            "content": "<CONTENT>"
        }
        """
        user_id = get_current_user_id()
        data = request.get_json(force=True)
        content = (data.get('content') or "").strip()   # Trims whitespace and prevent all-whitespace comments
        
        if not content:
            return jsonify({"error": "Comment text cannot be empty"}), 400
        
        issue = fetch_issue(issue_id)
        
        if not issue:
            return jsonify({"error": "Issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO comments (content, author_id, issue_id)
                    VALUES (%s, %s, %s)
                    """,
                    (content, user_id, issue_id)
                )
                comment_id = cursor.lastrowid
                
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Unable to add comment", "details": str(e)}), 400
        
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM comments
                WHERE comment_id = %s
                """,
                (comment_id,)
            )
            comment = cursor.fetchone()
        
        return jsonify({"comment": comment}), 201
    
    
    # C3
    @app.route("/comments/<int:comment_id>", methods=["PATCH"])
    @login_required
    def edit_comment(comment_id: int):
        """
        Edits a comment, only if the user is the author of that comment
        
        Body: 
        {
            "content": "<content>"    
        }
        """
        user_id = get_current_user_id()
        data = request.get_json(force=True)
        new_content = (data.get("content") or "").strip()
        
        if not new_content:
            return jsonify({"error": "Comment text cannot be empty"}), 400
        
        
        comment = fetch_comment(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404
        
        issue = fetch_issue(comment["issue_id"])
        if not issue:       # Should not happen unless DB consistency fails
            return jsonify({"error": "Parent issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        if user_id != comment["author_id"]:
            return jsonify({"error": "Insufficient permissions to edit comment"}), 403
        
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE comments 
                    SET content = %s 
                    WHERE comment_id = %s
                    """,
                    (new_content, comment_id)
                )
                
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Unable to update comment", "details": str(e)}), 400
        
        updated = fetch_comment(comment_id)
        
        return jsonify({"comment": updated}), 200
    
    
    # C4
    @app.route("/comments/<int:comment_id>", methods=["DELETE"])
    @login_required
    def delete_comment(comment_id):
        """
        Deletes a comment from an issue. Can only be carried out by the comment
        author, or a project lead.
        """
        user_id = get_current_user_id()
        
        comment = fetch_comment(comment_id)
        if not comment:
            return jsonify({"error": "Comment not found"}), 404
        
        issue = fetch_issue(comment["issue_id"])
        if not issue:
            return jsonify({"error": "Parent issue not found"}), 404
        
        visibility_error = ensure_issue_visible(issue, user_id)
        if visibility_error:
            return visibility_error
        
        project_id = issue["project_id"]
        user_role = get_project_role(project_id, user_id)
        
        if user_id != comment["author_id"] and user_role != "LEAD":
            return jsonify({"error": "Insufficient permissions to delete comment"}), 403
        
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    DELETE FROM comments
                    WHERE comment_id = %s
                    """,
                    (comment_id,)
                )
                if cursor.rowcount == 0:
                    conn.rollback()     # Should literally never happen, but to be safe
                    return jsonify({"error": "Comment not found"}), 404
            conn.commit()
        except IntegrityError as e:
            conn.rollback()
            return jsonify({"error": "Unable to delete comment", "details": str(e)}), 400
        
        return jsonify({"success": True}), 200
        
        
        
    ############################### FINAL RETURN ###############################
    return app
        
    
    
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port = 8000, debug=app.config["DEBUG"])