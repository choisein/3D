<!DOCTYPE html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <title>MySql-PHP 연결 테스트</title>
</head>
<body>
 
<?php
echo "MySql 연결 test<br>";
 
$db = mysqli_connect("localhost", "capstone3d", "rootstone1!", "capstone3d");
 
if($db){
    echo "connect : success<br>";
}
else{
    echo "disconnect : fail<br>";
}
 
$result = mysqli_query($db, 'SELECT VERSION() as VERSION');
$data = mysqli_fetch_assoc($result);
echo $data['VERSION'];
?>
 
</body>
</html>
 
[출처] 안드로이드+MYSQL+PHP 웹서버 연동하기 -1|작성자 흐이준

