<?php
require_once 'db.php';

$email = "mohdazhanajar@gmail.com"; // the misspelled email

try {
    $stmt = $pdo->prepare("DELETE FROM users WHERE email = ?");
    $stmt->execute([$email]);
    echo "Done! User with email '$email' has been deleted. You can now re-register with the correct email.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
