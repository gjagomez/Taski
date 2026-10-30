-- TaskiTask · Gestión de tareas y proyectos
-- Esquema y datos de demostración (generado 2026-10-22).
-- La API crea esta misma base sola al arrancar (Backend/src/db/schema.js); este archivo es la alternativa manual:
--   mysql -u root -p < database/gestor_proyectos.sql
-- Usuarios demo: admin@gestor.com / Admin123!  ·  maria|carlos|ana@gestor.com / Miembro123!

CREATE DATABASE IF NOT EXISTS gestor_proyectos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestor_proyectos;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `activity_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int DEFAULT NULL,
  `board_id` int DEFAULT NULL,
  `user_id` int NOT NULL,
  `action` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activity_log_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `activity_log_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `activity_log` WRITE;
/*!40000 ALTER TABLE `activity_log` DISABLE KEYS */;
INSERT INTO `activity_log` VALUES (1,NULL,1,1,'BOARD_CREATED','Creó el tablero \"Sprint 1 · Desarrollo\"','2026-09-30 09:00:00'),(2,1,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-02 09:00:00'),(3,1,1,1,'ASSIGNED','Asignó la tarea a Carlos Pérez','2026-10-02 09:05:00'),(4,1,1,3,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-03 10:00:00'),(5,1,1,3,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-04 11:00:00'),(6,1,1,1,'COMPLETED','Aprobó la revisión y cerró la tarea (Completado)','2026-10-05 12:00:00'),(7,2,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-04 09:00:00'),(8,2,1,1,'ASSIGNED','Asignó la tarea a María López','2026-10-04 09:05:00'),(9,2,1,2,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-05 10:00:00'),(10,2,1,2,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-06 11:00:00'),(11,2,1,1,'COMPLETED','Aprobó la revisión y cerró la tarea (Completado)','2026-10-07 12:00:00'),(12,2,1,1,'COMMENTED','Agregó un comentario','2026-10-11 15:00:00'),(13,3,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-10 09:00:00'),(14,3,1,1,'ASSIGNED','Asignó la tarea a María López','2026-10-10 09:05:00'),(15,3,1,2,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-11 10:00:00'),(16,3,1,2,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-12 11:00:00'),(17,4,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-13 09:00:00'),(18,4,1,1,'ASSIGNED','Asignó la tarea a Carlos Pérez','2026-10-13 09:05:00'),(19,4,1,3,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-14 10:00:00'),(20,5,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-12 09:00:00'),(21,5,1,1,'ASSIGNED','Asignó la tarea a Ana Gómez','2026-10-12 09:05:00'),(22,5,1,4,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-13 10:00:00'),(23,5,1,1,'COMMENTED','Agregó un comentario','2026-10-21 15:00:00'),(24,5,1,4,'COMMENTED','Agregó un comentario','2026-10-21 15:00:00'),(25,6,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-16 09:00:00'),(26,7,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-17 09:00:00'),(27,7,1,1,'ASSIGNED','Asignó la tarea a Ana Gómez','2026-10-17 09:05:00'),(28,8,1,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-14 09:00:00'),(29,NULL,2,1,'BOARD_CREATED','Creó el tablero \"QA · Bug Tracker\"','2026-09-30 09:00:00'),(30,9,2,1,'CREATED','Creó la incidencia (bug) en \"Por hacer\"','2026-10-08 09:00:00'),(31,9,2,1,'ASSIGNED','Asignó la tarea a María López','2026-10-08 09:05:00'),(32,9,2,2,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-09 10:00:00'),(33,9,2,2,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-10 11:00:00'),(34,9,2,4,'REJECTED','QA detectó defectos: regresó a \"En progreso\" — Sigue aceptando \"usuario@dominio\" sin TLD','2026-10-11 12:00:00'),(35,9,2,2,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-12 13:00:00'),(36,9,2,1,'COMPLETED','Aprobó la revisión y cerró la tarea (Completado)','2026-10-13 14:00:00'),(37,9,2,4,'COMMENTED','Agregó un comentario','2026-10-08 15:00:00'),(38,9,2,4,'COMMENTED','Agregó un comentario','2026-10-10 15:00:00'),(39,10,2,1,'CREATED','Creó la incidencia (bug) en \"Por hacer\"','2026-10-13 09:00:00'),(40,10,2,1,'ASSIGNED','Asignó la tarea a Carlos Pérez','2026-10-13 09:05:00'),(41,10,2,3,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-14 10:00:00'),(42,10,2,3,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-15 11:00:00'),(43,10,2,1,'COMPLETED','Aprobó la revisión y cerró la tarea (Completado)','2026-10-16 12:00:00'),(44,10,2,1,'COMMENTED','Agregó un comentario','2026-10-16 15:00:00'),(45,11,2,1,'CREATED','Creó la incidencia (bug) en \"Por hacer\"','2026-10-18 09:00:00'),(46,11,2,1,'ASSIGNED','Asignó la tarea a María López','2026-10-18 09:05:00'),(47,11,2,2,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-19 10:00:00'),(48,11,2,2,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-20 11:00:00'),(49,12,2,1,'CREATED','Creó la incidencia (bug) en \"Por hacer\"','2026-10-20 09:00:00'),(50,12,2,1,'ASSIGNED','Asignó la tarea a Carlos Pérez','2026-10-20 09:05:00'),(51,12,2,3,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-21 10:00:00'),(52,NULL,3,1,'BOARD_CREATED','Creó el tablero \"Campaña digital\"','2026-09-30 09:00:00'),(53,13,3,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-07 09:00:00'),(54,13,3,1,'ASSIGNED','Asignó la tarea a Ana Gómez','2026-10-07 09:05:00'),(55,13,3,4,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-08 10:00:00'),(56,13,3,4,'MOVED','Movió de \"En progreso\" a \"En revisión / QA\"','2026-10-09 11:00:00'),(57,13,3,1,'COMPLETED','Aprobó la revisión y cerró la tarea (Completado)','2026-10-10 12:00:00'),(58,14,3,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-16 09:00:00'),(59,14,3,1,'ASSIGNED','Asignó la tarea a Ana Gómez','2026-10-16 09:05:00'),(60,14,3,4,'MOVED','Movió de \"Por hacer\" a \"En progreso\"','2026-10-17 10:00:00'),(61,15,3,1,'CREATED','Creó la tarea en \"Por hacer\"','2026-10-19 09:00:00');
/*!40000 ALTER TABLE `activity_log` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `board_columns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `board_columns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `board_id` int NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('BACKLOG','IN_PROGRESS','REVIEW','DONE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `color` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `board_id` (`board_id`),
  CONSTRAINT `board_columns_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `board_columns` WRITE;
/*!40000 ALTER TABLE `board_columns` DISABLE KEYS */;
INSERT INTO `board_columns` VALUES (1,1,'Por hacer','BACKLOG',0,'#a3a1fb'),(2,1,'En progreso','IN_PROGRESS',1,'#fdab3d'),(3,1,'En revisión / QA','REVIEW',2,'#579bfc'),(4,1,'Completado','DONE',3,'#00c875'),(5,2,'Por hacer','BACKLOG',0,'#a3a1fb'),(6,2,'En progreso','IN_PROGRESS',1,'#fdab3d'),(7,2,'En revisión / QA','REVIEW',2,'#579bfc'),(8,2,'Completado','DONE',3,'#00c875'),(9,3,'Por hacer','BACKLOG',0,'#a3a1fb'),(10,3,'En progreso','IN_PROGRESS',1,'#fdab3d'),(11,3,'En revisión / QA','REVIEW',2,'#579bfc'),(12,3,'Completado','DONE',3,'#00c875');
/*!40000 ALTER TABLE `board_columns` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `board_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `board_members` (
  `board_id` int NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`board_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `board_members_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `board_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `board_members` WRITE;
/*!40000 ALTER TABLE `board_members` DISABLE KEYS */;
INSERT INTO `board_members` VALUES (1,1),(2,1),(3,1),(1,2),(2,2),(1,3),(2,3),(1,4),(2,4),(3,4);
/*!40000 ALTER TABLE `board_members` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `boards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `boards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `boards_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `boards_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `boards` WRITE;
/*!40000 ALTER TABLE `boards` DISABLE KEYS */;
INSERT INTO `boards` VALUES (1,1,'Sprint 1 · Desarrollo','Construcción de los módulos principales',1,'2026-09-30 09:00:00'),(2,1,'QA · Bug Tracker','Defectos encontrados durante las pruebas',1,'2026-09-30 09:00:00'),(3,2,'Campaña digital',NULL,1,'2026-09-30 09:00:00');
/*!40000 ALTER TABLE `boards` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `checklist_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `checklist_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subtask_id` int NOT NULL,
  `text` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `done` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `subtask_id` (`subtask_id`),
  CONSTRAINT `checklist_items_ibfk_1` FOREIGN KEY (`subtask_id`) REFERENCES `subtasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `checklist_items` WRITE;
/*!40000 ALTER TABLE `checklist_items` DISABLE KEYS */;
INSERT INTO `checklist_items` VALUES (1,1,'Entidades',1),(2,1,'Relaciones',1),(3,4,'8+ caracteres',1),(4,4,'Mayúscula y número',1),(5,4,'Carácter especial',1),(6,10,'Bloquear edición',1),(7,10,'Bloquear movimiento',0);
/*!40000 ALTER TABLE `checklist_items` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `user_id` int NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES (1,2,1,'Probado con 5 correos inválidos, todos rechazados ✅','2026-10-11 15:00:00'),(2,5,1,'Esta tarea ya superó su fecha límite, ¿necesitas apoyo?','2026-10-21 15:00:00'),(3,5,4,'Sí, me falta la gráfica. La termino mañana.','2026-10-21 15:00:00'),(4,9,4,'🐞 Defectos detectados en QA: Sigue aceptando \"usuario@dominio\" sin TLD','2026-10-11 12:00:00'),(5,9,4,'Reproducido en registro y en recuperación de contraseña.','2026-10-08 15:00:00'),(6,9,4,'Re-test OK. Se cierra el defecto.','2026-10-10 15:00:00'),(7,10,1,'Defecto cerrado: validado vía API y vía tablero.','2026-10-16 15:00:00');
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `pending_registrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pending_registrations` (
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `ws_subitem_comments`;
DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6d5df6',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `projects_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'Sistema de Gestión de Tareas','Proyecto final de Aseguramiento de la Calidad del Software (SDLC aplicado al propio sistema).','#6d5df6',1,'2026-09-27 09:00:00'),(2,'Lanzamiento Marketing Q4','Campaña de fin de año','#f45b69',1,'2026-09-27 09:00:00');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role_id` int NOT NULL,
  `permission` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`role_id`,`permission`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,'boards.manage'),(1,'files.deleteAny'),(1,'projects.assignOthers'),(1,'projects.changeStage'),(1,'projects.viewAll'),(1,'roles.manage'),(1,'subitems.manageAll'),(1,'users.manage');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6d5df6',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'Administrador','Acceso total al sistema.','#6d5df6','ADMIN','2026-10-22 21:37:31'),(2,'Colaborador','Trabaja en los proyectos donde está asignado.','#00c875','MEMBER','2026-10-22 21:37:31'),(3,'QA','Revisa los proyectos enviados a QA: registra sus pruebas, los aprueba o los devuelve al programador.','#579bfc','QA','2026-10-27 09:00:00');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `subtasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `subtasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('PENDING','DONE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_id` (`task_id`),
  CONSTRAINT `subtasks_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `subtasks` WRITE;
/*!40000 ALTER TABLE `subtasks` DISABLE KEYS */;
INSERT INTO `subtasks` VALUES (1,1,'Diagrama ER','DONE','2026-10-02 09:00:00'),(2,1,'Script DDL','DONE','2026-10-02 09:00:00'),(3,2,'Validar formato de correo','DONE','2026-10-04 09:00:00'),(4,2,'Validar fortaleza de contraseña','DONE','2026-10-04 09:00:00'),(5,2,'Recuperación de contraseña','DONE','2026-10-04 09:00:00'),(6,3,'Columnas por estado','DONE','2026-10-10 09:00:00'),(7,3,'Arrastrar y soltar','DONE','2026-10-10 09:00:00'),(8,4,'Requiere responsable para iniciar','DONE','2026-10-13 09:00:00'),(9,4,'Subtareas completas para revisión','DONE','2026-10-13 09:00:00'),(10,4,'Completado como estado final','PENDING','2026-10-13 09:00:00'),(11,5,'Tarjetas de indicadores','DONE','2026-10-12 09:00:00'),(12,5,'Gráfica por estado','PENDING','2026-10-12 09:00:00'),(13,5,'Listado de vencidas','PENDING','2026-10-12 09:00:00'),(14,7,'Casos de autenticación','PENDING','2026-10-17 09:00:00'),(15,7,'Casos de subtareas','PENDING','2026-10-17 09:00:00'),(16,9,'Corregir expresión regular','DONE','2026-10-08 09:00:00'),(17,9,'Re-ejecutar CP-02','DONE','2026-10-08 09:00:00'),(18,10,'Validar transición en el servidor','DONE','2026-10-13 09:00:00'),(19,11,'Recalcular estado de subtarea','DONE','2026-10-18 09:00:00'),(20,14,'Instagram','DONE','2026-10-16 09:00:00'),(21,14,'LinkedIn','PENDING','2026-10-16 09:00:00');
/*!40000 ALTER TABLE `subtasks` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `board_id` int NOT NULL,
  `column_id` int NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `type` enum('TASK','BUG') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TASK',
  `priority` enum('HIGH','MEDIUM','LOW') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'MEDIUM',
  `labels` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `acceptance_criteria` text COLLATE utf8mb4_unicode_ci,
  `assignee_id` int DEFAULT NULL,
  `created_by` int NOT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `position` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `board_id` (`board_id`),
  KEY `column_id` (`column_id`),
  KEY `assignee_id` (`assignee_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tasks_ibfk_2` FOREIGN KEY (`column_id`) REFERENCES `board_columns` (`id`),
  CONSTRAINT `tasks_ibfk_3` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `tasks_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `tasks` WRITE;
/*!40000 ALTER TABLE `tasks` DISABLE KEYS */;
INSERT INTO `tasks` VALUES (1,1,4,'Diseñar modelo de base de datos','Modelo entidad-relación con proyectos, tableros, columnas, tareas y subtareas.','TASK','HIGH','backend,base de datos','El script crea todas las tablas con llaves foráneas.',3,1,'2026-10-02','2026-10-07','2026-10-05 12:00:00',0,'2026-10-02 09:00:00','2026-10-22 21:37:32'),(2,1,4,'Implementar login y registro','Autenticación con JWT, validación de correo y fortaleza de contraseña.','TASK','HIGH','auth,seguridad','No se permite registrar contraseñas débiles ni correos inválidos.',2,1,'2026-10-05','2026-10-12','2026-10-07 12:00:00',1,'2026-10-04 09:00:00','2026-10-22 21:37:32'),(3,1,3,'Tablero Kanban con drag & drop','Mover tarjetas entre columnas respetando las reglas de transición.','TASK','HIGH','frontend,ux','Una tarea no puede saltar de \"Por hacer\" a \"Completado\".',2,1,'2026-10-12','2026-10-24',NULL,0,'2026-10-10 09:00:00','2026-10-22 21:37:32'),(4,1,2,'Reglas de transición de estados','Validar en el servidor el ciclo de vida de la tarea.','TASK','HIGH','backend,workflow',NULL,3,1,'2026-10-15','2026-10-25',NULL,0,'2026-10-13 09:00:00','2026-10-22 21:37:32'),(5,1,2,'Dashboard con métricas','Resumen por proyecto: totales, completadas, en progreso y vencidas.','TASK','MEDIUM','frontend,reportes',NULL,4,1,'2026-10-14','2026-10-20',NULL,1,'2026-10-12 09:00:00','2026-10-22 21:37:32'),(6,1,1,'Bitácora de actividad por tarea','Registrar quién creó, movió y comentó cada tarea.','TASK','MEDIUM','trazabilidad',NULL,NULL,1,NULL,'2026-10-29',NULL,0,'2026-10-16 09:00:00','2026-10-22 21:37:32'),(7,1,1,'Plan de pruebas y casos de prueba','Alcance, tipos de prueba, criterios de entrada/salida y 8+ casos.','TASK','MEDIUM','qa,documentación',NULL,4,1,'2026-10-23','2026-10-27',NULL,1,'2026-10-17 09:00:00','2026-10-22 21:37:32'),(8,1,1,'Configurar despliegue',NULL,'TASK','LOW','devops',NULL,NULL,1,NULL,'2026-10-21',NULL,2,'2026-10-14 09:00:00','2026-10-22 21:37:32'),(9,2,8,'Login acepta correos sin dominio','CP-02: Al registrar \"usuario@dominio\" el sistema lo aceptaba.','BUG','HIGH','bug,auth','El registro rechaza correos sin dominio de nivel superior.',2,1,'2026-10-08','2026-10-10','2026-10-13 14:00:00',0,'2026-10-08 09:00:00','2026-10-22 21:37:32'),(10,2,8,'Tarea se podía mover de \"Por hacer\" a \"Completado\"','CP-05: La validación solo existía en la UI; la API permitía cualquier transición.','BUG','HIGH','bug,workflow','La API responde TRANSITION_NOT_ALLOWED en saltos inválidos.',3,1,'2026-10-13','2026-10-16','2026-10-16 12:00:00',1,'2026-10-13 09:00:00','2026-10-22 21:37:32'),(11,2,7,'Porcentaje no se actualiza al marcar checklist','CP-07: Al completar todo el checklist la subtarea seguía pendiente.','BUG','MEDIUM','bug,subtareas',NULL,2,1,'2026-10-19','2026-10-24',NULL,0,'2026-10-18 09:00:00','2026-10-22 21:37:32'),(12,2,6,'Fecha límite permite ser menor a la de inicio','CP-08: Se pudo guardar inicio 10/10 y fin 05/10.','BUG','LOW','bug,fechas',NULL,3,1,'2026-10-21','2026-10-26',NULL,0,'2026-10-20 09:00:00','2026-10-22 21:37:32'),(13,3,12,'Definir buyer persona',NULL,'TASK','MEDIUM','estrategia',NULL,4,1,NULL,'2026-10-14','2026-10-10 12:00:00',0,'2026-10-07 09:00:00','2026-10-22 21:37:32'),(14,3,10,'Calendario de publicaciones',NULL,'TASK','HIGH','redes',NULL,4,1,'2026-10-18','2026-10-26',NULL,0,'2026-10-16 09:00:00','2026-10-22 21:37:32'),(15,3,9,'Diseño de banners',NULL,'TASK','LOW','diseño',NULL,NULL,1,NULL,'2026-11-01',NULL,0,'2026-10-19 09:00:00','2026-10-22 21:37:32');
/*!40000 ALTER TABLE `tasks` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `avatar_color` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6d5df6',
  `reset_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_expires` datetime DEFAULT NULL,
  `reset_attempts` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Administrador General','admin@gestor.com','$2b$10$nzK3pipw68PnOTIZ5Gxg0ufeHFrIIOcc7JBjj2UEkjWRdSrQ3lpcm',1,1,'#6d5df6',NULL,NULL,0,'2026-09-22 09:00:00'),(2,'María López','maria@gestor.com','$2b$10$EBGpvMqn2KlkTCy1omzscOj7wl4pJVoE/EWpAV2IuYRcIVT2cNC8u',2,1,'#f45b69',NULL,NULL,0,'2026-09-22 09:00:00'),(3,'Carlos Pérez','carlos@gestor.com','$2b$10$LaF9yTlekHDWV8gKgF9T2.QwPgwbD0LL9g1nNcQLhyAOnRAD9WNti',2,1,'#00c875',NULL,NULL,0,'2026-09-22 09:00:00'),(4,'Ana Gómez','ana@gestor.com','$2b$10$W6azD78syum6.JC12xvreOie66ljA0ayhsp0GVUtzI3qe1rI1749q',2,1,'#fdab3d',NULL,NULL,0,'2026-09-22 09:00:00');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_activity`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_activity` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `user_id` int NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ws_activity_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `ws_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_activity_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_activity` WRITE;
/*!40000 ALTER TABLE `ws_activity` DISABLE KEYS */;
INSERT INTO `ws_activity` VALUES (1,1,1,'Creó el elemento en \"En Análisis\"','2026-10-22 21:37:32'),(2,2,1,'Creó el elemento en \"En Desarrollo\"','2026-10-22 21:37:32'),(3,3,1,'Creó el elemento en \"En Desarrollo\"','2026-10-22 21:37:32'),(4,4,1,'Creó el elemento en \"En QA & Seguridad\"','2026-10-22 21:37:32'),(5,5,1,'Creó el elemento en \"En Producción\"','2026-10-22 21:37:32'),(6,6,1,'Creó el elemento en \"En Espera\"','2026-10-22 21:37:32'),(7,7,1,'Creó el elemento en \"En Desarrollo\"','2026-10-22 21:37:32'),(8,8,1,'Creó el elemento en \"Detenido\"','2026-10-22 21:37:32'),(9,9,1,'Creó el elemento en \"En Análisis\"','2026-10-22 21:37:32');
/*!40000 ALTER TABLE `ws_activity` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_boards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_boards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `folder` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `ws_boards_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_boards` WRITE;
/*!40000 ALTER TABLE `ws_boards` DISABLE KEYS */;
INSERT INTO `ws_boards` VALUES (1,'Nuevo','2026',NULL,1,'2026-10-22 21:37:32'),(2,'Billetera','2026',NULL,1,'2026-10-22 21:37:32'),(3,'PRONET','2026',NULL,1,'2026-10-22 21:37:32');
/*!40000 ALTER TABLE `ws_boards` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_folders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_folders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `ws_folders_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_folders` WRITE;
/*!40000 ALTER TABLE `ws_folders` DISABLE KEYS */;
/*!40000 ALTER TABLE `ws_folders` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `board_id` int NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `board_id` (`board_id`),
  CONSTRAINT `ws_groups_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `ws_boards` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_groups` WRITE;
/*!40000 ALTER TABLE `ws_groups` DISABLE KEYS */;
INSERT INTO `ws_groups` VALUES (1,1,'En Desarrollo','#fdab3d',0),(2,1,'En QA & Seguridad','#579bfc',1),(3,1,'En Producción','#00c875',2),(4,1,'Detenido','#e2445c',3),(5,1,'En Espera','#a25ddc',4),(6,1,'En Análisis','#ff7a45',5),(7,2,'En Desarrollo','#fdab3d',0),(8,2,'En QA & Seguridad','#579bfc',1),(9,2,'En Producción','#00c875',2),(10,2,'Detenido','#e2445c',3),(11,2,'En Espera','#a25ddc',4),(12,2,'En Análisis','#ff7a45',5),(13,3,'En Desarrollo','#fdab3d',0),(14,3,'En QA & Seguridad','#579bfc',1),(15,3,'En Producción','#00c875',2),(16,3,'Detenido','#e2445c',3),(17,3,'En Espera','#a25ddc',4),(18,3,'En Análisis','#ff7a45',5);
/*!40000 ALTER TABLE `ws_groups` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_item_assignees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_item_assignees` (
  `item_id` int NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`item_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ws_item_assignees_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `ws_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_item_assignees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_item_assignees` WRITE;
/*!40000 ALTER TABLE `ws_item_assignees` DISABLE KEYS */;
INSERT INTO `ws_item_assignees` VALUES (3,2),(4,2),(5,2),(8,2),(1,3),(2,3),(3,3),(7,3),(9,4);
/*!40000 ALTER TABLE `ws_item_assignees` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_item_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_item_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` int NOT NULL,
  `data` longblob NOT NULL,
  `uploaded_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `ws_item_files_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `ws_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_item_files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_item_files` WRITE;
/*!40000 ALTER TABLE `ws_item_files` DISABLE KEYS */;
/*!40000 ALTER TABLE `ws_item_files` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `board_id` int NOT NULL,
  `group_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requesters` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `area` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `position` int NOT NULL DEFAULT '0',
  `created_by` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `board_id` (`board_id`),
  KEY `group_id` (`group_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `ws_items_ibfk_1` FOREIGN KEY (`board_id`) REFERENCES `ws_boards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_items_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `ws_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_items_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_items` WRITE;
/*!40000 ALTER TABLE `ws_items` DISABLE KEYS */;
INSERT INTO `ws_items` VALUES (1,1,6,'MATRIZ DE REFINANCIAMIENTO CON CAMBIO DE PRODUCTO','Gerencia de Negocios','Créditos','2026-10-28',0,1,'2026-10-22 21:37:32'),(2,1,1,'Fábrica de Créditos - mejoras','Operaciones','Créditos','2026-11-01',1,1,'2026-10-22 21:37:32'),(3,1,1,'Protocolos Push - Abasto',NULL,'Canales digitales','2026-11-05',2,1,'2026-10-22 21:37:32'),(4,1,2,'Integración de funcionalidad de conversión de prospecto a formularios',NULL,'CRM','2026-10-26',3,1,'2026-10-22 21:37:32'),(5,1,3,'MEJORAS ABASTO WEB','Mercadeo','Canales digitales','2026-10-19',4,1,'2026-10-22 21:37:32'),(6,1,5,'Portal de autogestión de clientes',NULL,'Canales digitales','2026-11-21',5,1,'2026-10-22 21:37:32'),(7,2,7,'Pagos con código QR',NULL,'Pagos','2026-11-03',0,1,'2026-10-22 21:37:32'),(8,2,10,'Recarga de saldo internacional',NULL,'Pagos','2026-10-17',1,1,'2026-10-22 21:37:32'),(9,3,18,'Integración de pagos de servicios',NULL,'Integraciones','2026-11-11',0,1,'2026-10-22 21:37:32');
/*!40000 ALTER TABLE `ws_items` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_subitems`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_subitems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `assignee_id` int DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','DONE') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `hours` decimal(6,2) DEFAULT NULL,
  `position` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `assignee_id` (`assignee_id`),
  CONSTRAINT `ws_subitems_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `ws_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_subitems_ibfk_2` FOREIGN KEY (`assignee_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_subitems` WRITE;
/*!40000 ALTER TABLE `ws_subitems` DISABLE KEYS */;
INSERT INTO `ws_subitems` VALUES (1,1,'Análisis',3,'DONE','2026-10-14','2026-10-14',NULL,8.00,0,'2026-10-22 21:37:32'),(2,1,'Integración de productos',3,'IN_PROGRESS','2026-10-20','2026-10-20',NULL,4.00,1,'2026-10-22 21:37:32'),(3,1,'Integración y validación de subproductos',3,'PENDING','2026-10-21','2026-10-21',NULL,4.00,2,'2026-10-22 21:37:32'),(4,1,'Pruebas de funcionalidad',4,'PENDING','2026-10-24','2026-10-24',NULL,4.00,3,'2026-10-22 21:37:32'),(5,1,'Documentación QA',4,'PENDING','2026-10-25','2026-10-25',NULL,4.00,4,'2026-10-22 21:37:32'),(6,2,'Levantamiento de requerimientos',2,'DONE','2026-10-12','2026-10-12',NULL,6.00,0,'2026-10-22 21:37:32'),(7,2,'Ajuste de flujo de aprobación',3,'IN_PROGRESS','2026-10-24','2026-10-25',NULL,12.00,1,'2026-10-22 21:37:32'),(8,2,'Pruebas integrales',4,'PENDING','2026-10-30','2026-10-30',NULL,8.00,2,'2026-10-22 21:37:32'),(9,3,'Diseño de notificaciones',2,'DONE','2026-10-17','2026-10-17',NULL,4.00,0,'2026-10-22 21:37:32'),(10,3,'Servicio de envío push',3,'IN_PROGRESS','2026-10-25','2026-10-26',NULL,10.00,1,'2026-10-22 21:37:32'),(11,4,'Pruebas de seguridad (OWASP)',4,'IN_PROGRESS','2026-10-23','2026-10-23',NULL,6.00,0,'2026-10-22 21:37:32'),(12,4,'Pruebas de regresión',4,'IN_PROGRESS','2026-10-21','2026-10-21',NULL,4.00,1,'2026-10-22 21:37:32'),(13,5,'Despliegue',3,'DONE','2026-10-18','2026-10-18',NULL,2.00,0,'2026-10-22 21:37:32'),(14,5,'Monitoreo post-producción',2,'DONE','2026-10-19','2026-10-19',NULL,2.00,1,'2026-10-22 21:37:32'),(15,7,'Generación de QR',3,'IN_PROGRESS','2026-10-27','2026-10-27',NULL,8.00,0,'2026-10-22 21:37:32'),(16,7,'Conciliación',2,'PENDING','2026-11-01','2026-11-01',NULL,6.00,1,'2026-10-22 21:37:32'),(17,8,'Contrato con proveedor',2,'IN_PROGRESS','2026-10-16','2026-10-16',NULL,2.00,0,'2026-10-22 21:37:32'),(18,9,'Revisión de API',4,'IN_PROGRESS','2026-10-24','2026-10-24',NULL,4.00,0,'2026-10-22 21:37:32');
/*!40000 ALTER TABLE `ws_subitems` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_update_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_update_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `update_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` int NOT NULL,
  `data` mediumblob NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `update_id` (`update_id`),
  CONSTRAINT `ws_update_images_ibfk_1` FOREIGN KEY (`update_id`) REFERENCES `ws_updates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_update_images` WRITE;
/*!40000 ALTER TABLE `ws_update_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `ws_update_images` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `ws_updates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ws_updates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` int NOT NULL,
  `user_id` int NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `item_id` (`item_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ws_updates_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `ws_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_updates_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `ws_updates` WRITE;
/*!40000 ALTER TABLE `ws_updates` DISABLE KEYS */;
/*!40000 ALTER TABLE `ws_updates` ENABLE KEYS */;
UNLOCK TABLES;
-- Revisión QA: QA que prueba el proyecto, programador que lo envió (recibe los bugs), tipo de subtarea y datos de los bugs
ALTER TABLE `ws_items` ADD COLUMN `qa_id` int DEFAULT NULL AFTER `due_date`, ADD COLUMN `developer_id` int DEFAULT NULL AFTER `qa_id`;
ALTER TABLE `ws_subitems` ADD COLUMN `kind` enum('DEV','QA','BUG') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DEV' AFTER `name`,
  ADD COLUMN `severity` enum('CRITICAL','HIGH','MEDIUM','LOW') COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `kind`,
  ADD COLUMN `steps` text COLLATE utf8mb4_unicode_ci AFTER `severity`,
  ADD COLUMN `parent_id` int DEFAULT NULL AFTER `steps`,
  ADD COLUMN `reported_by` int DEFAULT NULL AFTER `parent_id`,
  ADD COLUMN `test_id` int DEFAULT NULL AFTER `reported_by`,
  ADD COLUMN `reopen_count` int NOT NULL DEFAULT '0' AFTER `reported_by`,
  ADD COLUMN `verified_at` datetime DEFAULT NULL AFTER `completed_at`;
-- Evidencia de los bugs (imágenes y videos): archivos del proyecto vinculados a la subtarea
ALTER TABLE `ws_item_files` ADD COLUMN `subitem_id` int DEFAULT NULL AFTER `item_id`;
-- Comentarios por subtarea: resolución de bugs y verificación del QA (trazabilidad)
CREATE TABLE `ws_subitem_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `subitem_id` int NOT NULL,
  `user_id` int NOT NULL,
  `kind` enum('COMMENT','RESOLUTION','VERIFIED','REOPENED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'COMMENT',
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `subitem_id` (`subitem_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `ws_subitem_comments_ibfk_1` FOREIGN KEY (`subitem_id`) REFERENCES `ws_subitems` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ws_subitem_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;


SET NAMES utf8mb4;
-- Defectos reales del proyecto (BUG-01 a BUG-03), registrados y cerrados en el tablero "QA · Bug Tracker" el 2026-10-28,
-- con sus comentarios de resolución y su bitácora.
SET FOREIGN_KEY_CHECKS=0;
INSERT INTO `tasks` (`board_id`, `column_id`, `title`, `description`, `type`, `priority`, `labels`, `acceptance_criteria`, `assignee_id`, `created_by`, `start_date`, `due_date`, `completed_at`, `position`, `created_at`, `updated_at`) VALUES (2, 8, 'BUG-01: La recuperación de contraseña mostraba el código en pantalla', 'Fuera de producción, la API devolvía el código de verificación de 6 dígitos a la pantalla. Conociendo solo el correo de otra persona se podía cambiar su contraseña.\nPasos: 1) \"Olvidé mi contraseña\" con el correo de otro usuario. 2) El código aparece en pantalla. 3) Se cambia la contraseña ajena.', 'BUG', 'HIGH', 'seguridad,autenticación', 'El código solo llega por correo; únicamente se muestra en desarrollo si el correo no se pudo enviar. Caso CP-04 (código CP-03) en PASÓ.', 1, 1, NULL, NULL, '2026-10-28 21:21:35', 2, '2026-10-28 21:21:34', '2026-10-28 21:21:35');
SET @bug = LAST_INSERT_ID();
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'Resolución: el código se envía por correo (Mailjet) y la API ya no lo devuelve; solo se muestra en desarrollo cuando el envío falla, nunca en producción. Verificado con CP-04 (npm test: 30/30).', '2026-10-28 21:21:34', @bug);
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'QA: caso de prueba re-ejecutado (regresión con npm test) y criterio de aceptación cumplido. Se aprueba el cierre.', '2026-10-28 21:21:34', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'CREATED', 'Creó la incidencia (bug) en \"Por hacer\"', '2026-10-28 21:21:34', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"Por hacer\" a \"En progreso\"', '2026-10-28 21:21:34', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 21:21:34', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"En progreso\" a \"En revisión / QA\"', '2026-10-28 21:21:34', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMPLETED', 'Aprobó la revisión y cerró la tarea (Completado)', '2026-10-28 21:21:35', @bug);
INSERT INTO `tasks` (`board_id`, `column_id`, `title`, `description`, `type`, `priority`, `labels`, `acceptance_criteria`, `assignee_id`, `created_by`, `start_date`, `due_date`, `completed_at`, `position`, `created_at`, `updated_at`) VALUES (2, 8, 'BUG-02: El código de recuperación no tenía límite de intentos', 'El código de 6 dígitos podía probarse sin límite: un atacante podía recorrer los 900.000 códigos posibles durante los 15 minutos de validez (fuerza bruta).\nPasos: 1) Pedir un código. 2) Enviar códigos incorrectos repetidamente: nunca se bloquea.', 'BUG', 'HIGH', 'seguridad,autenticación', 'Máximo 5 intentos y luego el código se anula; un código nuevo cada 60 s; código aleatorio criptográfico. Caso CP-04 en PASÓ.', 1, 1, NULL, NULL, '2026-10-28 21:21:35', 3, '2026-10-28 21:21:35', '2026-10-28 21:21:35');
SET @bug = LAST_INSERT_ID();
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'Resolución: se guarda el número de intentos; al 5.º fallo el código se anula, se limita a un código cada 60 s y se genera con crypto.randomInt. Verificado con CP-04 (\"Te quedan 4 intentos\").', '2026-10-28 21:21:35', @bug);
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'QA: caso de prueba re-ejecutado (regresión con npm test) y criterio de aceptación cumplido. Se aprueba el cierre.', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'CREATED', 'Creó la incidencia (bug) en \"Por hacer\"', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"Por hacer\" a \"En progreso\"', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"En progreso\" a \"En revisión / QA\"', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMPLETED', 'Aprobó la revisión y cerró la tarea (Completado)', '2026-10-28 21:21:35', @bug);
INSERT INTO `tasks` (`board_id`, `column_id`, `title`, `description`, `type`, `priority`, `labels`, `acceptance_criteria`, `assignee_id`, `created_by`, `start_date`, `due_date`, `completed_at`, `position`, `created_at`, `updated_at`) VALUES (2, 8, 'BUG-03: Un colaborador podía asignar a otras personas a un proyecto', 'En la columna Asignación de un proyecto, un colaborador sin el permiso \"Asignar a otras personas\" podía agregar o quitar a cualquier usuario; la regla solo existía para las subtareas.\nPasos: 1) Entrar como maria@gestor.com. 2) Abrir un proyecto propio. 3) Agregar a Carlos en Asignación: se guardaba.', 'BUG', 'HIGH', 'permisos,roles', 'El servidor rechaza la asignación de terceros sin el permiso y la interfaz solo ofrece al propio usuario. Prueba unitaria CP-U09 en PASÓ.', 1, 1, NULL, NULL, '2026-10-28 21:21:36', 4, '2026-10-28 21:21:35', '2026-10-28 21:21:36');
SET @bug = LAST_INSERT_ID();
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'Resolución: nueva regla projectAssigneesError en Backend/src/wsWorkflow.js validada en la API y selector limitado en la interfaz. Verificado con CP-U09.', '2026-10-28 21:21:35', @bug);
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'QA: caso de prueba re-ejecutado (regresión con npm test) y criterio de aceptación cumplido. Se aprueba el cierre.', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'CREATED', 'Creó la incidencia (bug) en \"Por hacer\"', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"Por hacer\" a \"En progreso\"', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"En progreso\" a \"En revisión / QA\"', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 21:21:35', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMPLETED', 'Aprobó la revisión y cerró la tarea (Completado)', '2026-10-28 21:21:36', @bug);
SET FOREIGN_KEY_CHECKS=1;

