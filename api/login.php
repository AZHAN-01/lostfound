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
require_once __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->identifier) || empty($data->password)) {
    http_response_code(400);
    echo json_encode(["message" => "Identifier (email/phone) and password are required."]);
    exit;
}

try {
    $identifier = trim($data->identifier);
    $password = $data->password;
    $matchedUser = null;

    // Check if identifier is an email (contains '@')
    if (strpos($identifier, '@') !== false) {
        $stmt = $pdo->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)");
        $stmt->execute([$identifier]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $matchedUser = $user;
        }
    } else {
        // Assume phone number: fetch and decrypt to match
        $stmt = $pdo->query("SELECT * FROM users");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $decryptedPhone = decrypt_data($row['phone']);
            if ($decryptedPhone === $identifier) {
                $matchedUser = $row;
                break;
            }
        }
    }

    if (!$matchedUser || !password_verify($password, $matchedUser['password'])) {
        http_response_code(401);
        echo json_encode(["message" => "Invalid email/phone number or password."]);
        exit;
    }

    // Generate 4-digit OTP
    $otp = sprintf("%04d", rand(1000, 9999));
    
    // Determine delivery channel and target (always email now)
    $method = "email";
    $target = $matchedUser['email'];

    // Clear any existing OTP for this user
    $stmt = $pdo->prepare("DELETE FROM user_otps WHERE user_id = ?");
    $stmt->execute([$matchedUser['id']]);

    // Store the OTP securely on the server-side (expires in 5 minutes)
    $expires_at = time() + 300;
    $stmt = $pdo->prepare("INSERT INTO user_otps (user_id, otp, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$matchedUser['id'], $otp, $expires_at]);

    // Dispatch delivery
    $delivery_status = "attempted";
    $delivery_response = null;
    
    // Check if external API credentials are set, otherwise log to server
    if (!empty(SMTP_PASS)) {
        $res = send_real_email($target, $otp);
        $delivery_status = $res['status'] ? "sent" : "failed";
        $delivery_response = $res['response'];
    } else {
        log_secure_otp($matchedUser['id'], "email", $target, $otp);
        $delivery_status = "logged_to_server";
        $delivery_response = json_encode(["success" => true, "message" => "OTP logged to server for local development.", "sandbox_otp" => $otp]);
    }

    $masked_target = ($method === "email") ? mask_email($target) : mask_phone($target);

    // Return reference details WITHOUT the actual OTP code or raw user profile (to prevent leak in dev tools)
    echo json_encode([
        "otp_required" => true,
        "user_id" => $matchedUser['id'],
        "method" => $method,
        "target" => $masked_target,
        "delivery_status" => $delivery_status,
        "delivery_response" => json_decode($delivery_response) !== null ? json_decode($delivery_response) : ["message" => $delivery_response]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Login failed: " . $e->getMessage()]);
}

function mask_email($email) {
    $parts = explode('@', $email);
    if (count($parts) < 2) return $email;
    $name = $parts[0];
    $domain = $parts[1];
    $len = strlen($name);
    if ($len <= 2) {
        return $name[0] . '***@' . $domain;
    }
    return substr($name, 0, 2) . str_repeat('*', $len - 2) . '@' . $domain;
}

function mask_phone($phone) {
    $len = strlen($phone);
    if ($len <= 5) return str_repeat('*', $len);
    return substr($phone, 0, 3) . str_repeat('*', $len - 5) . substr($phone, -2);
}

function log_secure_otp($user_id, $method, $target, $otp) {
    $log_dir = __DIR__ . '/logs';
    if (!is_dir($log_dir)) {
        mkdir($log_dir, 0755, true);
    }
    $log_file = $log_dir . '/secure_debug_otp.log';
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[$timestamp] User ID: $user_id | Method: $method | Target: $target | OTP: $otp\n";
    file_put_contents($log_file, $entry, FILE_APPEND);
    
    // Create htaccess to prevent direct browser access to the log directory
    $htaccess = $log_dir . '/.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Deny from all\n");
    }
}

function send_real_email($to, $otp) {
    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = trim(SMTP_USER);
        $mail->Password   = trim(SMTP_PASS);
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // Enable implicit TLS encryption
        $mail->Port       = 465;

        // Recipients
        $mail->setFrom(trim(SMTP_USER), SMTP_SENDER_NAME);
        $mail->addAddress(trim($to));

        // Content
        $mail->isHTML(true);
        $mail->Subject = 'Your OTP Verification Code';
        $mail->Body    = "<h3>Lost & Found Verification</h3><p>Your 4-digit verification code is: <strong style='font-size: 1.2rem;'>" . $otp . "</strong></p><p>This code is valid for 5 minutes.</p>";
        $mail->AltBody = "Your 4-digit verification code is: " . $otp . "\nThis code is valid for 5 minutes.";

        $mail->send();
        return [
            "status" => true,
            "response" => json_encode(["success" => true, "message" => "Email sent successfully"])
        ];
    } catch (Exception $e) {
        return [
            "status" => false,
            "response" => json_encode(["success" => false, "message" => "Mailer Error: {$mail->ErrorInfo}"])
        ];
    }
}

?>
