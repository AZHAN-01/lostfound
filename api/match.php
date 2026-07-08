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
    // 1. Fetch and prepare all locker documents
    $stmt = $pdo->query("SELECT * FROM `saved_docs`");
    $lockerDocs = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $lockerDocs[] = [
            "id" => $row['id'],
            "name" => decrypt_data($row['name']),
            "type" => decrypt_data($row['type']),
            "docId" => decrypt_data($row['docId']),
            "holderName" => decrypt_data($row['holderName']),
            "userId" => $row['userId']
        ];
    }

    // 2. Fetch and prepare all lost items
    $stmt = $pdo->prepare("SELECT * FROM `items` WHERE `status` = 'lost' ORDER BY `createdAt` DESC");
    $stmt->execute();
    $lostItems = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $lostItems[] = [
            "id" => $row['id'],
            "title" => $row['title'],
            "category" => $row['category'],
            "location" => $row['location'],
            "description" => $row['description'],
            "reporterName" => $row['reporterName'],
            "reporterEmail" => $row['reporterEmail']
        ];
    }

    $matchedResult = null;

    // Try to run matching using Google Gemini API if key is configured
    if (defined('GEMINI_API_KEY') && !empty(GEMINI_API_KEY)) {
        try {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" . GEMINI_API_KEY;

            $promptText = "You are an AI Lost & Found matching engine. Your goal is to match a newly scanned/found document against a list of lost listings and user document lockers.

Scanned Found Document:
- Document Type: {$type}
- Document ID / Number: {$docId}
- Holder Name: {$holderName}

Database of Lost Document Reports:
" . json_encode($lostItems) . "

Database of User Document Lockers (saved_docs):
" . json_encode($lockerDocs) . "

Instructions:
1. Compare the Scanned Found Document against both lists.
2. Determine if it matches any document in either list.
   - Look for matches by comparing Holder Name (allow nicknames, minor spelling variations, middle name inclusion, or formatting differences).
   - Look for matches by comparing Document ID / Number (allow spaces, hyphens, prefixes, suffixes, or formatting changes).
   - Type/category and description details can be used to help confirm matches.
3. If you find a match, identify the record ID and specify whether the source is 'locker' (from the User Document Lockers list) or 'lost_report' (from the Lost Document Reports list).
4. Return the result strictly as a raw JSON block matching this schema:
{
  \"matched\": true,
  \"source\": \"locker\" or \"lost_report\",
  \"id\": \"matched_record_id\"
}
If no match is found, return:
{
  \"matched\": false,
  \"source\": null,
  \"id\": null
}";

            $payload = [
                "contents" => [
                    [
                        "parts" => [
                            [
                                "text" => $promptText
                            ]
                        ]
                    ]
                ],
                "generationConfig" => [
                    "responseMimeType" => "application/json"
                ]
            ];

            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200) {
                $responseData = json_decode($response, true);
                if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
                    $matchJsonText = $responseData['candidates'][0]['content']['parts'][0]['text'];
                    $matchData = json_decode(trim($matchJsonText), true);
                    
                    if ($matchData && isset($matchData['matched']) && $matchData['matched'] === true) {
                        $matchedResult = [
                            "source" => $matchData['source'],
                            "id" => $matchData['id']
                        ];
                    }
                }
            }
        } catch (Exception $e) {
            // Log or ignore to fallback to local matching
        }
    }

    // Fallback to local regex matching if Gemini was unavailable or found no match
    if (!$matchedResult) {
        // 1. Local check in user locker documents
        foreach ($lockerDocs as $row) {
            $matchById = (!empty($docId) && !empty($row['docId']) && strtolower(trim($row['docId'])) === strtolower($docId));
            $matchByName = (!empty($holderName) && !empty($row['holderName']) && strtolower(trim($row['holderName'])) === strtolower($holderName));
            if ($matchById || $matchByName) {
                $matchedResult = [
                    "source" => "locker",
                    "id" => $row['id']
                ];
                break;
            }
        }

        // 2. Local check in reported lost items
        if (!$matchedResult) {
            foreach ($lostItems as $row) {
                $descLower = strtolower($row['description']);
                $titleLower = strtolower($row['title']);
                $matchById = (!empty($docId) && (strpos($descLower, strtolower($docId)) !== false || strpos($titleLower, strtolower($docId)) !== false));
                $matchByName = (!empty($holderName) && (strpos($descLower, strtolower($holderName)) !== false || strpos($titleLower, strtolower($holderName)) !== false));
                if ($matchById || $matchByName) {
                    $matchedResult = [
                        "source" => "lost_report",
                        "id" => $row['id']
                    ];
                    break;
                }
            }
        }
    }

    // 3. Resolve matched owner details
    $matchedOwner = null;
    if ($matchedResult) {
        if ($matchedResult['source'] === 'locker') {
            // Find the owner user of the locker document
            $docStmt = $pdo->prepare("SELECT `userId` FROM `saved_docs` WHERE `id` = ?");
            $docStmt->execute([$matchedResult['id']]);
            $docRecord = $docStmt->fetch(PDO::FETCH_ASSOC);
            if ($docRecord) {
                $userStmt = $pdo->prepare("SELECT * FROM `users` WHERE `id` = ?");
                $userStmt->execute([$docRecord['userId']]);
                $owner = $userStmt->fetch(PDO::FETCH_ASSOC);
                if ($owner) {
                    $matchedOwner = [
                        "name" => $owner['name'],
                        "email" => $owner['email'],
                        "phone" => decrypt_data($owner['phone']),
                        "address" => decrypt_data($owner['address']),
                        "source" => "locker"
                    ];
                }
            }
        } else if ($matchedResult['source'] === 'lost_report') {
            // Find the reporter of the lost item
            $itemStmt = $pdo->prepare("SELECT * FROM `items` WHERE `id` = ?");
            $itemStmt->execute([$matchedResult['id']]);
            $itemRecord = $itemStmt->fetch(PDO::FETCH_ASSOC);
            if ($itemRecord) {
                $matchedOwner = [
                    "name" => $itemRecord['reporterName'],
                    "email" => $itemRecord['reporterEmail'],
                    "phone" => decrypt_data($itemRecord['reporterPhone']),
                    "address" => decrypt_data($itemRecord['reporterAddress']),
                    "source" => "lost_report"
                ];
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
