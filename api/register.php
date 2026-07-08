<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (
    empty($data->id) ||
    empty($data->name) ||
    empty($data->email) ||
    empty($data->phone) ||
    empty($data->address) ||
    empty($data->password)
) {
    http_response_code(400);
    echo json_encode(["message" => "Incomplete data. All fields are required."]);
    exit;
}

try {
    // Check if email already exists (stored in plaintext)
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM `users` WHERE LOWER(`email`) = LOWER(?)");
    $stmt->execute([$data->email]);
    if ($stmt->fetchColumn() > 0) {
        http_response_code(409);
        echo json_encode(["message" => "This email is already registered."]);
        exit;
    }

    // Check if phone number already exists
    // Since phone is encrypted, we fetch all users and decrypt their phone numbers to verify duplicates.
    $stmt = $pdo->query("SELECT `phone` FROM `users`");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        if (decrypt_data($row['phone']) === $data->phone) {
            http_response_code(409);
            echo json_encode(["message" => "This phone number is already registered."]);
            exit;
        }
    }

    // Encrypt phone and address
    $encryptedPhone = encrypt_data($data->phone);
    $encryptedAddress = encrypt_data($data->address);
    // Hash password securely
    $passwordHash = password_hash($data->password, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("INSERT INTO `users` (id, name, email, phone, address, password) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $data->id,
        $data->name,
        $data->email,
        $encryptedPhone,
        $encryptedAddress,
        $passwordHash
    ]);

    http_response_code(201);
    echo json_encode(["message" => "Account registered successfully!"]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Registration failed: " . $e->getMessage()]);
}
?>
