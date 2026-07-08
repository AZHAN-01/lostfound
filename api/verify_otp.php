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

if (empty($data->user_id) || empty($data->otp)) {
    http_response_code(400);
    echo json_encode(["message" => "User ID and verification code (OTP) are required."]);
    exit;
}

try {
    $user_id = trim($data->user_id);
    $otp = trim($data->otp);

    // Fetch matching OTP entry
    $stmt = $pdo->prepare("SELECT * FROM `user_otps` WHERE `user_id` = ?");
    $stmt->execute([$user_id]);
    $otp_record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$otp_record) {
        http_response_code(401);
        echo json_encode(["message" => "Session expired or invalid verification code."]);
        exit;
    }

    // Verify expiration (expires_at is a UNIX timestamp in seconds)
    if (time() > (int)$otp_record['expires_at']) {
        // Delete expired OTP
        $del_stmt = $pdo->prepare("DELETE FROM `user_otps` WHERE `user_id` = ?");
        $del_stmt->execute([$user_id]);

        http_response_code(401);
        echo json_encode(["message" => "Verification code has expired. Please log in again to receive a new code."]);
        exit;
    }

    // Verify correctness
    if ($otp_record['otp'] !== $otp) {
        http_response_code(401);
        echo json_encode(["message" => "Invalid verification code. Please check and try again."]);
        exit;
    }

    // OTP matches! Delete verification record to prevent reuse (replay attack prevention)
    $del_stmt = $pdo->prepare("DELETE FROM `user_otps` WHERE `user_id` = ?");
    $del_stmt->execute([$user_id]);

    // Fetch user details for the frontend session
    $user_stmt = $pdo->prepare("SELECT * FROM `users` WHERE `id` = ?");
    $user_stmt->execute([$user_id]);
    $user = $user_stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(["message" => "User record not found."]);
        exit;
    }

    // Respond with full decrypted user object to complete login
    echo json_encode([
        "success" => true,
        "user" => [
            "id" => $user['id'],
            "name" => $user['name'],
            "email" => $user['email'],
            "phone" => decrypt_data($user['phone']),
            "address" => decrypt_data($user['address'])
        ]
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Verification failed: " . $e->getMessage()]);
}
?>
