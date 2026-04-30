<?php

declare(strict_types=1);

// PHPUnit bootstrap. Out-of-tree NC apps use `nextcloud/ocp` (interface
// stubs) rather than booting a real Nextcloud, so all dependencies are
// satisfied via Composer's autoloader. Private `OC\` symbols that public
// interfaces happen to reference are stubbed in `stubs/oc-private.php`.
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/stubs/oc-private.php';
