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

INSERT INTO issues (issue_id, project_id, issue_number, title, description, type, status, priority, reporter_id, assignee_id)
VALUES
(1, 1, 1, 
	"Create Mock Data", 
	"Mock data needs to be inserted into the database to be used for testing later on.", 
    "TASK", 
    "CLOSED", 
    "HIGH", 
    1, 2),
    
(2, 1, 2, 
	"Design Triggers and Routines", 
    "Triggers and routines need to be put in place to properly populate default fields, track history, and keep data clean and expressive.", 
    "TASK", 
    "IN_PROGRESS", 
    "MEDIUM", 
    1, 2),
    
(3, 2, 1, 
	"Demo Private Project", 
    "Private projects should be demonstrated, including their visibility to non-members, comparisons to public projects, and the importance of view roles.", 
    "TASK", 
    "IN_PROGRESS", 
    "MEDIUM",
    1, 2)
;

INSERT INTO labels (label_id, project_id, name)
VALUES
(1, 1, "MVP Requirement"),
(2, 1, "Frontend"),
(3, 2, "Private tag"), 
(4, 2, "Main Dev")
;

INSERT INTO issue_labels (issue_id, label_id)
VALUES
(1, 1),
(2, 1),
(3, 3)
;

INSERT INTO comments (comment_id, content, issue_id, author_id)
VALUES
(1, "No due date, but don't put this off", 1, 1),
(2, "Will do!", 1, 2),
(3, "Ensure that update triggers properly update timestamps", 2, 1),
(4, "Keep this secret!", 3, 1)
;