<?php
require_once 'config.php';

// AES-256-CBC Encryption helpers
function encrypt_data($data) {
    if ($data === null || $data === '') return '';
    $key = ENCRYPTION_KEY;
    $iv_length = openssl_cipher_iv_length('aes-256-cbc');
    $iv = openssl_random_pseudo_bytes($iv_length);
    $ciphertext = openssl_encrypt($data, 'aes-256-cbc', $key, 0, $iv);
    // Base64 encode IV and ciphertext separately and join them
    return base64_encode($iv) . '::' . base64_encode($ciphertext);
}

function decrypt_data($data) {
    if ($data === null || $data === '') return '';
    $key = ENCRYPTION_KEY;
    $parts = explode('::', $data, 2);
    if (count($parts) === 2) {
        $iv = base64_decode($parts[0], true);
        $ciphertext = base64_decode($parts[1], true);
        if ($iv !== false && $ciphertext !== false) {
            $decrypted = openssl_decrypt($ciphertext, 'aes-256-cbc', $key, 0, $iv);
            if ($decrypted !== false) {
                return $decrypted;
            }
        }
    }
    return $data; // Fallback to original text if decryption fails
}

try {
    // Connect to MySQL server without DB first
    $pdo = new PDO("mysql:host=" . DB_HOST, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Increase max allowed packet to support base64 queries up to 32MB
    try {
        $pdo->exec("SET GLOBAL max_allowed_packet = 33554432");
    } catch (Exception $e) {
        // Ignore if DB user doesn't have SUPER privileges
    }
    
    // Create database if not exists
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    
    // Connect to the database
    $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create Users table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
        `id` VARCHAR(50) PRIMARY KEY,
        `name` VARCHAR(100) NOT NULL,
        `email` VARCHAR(100) UNIQUE NOT NULL,
        `phone` TEXT NOT NULL,
        `address` TEXT NOT NULL,
        `password` VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB");
    
    // Create Items table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `items` (
        `id` VARCHAR(50) PRIMARY KEY,
        `title` VARCHAR(255) NOT NULL,
        `category` VARCHAR(50) NOT NULL,
        `status` VARCHAR(20) NOT NULL,
        `date` VARCHAR(20) NOT NULL,
        `location` VARCHAR(255) NOT NULL,
        `description` TEXT NOT NULL,
        `image` LONGTEXT NOT NULL,
        `reporterName` VARCHAR(100) NOT NULL,
        `reporterEmail` VARCHAR(100) NOT NULL,
        `reporterPhone` TEXT NOT NULL,
        `reporterAddress` TEXT NOT NULL,
        `createdAt` BIGINT NOT NULL,
        INDEX `idx_createdAt` (`createdAt`),
        INDEX `idx_status` (`status`)
    ) ENGINE=InnoDB");
    
    // Create Saved Docs table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `saved_docs` (
        `id` VARCHAR(50) PRIMARY KEY,
        `userId` VARCHAR(50) NOT NULL,
        `name` TEXT NOT NULL,
        `type` TEXT NOT NULL,
        `docId` TEXT NOT NULL,
        `holderName` TEXT NOT NULL,
        `expiryDate` TEXT NOT NULL,
        `rawText` LONGTEXT NOT NULL,
        `image` LONGTEXT NOT NULL,
        `createdAt` BIGINT NOT NULL
    ) ENGINE=InnoDB");

    // Create Certificates table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `certificates` (
        `id` VARCHAR(50) PRIMARY KEY,
        `itemId` VARCHAR(50) NOT NULL,
        `recipientName` VARCHAR(100) NOT NULL,
        `recipientEmail` VARCHAR(100) NOT NULL,
        `itemTitle` VARCHAR(255) NOT NULL,
        `dateAwarded` VARCHAR(20) NOT NULL,
        `createdAt` BIGINT NOT NULL
    ) ENGINE=InnoDB");

    // Create User OTPs table for secure server-side verification
    $pdo->exec("CREATE TABLE IF NOT EXISTS `user_otps` (
        `user_id` VARCHAR(50) PRIMARY KEY,
        `otp` VARCHAR(10) NOT NULL,
        `expires_at` BIGINT NOT NULL,
        FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB");



} catch (PDOException $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
    exit;
}
?>