-- BUG-04 (encontrado en uso real el 2026-10-28): aprobación explícita del QA para pasar a Producción.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
INSERT INTO `tasks` (`board_id`, `column_id`, `title`, `description`, `type`, `priority`, `labels`, `acceptance_criteria`, `assignee_id`, `created_by`, `start_date`, `due_date`, `completed_at`, `position`, `created_at`, `updated_at`) VALUES (2, 8, 'BUG-04: Al finalizar sus pruebas, el QA pasaba el proyecto a Producción sin aprobarlo', 'Encontrado en uso real (28/10/2026, proyectos 48 y 49). La QA anotó los defectos como pruebas suyas (\"Bug login\") en lugar de usar \"Devolver a desarrollo\" y las finalizó. El sistema tomaba \"todas las pruebas finalizadas y 0 bugs sin verificar\" como aprobación y movía el proyecto solo a \"En Producción\": el programador nunca recibió los defectos.\nPasos: 1) Enviar un proyecto a QA. 2) Como QA, agregar una prueba llamada \"Bug login\". 3) Finalizar todas las pruebas. 4) El proyecto aparece en \"En Producción\".', 'BUG', 'HIGH', 'workflow,qa', 'Finalizar las pruebas no cambia la etapa; el proyecto pasa a Producción solo con la aprobación explícita del QA (approveWsItemQa), con pruebas finalizadas y bugs verificados. Casos CP-14, CP-17 y CP-U09c en PASÓ.', 1, 1, NULL, NULL, '2026-10-28 23:04:57', 5, '2026-10-28 23:04:57', '2026-10-28 23:04:57');
SET @bug = LAST_INSERT_ID();
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'Resolución: se eliminó la promoción automática (promoteIfQaDone). Nueva regla qaApproveError en Backend/src/wsWorkflow.js y mutación approveWsItemQa: solo el QA asignado (o un administrador) aprueba, con las pruebas finalizadas y los bugs verificados. En el proyecto, botón \"Aprobar y pasar a Producción\" con confirmación. Los proyectos 48 y 49 se regresaron a QA. npm test: 32/32.', '2026-10-28 23:04:57', @bug);
INSERT INTO `comments` (`user_id`, `body`, `created_at`, `task_id`) VALUES (1, 'QA: caso de prueba re-ejecutado (regresión con npm test) y criterio de aceptación cumplido. Se aprueba el cierre.', '2026-10-28 23:04:57', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'CREATED', 'Creó la incidencia (bug) en \"Por hacer\"', '2026-10-28 23:04:57', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"Por hacer\" a \"En progreso\"', '2026-10-28 23:04:57', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 23:04:57', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'MOVED', 'Movió de \"En progreso\" a \"En revisión / QA\"', '2026-10-28 23:04:57', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMMENTED', 'Agregó un comentario', '2026-10-28 23:04:57', @bug);
INSERT INTO `activity_log` (`board_id`, `user_id`, `action`, `detail`, `created_at`, `task_id`) VALUES (2, 1, 'COMPLETED', 'Aprobó la revisión y cerró la tarea (Completado)', '2026-10-28 23:04:57', @bug);
SET FOREIGN_KEY_CHECKS=1;
