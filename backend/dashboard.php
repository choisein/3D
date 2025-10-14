<?php
session_start();
if (!isset($_SESSION['usernum'])) {
  header("Location: /3D/index.html?need_login=1");
  exit;
}
$usernum = $_SESSION['usernum'];
$id      = $_SESSION['id'];
?>
<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<title>대시보드</title>
<body>
  <h2>로그인 성공 🎉</h2>
  <p>Usernum: <?=htmlspecialchars($usernum)?> / ID: <?=htmlspecialchars($id)?></p>
  <p><a href="/3D/backend/logout.php">로그아웃</a></p>
</body>
</html>
