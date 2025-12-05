CREATE DATABASE  IF NOT EXISTS `itms` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `itms`;
-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: itms
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `comment_id` bigint NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `issue_id` bigint NOT NULL,
  `author_id` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`comment_id`),
  KEY `fk_comments_issue` (`issue_id`),
  KEY `fk_comments_author` (`author_id`),
  CONSTRAINT `fk_comments_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_comments_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`issue_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES (1,'No due date, but don\'t put this off',1,1,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(2,'Will do!',1,2,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(3,'Ensure that update triggers properly update timestamps',2,1,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(4,'Keep this secret!',3,1,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(5,'As a viewer, I can still leave feedback - cool!',1,3,'2025-12-05 15:54:01','2025-12-05 15:54:01');
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `issue_history`
--

DROP TABLE IF EXISTS `issue_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `issue_history` (
  `change_id` bigint NOT NULL AUTO_INCREMENT,
  `issue_id` bigint NOT NULL,
  `changed_by` bigint DEFAULT NULL,
  `field_name` varchar(64) NOT NULL,
  `old_value` text,
  `new_value` text,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`change_id`),
  KEY `fk_issue_history_issue` (`issue_id`),
  KEY `fk_issue_history_changed_by` (`changed_by`),
  CONSTRAINT `fk_issue_history_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_issue_history_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`issue_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issue_history`
--

LOCK TABLES `issue_history` WRITE;
/*!40000 ALTER TABLE `issue_history` DISABLE KEYS */;
INSERT INTO `issue_history` VALUES (1,1,1,'created',NULL,NULL,'2025-12-05 15:54:01'),(2,2,1,'created',NULL,NULL,'2025-12-05 15:54:01'),(3,3,1,'created',NULL,NULL,'2025-12-05 15:54:01'),(4,4,1,'created',NULL,NULL,'2025-12-05 15:54:01'),(5,5,2,'created',NULL,NULL,'2025-12-05 15:54:01');
/*!40000 ALTER TABLE `issue_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `issue_labels`
--

DROP TABLE IF EXISTS `issue_labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `issue_labels` (
  `issue_id` bigint NOT NULL,
  `label_id` bigint NOT NULL,
  PRIMARY KEY (`issue_id`,`label_id`),
  KEY `fk_issue_labels_label` (`label_id`),
  CONSTRAINT `fk_issue_labels_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`issue_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_issue_labels_label` FOREIGN KEY (`label_id`) REFERENCES `labels` (`label_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issue_labels`
--

LOCK TABLES `issue_labels` WRITE;
/*!40000 ALTER TABLE `issue_labels` DISABLE KEYS */;
INSERT INTO `issue_labels` VALUES (1,1),(2,1),(3,3);
/*!40000 ALTER TABLE `issue_labels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `issues`
--

DROP TABLE IF EXISTS `issues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `issues` (
  `issue_id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `issue_number` int NOT NULL,
  `title` varchar(64) NOT NULL,
  `description` text,
  `type` enum('BUG','FEATURE','TASK','OTHER') NOT NULL,
  `status` enum('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  `reporter_id` bigint NOT NULL,
  `assignee_id` bigint DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`issue_id`),
  UNIQUE KEY `uq_issues_num_per_project` (`project_id`,`issue_number`),
  KEY `fk_issues_reporter` (`reporter_id`),
  KEY `fk_issues_assignee` (`assignee_id`),
  CONSTRAINT `fk_issues_assignee` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_issues_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_issues_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `issues`
--

LOCK TABLES `issues` WRITE;
/*!40000 ALTER TABLE `issues` DISABLE KEYS */;
INSERT INTO `issues` VALUES (1,1,1,'Create Mock Data','Mock data needs to be inserted into the database to be used for testing later on.','TASK','CLOSED','HIGH',1,2,NULL,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(2,1,2,'Design Triggers and Routines','Triggers and routines need to be put in place to properly populate default fields, track history, and keep data clean and expressive.','TASK','IN_PROGRESS','MEDIUM',1,2,NULL,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(3,2,1,'Demo Private Project','Private projects should be demonstrated, including their visibility to non-members, comparisons to public projects, and the importance of view roles.','TASK','IN_PROGRESS','MEDIUM',1,2,NULL,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(4,1,3,'Login button unresponsive','Login button does not trigger any network request in Chrome 120','BUG','OPEN','LOW',1,NULL,NULL,'2025-12-05 15:54:01','2025-12-05 15:54:01'),(5,1,4,'Production outage - DB down','Critical production outage due to DB connection pool exhaustion','BUG','RESOLVED','CRITICAL',2,2,NULL,'2025-12-05 15:54:01','2025-12-05 15:54:01');
/*!40000 ALTER TABLE `issues` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_issues_history_create` AFTER INSERT ON `issues` FOR EACH ROW BEGIN
	INSERT INTO issue_history (
		issue_id, 
        changed_by,
        field_name,
        old_value,
        new_value
	) VALUES (
		NEW.issue_id,
        NEW.reporter_id,
        'created',
        NULL,
        NULL
    );
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_issues_history_update` AFTER UPDATE ON `issues` FOR EACH ROW BEGIN
	-- Status change
	IF NEW.status <> OLD.status THEN
		INSERT INTO issue_history (issue_id, changed_by, field_name, old_value, new_value)
        VALUES (
			OLD.issue_id,
            @current_user_id,
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
            @current_user_id,
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
            @current_user_id,
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
            @current_user_id,
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
            @current_user_id,
            'description',
            OLD.description,
            NEW.description
        );
	END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `labels`
--

DROP TABLE IF EXISTS `labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `labels` (
  `label_id` bigint NOT NULL AUTO_INCREMENT,
  `project_id` bigint NOT NULL,
  `name` varchar(32) NOT NULL,
  PRIMARY KEY (`label_id`),
  UNIQUE KEY `uq_labels_name` (`project_id`,`name`),
  CONSTRAINT `fk_labels_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `labels`
--

LOCK TABLES `labels` WRITE;
/*!40000 ALTER TABLE `labels` DISABLE KEYS */;
INSERT INTO `labels` VALUES (2,1,'Frontend'),(1,1,'MVP Requirement'),(4,2,'Main Dev'),(3,2,'Private tag');
/*!40000 ALTER TABLE `labels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_memberships`
--

DROP TABLE IF EXISTS `project_memberships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `project_memberships` (
  `project_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `role` enum('LEAD','DEVELOPER','VIEWER') NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `fk_project_memberships_user` (`user_id`),
  CONSTRAINT `fk_project_memberships_project` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_project_memberships_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_memberships`
--

LOCK TABLES `project_memberships` WRITE;
/*!40000 ALTER TABLE `project_memberships` DISABLE KEYS */;
INSERT INTO `project_memberships` VALUES (1,1,'LEAD','2025-12-05 15:54:01'),(1,2,'DEVELOPER','2025-12-05 15:54:01'),(1,3,'VIEWER','2025-12-05 15:54:01'),(2,1,'LEAD','2025-12-05 15:54:01'),(2,2,'DEVELOPER','2025-12-05 15:54:01');
/*!40000 ALTER TABLE `project_memberships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `project_id` bigint NOT NULL AUTO_INCREMENT,
  `project_key` varchar(16) NOT NULL,
  `name` varchar(64) NOT NULL,
  `description` text,
  `is_public` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`),
  UNIQUE KEY `uq_project_key` (`project_key`),
  KEY `fk_projects_creator` (`created_by`),
  CONSTRAINT `fk_projects_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'ITMS','Issue Tracker','Sample ITMS project.',1,1,'2025-12-05 15:54:01'),(2,'SECR','Secret Project','Private demo project.',0,1,'2025-12-05 15:54:01');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `username` varchar(32) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `first_name` varchar(64) NOT NULL,
  `last_name` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  CONSTRAINT `chk_users_username_format` CHECK (regexp_like(`username`,_utf8mb4'^[A-Za-z0-9_]+$'))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'lead@example.com','lead1','$2b$12$wUqSrNEbEARcOx0Lo17NUOVI/XL0d39oxY7ujNqkhKthFYh3ttn8i','Lena','Lead','2025-12-05 15:54:01'),(2,'dev@example.com','dev1','$2b$12$fIHgDkrBQwfifYy91QL/ou6xHjMYz0RyOAGDSYKPbKkVzTgKii6cG','Devon','Dev','2025-12-05 15:54:01'),(3,'view@example.com','viewer1','$2b$12$VYijeWG2tD1GORqQ4XrHRO9745QA.o6xK.48BB6hjjTFVVDIY3S76','Vera','Viewer','2025-12-05 15:54:01');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'itms'
--

--
-- Dumping routines for database 'itms'
--
/*!50003 DROP PROCEDURE IF EXISTS `sp_create_issue` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_create_issue`(
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-05 15:58:47
