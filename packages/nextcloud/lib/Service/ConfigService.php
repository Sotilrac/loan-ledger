<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\AppInfo\Application;
use OCP\Config\IUserConfig;

/**
 * Per-user configuration. The user keeps `.loan.yaml` files in one or
 * more configured folders inside their Nextcloud. The first folder is
 * the "primary" — it's where new loans land by default and where the
 * shared `.mappings.yaml` lives. Defaults to `[/Ledgers]` on first use.
 *
 * For backwards compatibility we still read the legacy single `folder`
 * value and migrate it to the array on first read.
 */
class ConfigService {
	public function __construct(
		private readonly IUserConfig $config,
	) {
	}

	/**
	 * @return list<string>
	 */
	public function getLedgersFolders(string $userId): array {
		$folders = $this->config->getValueArray(
			$userId,
			Application::APP_ID,
			'folders',
			[],
		);
		if (count($folders) === 0) {
			$legacy = $this->config->getValueString(
				$userId,
				Application::APP_ID,
				'folder',
				'',
			);
			$folders = $legacy !== '' ? [$legacy] : [Application::DEFAULT_FOLDER];
		}
		return $this->cleanFolderList($folders);
	}

	/**
	 * The "primary" folder — the head of the list. Used as the destination
	 * for new loans and the location of the shared `.mappings.yaml`.
	 */
	public function getPrimaryFolder(string $userId): string {
		$folders = $this->getLedgersFolders($userId);
		return $folders[0] ?? Application::DEFAULT_FOLDER;
	}

	/**
	 * @param list<string> $folders
	 */
	public function setLedgersFolders(string $userId, array $folders): void {
		$normalized = $this->cleanFolderList($folders);
		if (count($normalized) === 0) {
			$normalized = [Application::DEFAULT_FOLDER];
		}
		$this->config->setValueArray(
			$userId,
			Application::APP_ID,
			'folders',
			$normalized,
		);
	}

	/**
	 * @param list<string> $folders
	 * @return list<string>
	 */
	private function cleanFolderList(array $folders): array {
		$out = [];
		$seen = [];
		foreach ($folders as $folder) {
			if (!is_string($folder)) {
				continue;
			}
			$normalized = $this->normalize($folder);
			if (isset($seen[$normalized])) {
				continue;
			}
			$seen[$normalized] = true;
			$out[] = $normalized;
		}
		return $out;
	}

	private function normalize(string $path): string {
		$trimmed = '/' . trim($path, " \t/");
		return $trimmed === '/' ? Application::DEFAULT_FOLDER : $trimmed;
	}
}
