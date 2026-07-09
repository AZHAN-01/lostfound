<?php
require_once 'db.php';

$phone = "6006993965"; // the phone number to delete
$email = "mohdazhanajar@gmail.com"; // the misspelled email

try {
    $stmt = $pdo->prepare("DELETE FROM users WHERE email = ?");
    $stmt->execute([$email]);
    echo "Successfully deleted user with email: $email\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
