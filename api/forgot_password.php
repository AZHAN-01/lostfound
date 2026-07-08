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

if (empty($data->identifier)) {
    http_response_code(400);
    echo json_encode(["message" => "Identifier (email/phone) is required."]);
    exit;
}

try {
    $identifier = trim($data->identifier);
    $matchedUser = null;

    // Check if identifier is an email
    if (strpos($identifier, '@') !== false) {
        $stmt = $pdo->prepare("SELECT * FROM `users` WHERE LOWER(`email`) = LOWER(?)");
        $stmt->execute([$identifier]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) {
            $matchedUser = $user;
        }
    } else {
        // Assume phone number: fetch and decrypt to match
        $stmt = $pdo->query("SELECT * FROM `users`");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $decryptedPhone = decrypt_data($row['phone']);
            if ($decryptedPhone === $identifier) {
                $matchedUser = $row;
                break;
            }
        }
    }

    if (!$matchedUser) {
        http_response_code(404);
        echo json_encode(["message" => "No account found with that email or phone number."]);
        exit;
    }

    // Generate 4-digit OTP
    $otp = sprintf("%04d", rand(1000, 9999));
    
    $method = "email";
    $target = $matchedUser['email'];

    // Clear any existing OTP for this user
    $stmt = $pdo->prepare("DELETE FROM `user_otps` WHERE `user_id` = ?");
    $stmt->execute([$matchedUser['id']]);

    // Store the OTP securely (expires in 5 minutes)
    $expires_at = time() + 300;
    $stmt = $pdo->prepare("INSERT INTO `user_otps` (`user_id`, `otp`, `expires_at`) VALUES (?, ?, ?)");
    $stmt->execute([$matchedUser['id'], $otp, $expires_at]);

    // Dispatch delivery
    $delivery_status = "attempted";
    $delivery_response = null;
    
    // Check if external API credentials are set, otherwise log to server
    if (!empty(RESEND_API_KEY)) {
        $res = send_real_email($target, $otp);
        $delivery_status = $res['status'] ? "sent" : "failed";
        $delivery_response = $res['response'];
    } else {
        log_secure_otp($matchedUser['id'], "email", $target, $otp);
        $delivery_status = "logged_to_server";
        $delivery_response = json_encode(["success" => true, "message" => "OTP logged to server for local development."]);
    }

    $masked_target = mask_email($target);

    echo json_encode([
        "success" => true,
        "user_id" => $matchedUser['id'],
        "method" => $method,
        "target" => $masked_target,
        "delivery_status" => $delivery_status,
        "delivery_response" => json_decode($delivery_response) !== null ? json_decode($delivery_response) : ["message" => $delivery_response]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Failed to request password reset: " . $e->getMessage()]);
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

function log_secure_otp($user_id, $method, $target, $otp) {
    $log_file = __DIR__ . '/secure_debug_otp.log';
    $timestamp = date('Y-m-d H:i:s');
    $entry = "[$timestamp] Forgot Password - User ID: $user_id | Method: $method | Target: $target | OTP: $otp\n";
    file_put_contents($log_file, $entry, FILE_APPEND);
    
    // Create htaccess to prevent direct browser access to the log file
    $htaccess = __DIR__ . '/.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "Deny from all\n");
    }
}

function send_real_email($to, $otp) {
    $url = "https://api.resend.com/emails";
    $payload = json_encode([
        "from" => RESEND_SENDER_NAME . " <" . RESEND_SENDER_EMAIL . ">",
        "to" => [$to],
        "subject" => "Your Password Reset OTP",
        "html" => "<h3>Password Reset Code</h3><p>Your 4-digit code to reset your password is: <strong style='font-size: 1.2rem;'>" . $otp . "</strong></p><p>This code is valid for 5 minutes.</p>"
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . RESEND_API_KEY,
        'Content-Type: application/json'
    ]);
    
    $response = curl_exec($ch);
    $err = curl_error($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    
    if ($response === false) {
        return [
            "status" => false,
            "response" => json_encode(["success" => false, "message" => "cURL Error: " . $err])
        ];
    }
    return [
        "status" => ($info['http_code'] >= 200 && $info['http_code'] < 300),
        "response" => $response
    ];
}
?>
