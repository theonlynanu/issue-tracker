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
    def update_me():
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
    
    
    
    ############################### FINAL RETURN ###############################
    return app
        
    
    
if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port = 5000, debug=app.config["DEBUG"])