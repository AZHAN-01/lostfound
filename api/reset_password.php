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

if (empty($data->user_id) || empty($data->otp) || empty($data->new_password)) {
    http_response_code(400);
    echo json_encode(["message" => "User ID, OTP code, and new password are required."]);
    exit;
}

try {
    $user_id = trim($data->user_id);
    $otp = trim($data->otp);
    $new_password = $data->new_password;

    // Fetch matching OTP entry
    $stmt = $pdo->prepare("SELECT * FROM user_otps WHERE user_id = ?");
    $stmt->execute([$user_id]);
    $otp_record = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$otp_record) {
        http_response_code(401);
        echo json_encode(["message" => "Session expired or invalid verification code."]);
        exit;
    }

    // Verify expiration
    if (time() > (int)$otp_record['expires_at']) {
        // Delete expired OTP
        $del_stmt = $pdo->prepare("DELETE FROM user_otps WHERE user_id = ?");
        $del_stmt->execute([$user_id]);

        http_response_code(401);
        echo json_encode(["message" => "Verification code has expired. Please request a new one."]);
        exit;
    }

    // Verify correctness
    if ($otp_record['otp'] !== $otp) {
        http_response_code(401);
        echo json_encode(["message" => "Invalid verification code. Please check and try again."]);
        exit;
    }

    // Hash password securely
    $passwordHash = password_hash($new_password, PASSWORD_DEFAULT);

    // Update password in users table
    $update_stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
    $update_stmt->execute([$passwordHash, $user_id]);

    // Delete verification record to prevent reuse
    $del_stmt = $pdo->prepare("DELETE FROM user_otps WHERE user_id = ?");
    $del_stmt->execute([$user_id]);

    echo json_encode([
        "success" => true,
        "message" => "Password has been reset successfully! You can now sign in with your new password."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Verification and password reset failed: " . $e->getMessage()]);
}
?>
