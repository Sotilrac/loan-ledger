<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\AppInfo\Application;
use OCP\Config\IUserConfig;

/**
 * Per-user configuration. Today there is exactly one knob: the path to the
 * folder where the user keeps their `.loan.yaml` files. It defaults to
 * `/Ledgers/` and the user can change it from the app's settings page.
 */
class ConfigService {
	public function __construct(
		private readonly IUserConfig $config,
	) {
	}

	public function getLedgersFolder(string $userId): string {
		$path = $this->config->getValueString(
			$userId,
			Application::APP_ID,
			'folder',
			Application::DEFAULT_FOLDER,
		);
		return $this->normalize($path);
	}

	public function setLedgersFolder(string $userId, string $path): void {
		$this->config->setValueString(
			$userId,
			Application::APP_ID,
			'folder',
			$this->normalize($path),
		);
	}

	private function normalize(string $path): string {
		$trimmed = '/' . trim($path, " \t/");
		return $trimmed === '/' ? Application::DEFAULT_FOLDER : $trimmed;
	}
}
