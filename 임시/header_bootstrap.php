<?php
// 세션 시작
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// 브라우저가 이 파일을 요청할 때 보내는 헤더들을 세션에 저장
if (!empty($_SERVER['HTTP_ACCEPT'])) {
    $_SESSION['browser_accept'] = $_SERVER['HTTP_ACCEPT'];
}

if (!empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) {
    $_SESSION['browser_accept_language'] = $_SERVER['HTTP_ACCEPT_LANGUAGE'];
}

if (!empty($_SERVER['HTTP_USER_AGENT'])) {
    $_SESSION['browser_user_agent'] = $_SERVER['HTTP_USER_AGENT'];
}

// 자바스크립트 파일처럼 응답
header('Content-Type: application/javascript; charset=utf-8');

echo 'console.log("🔐 SecureBank header bootstrap OK");';
