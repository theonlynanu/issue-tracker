USE itms;
DELIMITER $$

/* 	PROCEDURE: sp_create_issue
	- Allocates issue_number per project (1, 2, 3...)
    - Ensures initial status is 'OPEN'
    - Accepts assignee and due date (both optional)
    - DB handles created_at and updated_at
*/
DROP PROCEDURE IF EXISTS sp_create_issue$$
CREATE PROCEDURE sp_create_issue (
	IN p_project_id		BIGINT,
    IN p_title			VARCHAR(64),
    IN p_description	TEXT,
    IN p_type			VARCHAR(16),	-- 'BUG', 'FEATURE', 'TASK', or 'OTHER'
    IN p_priority		VARCHAR(16),	-- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    IN p_reporter_id	BIGINT,
    IN p_assignee_id	BIGINT,			-- can be NULL
    IN p_due_date		date			-- can be NULL
)
BEGIN
	DECLARE next_issue_number INT;
    
    START TRANSACTION;
    
    SELECT COALESCE(MAX(issue_number) + 1, 1)
    INTO next_issue_number
    FROM issues
    WHERE project_id = p_project_id
    FOR UPDATE;
    
    INSERT INTO ISSUES (
		project_id,
        issue_number,
        title,
        description,
        type,
        status,
        priority,
        reporter_id,
        assignee_id,
        due_date
	) VALUES (
		p_project_id,
        next_issue_number,
        p_title,
        p_description,
        p_type,
        'OPEN',
        p_priority,
        p_reporter_id,
        p_assignee_id,
        p_due_date
    );
    
    COMMIT;
END$$


/*	TRIGGER: trg_issues_history_create
	- Logs creation event for new issues

*/
DROP TRIGGER IF EXISTS trg_issues_history_create$$
CREATE TRIGGER trg_issues_history_create
AFTER INSERT ON issues
FOR EACH ROW
BEGIN
	INSERT INTO issue_history (
		issue_id, 
        changed_by,
        field_name,
        old_value,
        new_value
	) VALUES (
		NEW.issue_id,
        NULL,
        'created',
        NULL,
        NULL
    );
END$$


/*	TRIGGER: trg_issues_history_update
	- Logs changes to the following fields:
		- status
        - priority
        - assignee_id
        - due_date
        - description (unsure if this will balloon DB size)
*/

DROP TRIGGER IF EXISTS trg_issues_history_update$$
CREATE TRIGGER trg_issues_history_update
	AFTER UPDATE ON issues
    FOR EACH ROW
BEGIN
	-- Status change
	IF NEW.status <> OLD.status THEN
		INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
        VALUES (
			OLD.issue_id,
            NULL,
            'status',
            OLD.status,
            NEW.status
        );
	END IF;
    
    -- Priority change
    IF NEW.priority <> OLD.priority THEN
		INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
        VALUES (
			OLD.issue_id,
            NULL,
            'priority',
            OLD.priority,
            NEW.priority
        );
	END IF;
    
    -- Assignee change (NULL-safe)
    IF (NEW.assignee_id <=> OLD.assignee_id) = 0 THEN
		INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
        VALUES (
			OLD.issue_id,
            NULL,
            'assignee_id',
            IFNULL(CAST(OLD.assignee_id AS CHAR), NULL),
            IFNULL(CAST(NEW.assignee_id AS CHAR), NULL)
        );
	END IF;
    
    -- Due date change (NULL-safe)
    IF (NEW.due_date <=> OLD.due_date) = 0 THEN
		INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
        VALUES (
			OLD.issue_id,
            NULL,
            'due_date',
            IFNULL(CAST(OLD.due_date AS CHAR), NULL),
            IFNULL(CAST(NEW.due_date AS CHAR), NULL)
        );
	END IF;
    
    -- Description change
    IF (NEW.description <=> OLD.description) = 0 THEN
		INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
        VALUES (
			OLD.issue_id,
            NULL,
            'assignee_id',
            IFNULL(CAST(OLD.assignee_id AS CHAR), NULL),
            IFNULL(CAST(NEW.assignee_id AS CHAR), NULL)
        );
	END IF;
END$$
DELIMITER ;