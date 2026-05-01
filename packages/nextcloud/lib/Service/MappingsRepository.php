<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\AppInfo\Application;
use OCP\Files\File;

/**
 * Reads and writes the shared `.mappings.yaml` at the root of the user's
 * configured ledgers folder. The web target keeps mappings in
 * `localStorage`; Nextcloud puts them next to the loan files so they
 * travel with sharing. Empty file (or no file at all) is normalized to
 * an empty YAML string.
 */
class MappingsRepository {
	public function __construct(
		private readonly FileScanner $scanner,
	) {
	}

	public function read(string $userId): string {
		$folder = $this->scanner->getPrimaryFolder($userId);
		if (!$folder->nodeExists(Application::MAPPINGS_FILE)) {
			return '';
		}
		$node = $folder->get(Application::MAPPINGS_FILE);
		return $node instanceof File ? $node->getContent() : '';
	}

	public function write(string $userId, string $yaml): void {
		$folder = $this->scanner->getPrimaryFolder($userId);
		if ($folder->nodeExists(Application::MAPPINGS_FILE)) {
			$node = $folder->get(Application::MAPPINGS_FILE);
			if ($node instanceof File) {
				$node->putContent($yaml);
				return;
			}
		}
		$folder->newFile(Application::MAPPINGS_FILE, $yaml);
	}
}
