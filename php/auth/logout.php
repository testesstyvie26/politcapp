<?php
/** POST — encerra a sessão atual. */
require_once __DIR__ . '/../lib/auth.php';
pa_logout();
pa_json(['ok' => true]);
