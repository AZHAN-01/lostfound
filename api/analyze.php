<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Method not allowed."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"));

if (empty($data->image)) {
    http_response_code(400);
    echo json_encode(["message" => "Base64 image data is required."]);
    exit;
}

if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY)) {
    http_response_code(412);
    echo json_encode(["message" => "Gemini API key is not configured. Falling back to local OCR."]);
    exit;
}

try {
    $base64Data = $data->image;
    if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
        $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
        $mimeType = "image/" . strtolower($type[1]);
    } else {
        $mimeType = "image/jpeg";
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" . GEMINI_API_KEY;

    $payload = [
        "contents" => [
            [
                "parts" => [
                    [
                        "text" => "Analyze this document image. Extract the following details:
                        1. Document Type (must be exactly one of: 'passport', 'driver_license', 'student_id', 'credit_card', 'receipt', 'other')
                        2. Document Name (a reader-friendly title like 'US Passport' or 'California Driver's License')
                        3. Document ID (the serial/license/passport number)
                        4. Holder Name (full name of the document owner)
                        5. Expiry Date (format as YYYY-MM-DD or 'N/A')
                        6. Raw Text (a full transcription of the text found on the document)

                        Return the result strictly as a raw JSON block (no markdown formatting, no ```json tags) matching this schema:
                        {
                          \"type\": \"...\",
                          \"name\": \"...\",
                          \"id\": \"...\",
                          \"holderName\": \"...\",
                          \"expiryDate\": \"...\",
                          \"rawText\": \"...\"
                        }"
                    ],
                    [
                        "inlineData" => [
                            "mimeType" => $mimeType,
                            "data" => $base64Data
                        ]
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
    
    if (curl_errno($ch)) {
        throw new Exception(curl_error($ch));
    }
    curl_close($ch);

    if ($httpCode !== 200) {
        http_response_code($httpCode);
        echo json_encode(["message" => "Gemini API Error: " . $response]);
        exit;
    }

    $result = json_decode($response);
    if (!isset($result->candidates[0]->content->parts[0]->text)) {
        throw new Exception("Unexpected response structure from Gemini API: " . $response);
    }
    
    $rawJsonText = $result->candidates[0]->content->parts[0]->text;
    
    // Validate if it is valid JSON
    $parsedDetails = json_decode(trim($rawJsonText));
    if (!$parsedDetails) {
        throw new Exception("Invalid JSON returned by Gemini: " . $rawJsonText);
    }

    echo json_encode($parsedDetails);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Analysis failed: " . $e->getMessage()]);
}
?>
