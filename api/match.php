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

$docId = isset($data->docId) ? trim($data->docId) : '';
$holderName = isset($data->holderName) ? trim($data->holderName) : '';
$type = isset($data->type) ? trim($data->type) : '';

if (empty($docId) && empty($holderName)) {
    http_response_code(400);
    echo json_encode(["message" => "At least docId or holderName is required to run a match search."]);
    exit;
}

try {
    $matchedOwner = null;

    // 1. Try to search in user locker documents (saved_docs)
    $stmt = $pdo->query("SELECT * FROM `saved_docs`");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $decDocId = decrypt_data($row['docId']);
        $decHolder = decrypt_data($row['holderName']);

        $matchById = (!empty($docId) && !empty($decDocId) && strtolower(trim($decDocId)) === strtolower($docId));
        $matchByName = (!empty($holderName) && !empty($decHolder) && strtolower(trim($decHolder)) === strtolower($holderName));

        if ($matchById || $matchByName) {
            // Find owner user details
            $userStmt = $pdo->prepare("SELECT * FROM `users` WHERE `id` = ?");
            $userStmt->execute([$row['userId']]);
            $owner = $userStmt->fetch(PDO::FETCH_ASSOC);

            if ($owner) {
                $matchedOwner = [
                    "name" => $owner['name'],
                    "email" => $owner['email'],
                    "phone" => decrypt_data($owner['phone']),
                    "address" => decrypt_data($owner['address']),
                    "source" => "locker"
                ];
                break; // Stop on first matched owner
            }
        }
    }

    // 2. If no locker match found, check reported lost listings (items)
    if (!$matchedOwner) {
        $stmt = $pdo->prepare("SELECT * FROM `items` WHERE `status` = 'lost' ORDER BY `createdAt` DESC");
        $stmt->execute();
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $descLower = strtolower($row['description']);
            $titleLower = strtolower($row['title']);

            $matchById = (!empty($docId) && (strpos($descLower, strtolower($docId)) !== false || strpos($titleLower, strtolower($docId)) !== false));
            $matchByName = (!empty($holderName) && (strpos($descLower, strtolower($holderName)) !== false || strpos($titleLower, strtolower($holderName)) !== false));

            if ($matchById || $matchByName) {
                $matchedOwner = [
                    "name" => $row['reporterName'],
                    "email" => $row['reporterEmail'],
                    "phone" => decrypt_data($row['reporterPhone']),
                    "address" => decrypt_data($row['reporterAddress']),
                    "source" => "lost_report"
                ];
                break;
            }
        }
    }

    if ($matchedOwner) {
        echo json_encode([
            "matched" => true,
            "owner" => $matchedOwner
        ]);
    } else {
        echo json_encode([
            "matched" => false,
            "message" => "No owner match found in the database records."
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["message" => "Database search failed: " . $e->getMessage()]);
}
?>
