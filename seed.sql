INSERT INTO users (user_id, email, username, password_hash, first_name, last_name)
VALUES		-- Passwords generated using same encryption scheme that will be used in final app
(1, "lead@example.com", 'lead1', '$2b$12$wUqSrNEbEARcOx0Lo17NUOVI/XL0d39oxY7ujNqkhKthFYh3ttn8i', "Lena", "Lead"),
(2, "dev@example.com", 'dev1', '$2b$12$fIHgDkrBQwfifYy91QL/ou6xHjMYz0RyOAGDSYKPbKkVzTgKii6cG', "Devon", "Dev"),
(3, "view@example.com", "viewer1", "$2b$12$VYijeWG2tD1GORqQ4XrHRO9745QA.o6xK.48BB6hjjTFVVDIY3S76", "Vera", "Viewer")
;

INSERT INTO projects (project_id, project_key, name, description, is_public, created_by)
VALUES 
(1, 'ITMS', "Issue Tracker", "Sample ITMS project.", 1, 1),
(2, "SECR", "Secret Project", "Private demo project.", 0, 1)
;

INSERT INTO project_memberships (project_id, user_id, role)
VALUES
(1, 1, "LEAD"),
(1, 2, "DEVELOPER"),
(1, 3, "VIEWER"),
(2, 1, "LEAD"),
(2, 2, "DEVELOPER")
;