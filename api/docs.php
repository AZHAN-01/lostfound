<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $userId = isset($_GET['userId']) ? $_GET['userId'] : '';
        if (empty($userId)) {
            http_response_code(400);
            echo json_encode(["message" => "userId is required."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM `saved_docs` WHERE `userId` = ? ORDER BY `createdAt` DESC");
            $stmt->execute([$userId]);
            $docs = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                // Decrypt all encrypted metadata fields before serving to owner
                $row['name'] = decrypt_data($row['name']);
                $row['type'] = decrypt_data($row['type']);
                $row['docId'] = decrypt_data($row['docId']);
                $row['holderName'] = decrypt_data($row['holderName']);
                $row['expiryDate'] = decrypt_data($row['expiryDate']);
                $row['rawText'] = decrypt_data($row['rawText']);
                $row['image'] = decrypt_data($row['image']);
                $docs[] = $row;
            }
            echo json_encode($docs);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to fetch documents: " . $e->getMessage()]);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        if (
            empty($data->id) ||
            empty($data->userId) ||
            empty($data->name) ||
            empty($data->type)
        ) {
            http_response_code(400);
            echo json_encode(["message" => "Incomplete document data."]);
            exit;
        }

        try {
            $stmt = $pdo->prepare("INSERT INTO `saved_docs` 
                (id, userId, name, type, docId, holderName, expiryDate, rawText, image, createdAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $docId = isset($data->docId) ? $data->docId : '';
            $holderName = isset($data->holderName) ? $data->holderName : '';
            $expiryDate = isset($data->expiryDate) ? $data->expiryDate : '';
            $rawText = isset($data->rawText) ? $data->rawText : '';
            $image = isset($data->image) ? $data->image : '';
            $createdAt = isset($data->createdAt) ? $data->createdAt : round(microtime(true) * 1000);

            // Encrypt all document contents
            $encName = encrypt_data($data->name);
            $encType = encrypt_data($data->type);
            $encDocId = encrypt_data($docId);
            $encHolder = encrypt_data($holderName);
            $encExpiry = encrypt_data($expiryDate);
            $encRawText = encrypt_data($rawText);
            $encImage = encrypt_data($image);

            $stmt->execute([
                $data->id,
                $data->userId,
                $encName,
                $encType,
                $encDocId,
                $encHolder,
                $encExpiry,
                $encRawText,
                $encImage,
                $createdAt
            ]);

            http_response_code(201);
            echo json_encode(["message" => "Document saved securely to Safe Locker."]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to save document: " . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $docId = isset($_GET['id']) ? $_GET['id'] : '';
        $userId = isset($_GET['userId']) ? $_GET['userId'] : '';

        if (empty($docId) || empty($userId)) {
            http_response_code(400);
            echo json_encode(["message" => "Document ID and User ID are required."]);
            exit;
        }

        try {
            // Verify ownership
            $stmt = $pdo->prepare("SELECT `userId` FROM `saved_docs` WHERE `id` = ?");
            $stmt->execute([$docId]);
            $doc = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$doc) {
                http_response_code(404);
                echo json_encode(["message" => "Document not found."]);
                exit;
            }

            if ($doc['userId'] !== $userId) {
                http_response_code(403);
                echo json_encode(["message" => "Unauthorized to delete this document scan."]);
                exit;
            }

            $deleteStmt = $pdo->prepare("DELETE FROM `saved_docs` WHERE `id` = ?");
            $deleteStmt->execute([$docId]);

            echo json_encode(["message" => "Document scan deleted successfully."]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["message" => "Failed to delete document: " . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed."]);
        break;
}
?>
