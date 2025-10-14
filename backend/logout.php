<?php
session_start();
$_SESSION =[];
session_destroy();
header("Location: /3D/index.html?logout=1");
exit;
