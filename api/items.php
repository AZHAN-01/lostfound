<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Cache the response for 10 seconds on the client and 30 seconds on proxies
    // This dramatically reduces backend load and improves mobile loading speed
    header("Cache-Control: public, max-age=10, s-maxage=30");
}

switch ($method) {
    case 'GET':
        try {
            $stmt = $pdo->query("SELECT * FROM `items` ORDER BY `createdAt` DESC");
            $items = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $row['reporterPhone'] = decrypt_data($row['reporterPhone']);
                $row['reporterAddress'] = decrypt_data($row['reporterAddress']);
                $items[] = $row;
            }
            echo json_encode($items);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to fetch items: " . $e->getMessage()]);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        if (
            empty($data->id) ||
            empty($data->title) ||
            empty($data->category) ||
            empty($data->status) ||
            empty($data->date) ||
            empty($data->location) ||
            empty($data->description) ||
            empty($data->reporterName) ||
            empty($data->reporterEmail) ||
            empty($data->reporterPhone) ||
            empty($data->reporterAddress)
        ) {
            http_response_code(400);
            echo json_encode(["message" => "Incomplete item data."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO `items` 
                (id, title, category, status, date, location, description, image, reporterName, reporterEmail, reporterPhone, reporterAddress, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $image = isset($data->image) ? $data->image : '';
            $createdAt = isset($data->createdAt) ? $data->createdAt : round(microtime(true) * 1000);

            $encryptedPhone = encrypt_data($data->reporterPhone);
            $encryptedAddress = encrypt_data($data->reporterAddress);

            $stmt->execute([
                $data->id,
                $data->title,
                $data->category,
                $data->status,
                $data->date,
                $data->location,
                $data->description,
                $image,
                $data->reporterName,
                $data->reporterEmail,
                $encryptedPhone,
                $encryptedAddress,
                $createdAt
            ]);

            http_response_code(201);
            echo json_encode(["message" => "Item reported successfully."]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to report item: " . $e->getMessage()]);
        }
        break;

    case 'PUT':
        $data = json_decode(file_get_contents("php://input"));
        if (empty($data->id) || empty($data->status)) {
            http_response_code(400);
            echo json_encode(["message" => "Item ID and status are required."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("UPDATE `items` SET `status` = ? WHERE `id` = ?");
            $stmt->execute([$data->status, $data->id]);
            echo json_encode(["message" => "Item status updated successfully."]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to update item status: " . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $itemId = isset($_GET['id']) ? $_GET['id'] : '';
        $userEmail = isset($_GET['email']) ? $_GET['email'] : '';

        if (empty($itemId) || empty($userEmail)) {
            http_response_code(400);
            echo json_encode(["message" => "Item ID and user email are required for deletion."]);
            exit;
        }

        try {
            // Fetch the item to verify ownership
            $stmt = $pdo->prepare("SELECT `reporterEmail` FROM `items` WHERE `id` = ?");
            $stmt->execute([$itemId]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$item) {
                http_response_code(404);
                echo json_encode(["message" => "Item not found."]);
                exit;
            }

            if (strtolower($item['reporterEmail']) !== strtolower($userEmail)) {
                http_response_code(403);
                echo json_encode(["message" => "Unauthorized to delete this listing."]);
                exit;
            }

            $deleteStmt = $pdo->prepare("DELETE FROM `items` WHERE `id` = ?");
            $deleteStmt->execute([$itemId]);

            // Also delete any associated certificates for this item
            $deleteCertStmt = $pdo->prepare("DELETE FROM `certificates` WHERE `itemId` = ?");
            $deleteCertStmt->execute([$itemId]);

            echo json_encode(["message" => "Item listing deleted successfully."]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to delete item: " . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}
?>
