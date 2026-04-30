<?php

declare(strict_types=1);

namespace OCA\LoanLedger\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

class Application extends App implements IBootstrap {
	public const APP_ID = 'loanledger';
	public const DEFAULT_FOLDER = '/Ledgers';
	public const MAPPINGS_FILE = '.mappings.yaml';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		// Services are auto-wired by the AppFramework via constructor type
		// hints. Only register entries that need explicit factories or
		// alias bindings — none yet.
	}

	public function boot(IBootContext $context): void {
	}
}
