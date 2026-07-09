<?php
if (file_exists('config.php')) {
    require_once 'config.php';
} else {
    // When deployed to Render, config.php won't exist because it is in .gitignore.
    // Instead, we define the required constants securely from Render's Environment Variables.
    define('DB_HOST', getenv('DB_HOST'));
    define('DB_USER', getenv('DB_USER'));
    define('DB_PASS', getenv('DB_PASS'));
    define('DB_NAME', getenv('DB_NAME'));
    define('DB_PORT', getenv('DB_PORT'));
    define('ENCRYPTION_KEY', getenv('ENCRYPTION_KEY'));
    define('GEMINI_API_KEY', getenv('GEMINI_API_KEY'));
    define('RESEND_API_KEY', getenv('RESEND_API_KEY'));
    define('RESEND_SENDER_EMAIL', getenv('RESEND_SENDER_EMAIL'));
    define('RESEND_SENDER_NAME', getenv('RESEND_SENDER_NAME'));
}

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
    // Connect directly to the database using PostgreSQL DSN
    // pgsql:host=...;port=...;dbname=...;sslmode=require
    $dsn = "pgsql:host=" . DB_HOST . (defined('DB_PORT') ? ";port=" . DB_PORT : "") . ";dbname=" . DB_NAME;
    
    // Aiven requires sslmode=require which can be appended or handled by PDO options
    $dsn .= ";sslmode=require";

    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create Users table
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        password VARCHAR(255) NOT NULL
    )");
    
    // Create Items table
    $pdo->exec("CREATE TABLE IF NOT EXISTS items (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL,
        date VARCHAR(20) NOT NULL,
        location VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        image TEXT NOT NULL,
        \"reporterName\" VARCHAR(100) NOT NULL,
        \"reporterEmail\" VARCHAR(100) NOT NULL,
        \"reporterPhone\" TEXT NOT NULL,
        \"reporterAddress\" TEXT NOT NULL,
        \"createdAt\" BIGINT NOT NULL
    )");
    
    // Create Indexes for Items table
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_createdAt ON items (\"createdAt\")");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_status ON items (status)");
    
    // Create Saved Docs table
    $pdo->exec("CREATE TABLE IF NOT EXISTS saved_docs (
        id VARCHAR(50) PRIMARY KEY,
        \"userId\" VARCHAR(50) NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        \"docId\" TEXT NOT NULL,
        \"holderName\" TEXT NOT NULL,
        \"expiryDate\" TEXT NOT NULL,
        \"rawText\" TEXT NOT NULL,
        image TEXT NOT NULL,
        \"createdAt\" BIGINT NOT NULL
    )");

    // Create Certificates table
    $pdo->exec("CREATE TABLE IF NOT EXISTS certificates (
        id VARCHAR(50) PRIMARY KEY,
        \"itemId\" VARCHAR(50) NOT NULL,
        \"recipientName\" VARCHAR(100) NOT NULL,
        \"recipientEmail\" VARCHAR(100) NOT NULL,
        \"itemTitle\" VARCHAR(255) NOT NULL,
        \"dateAwarded\" VARCHAR(20) NOT NULL,
        \"createdAt\" BIGINT NOT NULL
    )");

    // Create User OTPs table for secure server-side verification
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_otps (
        user_id VARCHAR(50) PRIMARY KEY,
        otp VARCHAR(10) NOT NULL,
        expires_at BIGINT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )");

} catch (PDOException $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
    exit;
}
?>
