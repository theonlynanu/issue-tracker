from flask import Flask, request, jsonify, session
from config import Config
from db import get_db, close_db
from auth_utils import login_required, get_current_user_id
from pymysql.err import IntegrityError

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY must be set.")
    
    app.teardown_appcontext(close_db)
    
    
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
                
            except Exception as e:
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
                (user_id)
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
        
        sql = "UPDATE users SET " + ", ".join(fields) + "WHERE user_id = %s"
        
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
        
        if isinstance(is_public, bool):
            is_public = 1 if is_public else 0
        else:
            is_public = data.get("is_public", 1) 
        
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
            
            
    @app.route("/projects/<int:project_id>", methods=["GET"])
    @login_required
    def get_project(project_id):
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
                SELECT p.project_id, p.project_key, p.name, p.description p.is_public, p.created_by, p.created_at, pm.role AS user_role
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
            
    
    
    ############################### FINAL RETURN ###############################
    return app
        
    
    
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port = 5000, debug=app.config["DEBUG"])