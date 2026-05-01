<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;

/**
 * Creates folders inside a user's Nextcloud. Used to materialize a
 * configured ledgers path that doesn't exist yet — the app never auto-
 * creates folders silently; the user has to opt in.
 */
class FolderService {
	public function __construct(
		private readonly IRootFolder $rootFolder,
	) {
	}

	/**
	 * Create the folder at `$path` (relative to the user's root). No-op
	 * if the path already exists as a folder. Throws if the path exists
	 * but isn't a folder, or if creation fails.
	 *
	 * @return array{path: string, fileid: int}
	 *
	 * @throws NotPermittedException
	 */
	public function create(string $userId, string $path): array {
		$normalized = $this->normalize($path);
		$userFolder = $this->rootFolder->getUserFolder($userId);

		try {
			$existing = $userFolder->get($normalized);
		} catch (NotFoundException) {
			$existing = null;
		}
		if ($existing !== null) {
			if (!$existing instanceof Folder) {
				throw new \RuntimeException(
					"A non-folder node already exists at {$normalized}",
				);
			}
			return [
				'path' => $existing->getPath(),
				'fileid' => $existing->getId(),
			];
		}

		$folder = $userFolder->newFolder($normalized);
		return [
			'path' => $folder->getPath(),
			'fileid' => $folder->getId(),
		];
	}

	private function normalize(string $path): string {
		$trimmed = '/' . trim($path, " \t/");
		return $trimmed === '/' ? '/' : $trimmed;
	}
}
