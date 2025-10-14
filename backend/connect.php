<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

// DB 서버 정보
$host = "localhost";   // 서버 주소 (보통 그대로)
$port = "3306";
$username = "root";          // MySQL 사용자명
$password = "root";              // MySQL 비밀번호 (있으면 입력)
$dbname = "capstone_db";     // 사용할 데이터베이스 이름

try {
    $pdo = new PDO(
        "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "success" => false,
        "message" => "DB 연결 실패: " . $e->getMessage()
    ]);
    exit;
}
