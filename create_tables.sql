CREATE DATABASE IF NOT EXISTS itms;
USE itms;

CREATE TABLE IF NOT EXISTS users (
	user_id 		BIGINT AUTO_INCREMENT NOT NULL,
    email 			VARCHAR(255) 	NOT NULL,
    username 		VARCHAR(32)	 	NOT NULL,
    password_hash	VARCHAR(255) 	NOT NULL,
    first_name 		VARCHAR(64) 	NOT NULL,
    last_name 		VARCHAR(64) 	NOT NULL,
    created_at 		DATETIME 		NOT NULL 	DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_users 					PRIMARY KEY (user_id),
    CONSTRAINT uq_users_email 				UNIQUE (email),
    CONSTRAINT uq_users_username 			UNIQUE (username),
    CONSTRAINT chk_users_username_format 	CHECK (username REGEXP '^[A-Za-z0-9_]+$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS projects (
	project_id 		BIGINT 			NOT NULL 	AUTO_INCREMENT,
    project_key 	VARCHAR(16) 	NOT NULL,
    name 			VARCHAR(64) 	NOT NULL,
    description 	TEXT 			NULL,
    is_public 		TINYINT(1) 		NOT NULL	DEFAULT 1,
    created_by 		BIGINT 			NULL,
    created_at 		DATETIME 		NOT NULL 	DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_projects PRIMARY KEY (project_id),
    CONSTRAINT uq_project_key UNIQUE (project_key),
    
    CONSTRAINT fk_projects_creator FOREIGN KEY (created_by) REFERENCES users(user_id) 
		ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS project_memberships (
	project_id 	BIGINT		NOT NULL,
    user_id 	BIGINT		NOT NULL,
    role 		ENUM('LEAD', 'DEVELOPER', 'VIEWER') 	NOT NULL,
    joined_at 	DATETIME 	NOT NULL 	DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_project_memberships 			PRIMARY KEY (project_id, user_id),
    
    CONSTRAINT fk_project_memberships_project 	FOREIGN KEY (project_id) REFERENCES projects(project_id) 
		ON DELETE CASCADE,
	CONSTRAINT fk_project_memberships_user	 	FOREIGN KEY (user_id) REFERENCES users(user_id)
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS issues (
	issue_id 		BIGINT 		NOT NULL	AUTO_INCREMENT,
	project_id 		BIGINT		NOT NULL,
    issue_number 	INT 		NOT NULL,
    title 			VARCHAR(64) NOT NULL,
    description 	TEXT 		NULL,
    type 			ENUM('BUG', 'FEATURE', 'TASK', 'OTHER') 			NOT NULL,
    status 			ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') 	NOT NULL 	DEFAULT 'OPEN',
    priority 		ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') 			NOT NULL 	DEFAULT 'LOW',
    reporter_id 	BIGINT 		NOT NULL,
    assignee_id 	BIGINT 		NULL,
    due_date 		DATE 		NULL,
    created_at 		DATETIME 	NOT NULL 	DEFAULT CURRENT_TIMESTAMP,
    updated_at 		DATETIME 	NOT NULL 	DEFAULT CURRENT_TIMESTAMP	ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_issues 					PRIMARY KEY (issue_id),
    CONSTRAINT uq_issues_num_per_project 	UNIQUE(project_id, issue_number),
    
    CONSTRAINT fk_issues_project 			FOREIGN KEY (project_id) REFERENCES projects(project_id)
		ON DELETE CASCADE,
	CONSTRAINT fk_issues_reporter 			FOREIGN KEY (reporter_id) REFERENCES users(user_id)
		ON DELETE RESTRICT,
	CONSTRAINT fk_issues_assignee 			FOREIGN KEY (assignee_id) REFERENCES users(user_id)
		ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS labels (
	label_id 	BIGINT 			NOT NULL 	AUTO_INCREMENT,
    project_id 	BIGINT 			NOT NULL,
    name 		VARCHAR(32) 	NOT NULL,
    
    CONSTRAINT pk_labels 		PRIMARY KEY (label_id),
    CONSTRAINT uq_labels_name	UNIQUE(project_id, name),
    
    CONSTRAINT fk_labels_project FOREIGN KEY (project_id) REFERENCES projects(project_id)
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS issue_labels (
	issue_id BIGINT NOT NULL,
    label_id BIGINT NOT NULL,
	
    CONSTRAINT pk_issue_labels 			PRIMARY KEY (issue_id, label_id),
    
    CONSTRAINT fk_issue_labels_issue 	FOREIGN KEY (issue_id) REFERENCES issues(issue_id)
		ON DELETE CASCADE,
	CONSTRAINT fk_issue_labels_label 	FOREIGN KEY (label_id) REFERENCES labels(label_id)
		ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
	comment_id 	BIGINT 		NOT NULL 	AUTO_INCREMENT,
    content 	TEXT 		NOT NULL,
    issue_id 	BIGINT 		NOT NULL,
    author_id 	BIGINT 		NULL,
    created_at 	DATETIME	NOT NULL 	DEFAULT CURRENT_TIMESTAMP,
    updated_at 	DATETIME 	NOT NULL 	DEFAULT CURRENT_TIMESTAMP 	ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_comments PRIMARY KEY (comment_id),
    
    CONSTRAINT fk_comments_issue 		FOREIGN KEY (issue_id) REFERENCES issues(issue_id)
		ON DELETE CASCADE,
	CONSTRAINT fk_comments_author 		FOREIGN KEY (author_id) REFERENCES users(user_id)
		ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS issue_history (
	change_id 	BIGINT 		NOT NULL AUTO_INCREMENT,
    issue_id 	BIGINT 		NOT NULL,
    changed_by 	BIGINT 		NULL,
    field_name 	VARCHAR(64) NOT NULL,
    old_value 	TEXT 		NULL,
    new_value 	TEXT 		NULL,
    changed_at 	DATETIME 	NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT pk_issue_history PRIMARY KEY (change_id),
    
    CONSTRAINT fk_issue_history_issue FOREIGN KEY (issue_id) REFERENCES issues(issue_id)
		ON DELETE CASCADE,
    
    CONSTRAINT fk_issue_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(user_id)
		ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
