<?php

declare(strict_types=1);

// Minimal stubs for private `OC\` symbols that public OCP interfaces
// reference but `nextcloud/ocp` doesn't ship. Out-of-tree apps need these
// at PHPUnit runtime so reflection-based mock generation can resolve type
// hints. Real implementations live in `nextcloud/server` and are loaded
// when the app runs inside Nextcloud.

namespace OC\Hooks {
	if (!\interface_exists(Emitter::class)) {
		interface Emitter {
		}
	}
}

namespace OC\User {
	if (!\class_exists(NoUserException::class)) {
		class NoUserException extends \Exception {
		}
	}
}
