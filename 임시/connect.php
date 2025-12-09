<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json; charset=utf-8');

// DB 서버 정보
$host = 'localhost';
$username = 'capstone3d'; # MySQL 계정 아이디
$password = 'rootstone1!'; # MySQL 계정 패스워드
$dbname = 'capstone3d';  # DATABASE 이름

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
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