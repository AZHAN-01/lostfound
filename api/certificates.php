<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $email = isset($_GET['email']) ? trim($_GET['email']) : '';
        if (empty($email)) {
            http_response_code(400);
            echo json_encode(["message" => "Recipient email is required."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `certificates` WHERE `recipientEmail` = ? ORDER BY `createdAt` DESC");
            $stmt->execute([$email]);
            $certs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($certs);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to fetch certificates: " . $e->getMessage()]);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        if (
            empty($data->itemId) ||
            empty($data->recipientName) ||
            empty($data->recipientEmail) ||
            empty($data->itemTitle)
        ) {
            http_response_code(400);
            echo json_encode(["message" => "Incomplete certificate data."]);
            exit;
        }

        $id = 'cert_' . round(microtime(true) * 1000);
        $dateAwarded = isset($data->dateAwarded) ? $data->dateAwarded : date('Y-m-d');
        $createdAt = round(microtime(true) * 1000);

        try {
            $stmt = $pdo->prepare("INSERT INTO `certificates` 
                (id, itemId, recipientName, recipientEmail, itemTitle, dateAwarded, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");
            
            $stmt->execute([
                $id,
                $data->itemId,
                $data->recipientName,
                $data->recipientEmail,
                $data->itemTitle,
                $dateAwarded,
                $createdAt
            ]);

            http_response_code(201);
            echo json_encode([
                "message" => "Certificate created successfully.",
                "id" => $id
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to create certificate: " . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}
?>
