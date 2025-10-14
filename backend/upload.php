<?php
//mysql 연결
include(__DIR__ . '/connect.php');

//ID 자료 파일 연결
$filename = __DIR__ . '/../사용자계정/web_service_accounts.csv';

//자료 열기 시도
if(($handle = fopen($filename,"r")) !== FALSE){
    //헤더 건너뛰는 명령어
    fgetcsv($handle);

    $successcount = 0;
    $failcount = 0;
    $skipcount = 0;

    while(($data = fgetcsv($handle, 1000, ",")) !==FALSE){
        $id = trim($data[0]);
        $firpassword = trim($data[1]);

        //password 암호화 저장
        $secpaddword = password_hash($firpassword, PASSWORD_DEFAULT);

        //ID 중복여부 확인
        $check = $conn->prepare("select ID from IDsave where ID = ?");
        $check->bind_param("s",$id);
        $check->execute();
        $result = $check->get_result();

        if($result->num_rows > 0){
            echo "계정이 이미 존재 - {$id} -> 건너뛰기<br>";
            $skipcount++;
            continue;
        }

        //DB에 넣기
        $stmt = $conn->prepare("insert into IDsave (ID,Password) values (?, ?)");
        $stmt->bind_param("ss",$id, $secpaddword);

        if($stmt->execute()){
            echo "계정 등록 성공: {$id}<br>";
            $successcount++;
        }
        else{
            echo "계정 등록 실패: ({$id}) : ". $stmt->error . "<br>";
            $failcount++;
        }
    }

    //SCV 닫기
    fclose($handle);
    echo "<hr> SCV등록 완료<br>";
    echo "성공 - {$successcount}<br>";
    echo "건너뜀 - {$skipcount}<br>";
    echo "실패 - {$failcount}<br>";
}
else {
    echo "SCV 파일을 열수없음";
}
?>