<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

// Check if Gemini API key is configured
if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY)) {
    http_response_code(412);
    echo json_encode(["message" => "Gemini API key is not configured."]);
    exit;
}

try {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" . GEMINI_API_KEY;

    $payload = [
        "contents" => [
            [
                "parts" => [
                    [
                        "text" => "Generate an inspirational quote related to a 'Lost & Found' theme (topics like finding lost items, returning lost things to others, community honesty, hope, discovery, recovery, or returning home). The quote should feel deep, warm, and meaningful. Return the quote with an author (either a famous historical person, classic figure, or a descriptive placeholder like 'Community Member' or a wise proverb). 

                        Return the result strictly as a JSON object matching this schema:
                        {
                          \"text\": \"...\",
                          \"author\": \"...\"
                        }"
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

    $responseData = json_decode($response, true);
    if (isset($responseData['candidates'][0]['content']['parts'][0]['text'])) {
        $quoteJsonText = $responseData['candidates'][0]['content']['parts'][0]['text'];
        
        // Output the raw quote JSON object directly
        echo $quoteJsonText;
    } else {
        throw new Exception("Unexpected API response structure.");
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["message" => "Server Error: " . $e->getMessage()]);
}
?>
