<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\AppInfo\Application;
use OCP\IConfig;

/**
 * Per-user configuration. The user keeps `.loan.yaml` files in one or
 * more configured folders inside their Nextcloud. The first folder is
 * the "primary" — it's where new loans land by default and where the
 * shared `.mappings.yaml` lives. Defaults to `[/Ledgers]` on first use.
 *
 * The folder list is stored as a JSON string under the `folders` key
 * (`IConfig` only handles scalar values, so we encode the array). For
 * backwards compatibility we still read the legacy single `folder`
 * value and migrate it to the array on first read.
 *
 * Uses `OCP\IConfig` (not the typed `OCP\Config\IUserConfig`, which is
 * only available since Nextcloud 32) so the app runs on Nextcloud 31.
 */
class ConfigService {
	public function __construct(
		private readonly IConfig $config,
	) {
	}

	/**
	 * @return list<string>
	 */
	public function getLedgersFolders(string $userId): array {
		$raw = $this->config->getUserValue(
			$userId,
			Application::APP_ID,
			'folders',
			'',
		);
		$folders = $raw !== '' ? json_decode($raw, true) : null;
		if (!is_array($folders) || count($folders) === 0) {
			$legacy = $this->config->getUserValue(
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
		$this->config->setUserValue(
			$userId,
			Application::APP_ID,
			'folders',
			json_encode($normalized, JSON_THROW_ON_ERROR),
		);
	}

	/**
	 * @param array<array-key, mixed> $folders
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
