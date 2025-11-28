import pymysql
from pymysql.cursors import DictCursor
from flask import current_app, g

def get_db():
    """
    Gets a per-request DB connection and stores it in Flask global
    Opens a new connection on first use, per request
    """
    
    if "db" not in g:
        cfg = current_app.config
        g.db = pymysql.connect(
            host = cfg["DB_HOST"],
            port = cfg["DB_PORT"],
            user = cfg["DB_USER"],
            password = cfg["DB_PASSWORD"],
            database = cfg["DB_NAME"],
            cursorclass = DictCursor,
            autocommit = False
        )
    return g.db

def close_db(e=None):
    """Close the DB connection at request teardown"""
    db = g.pop("db", None)
    if db is not None:
        db.close()