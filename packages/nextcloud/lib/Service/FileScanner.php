<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\Exception\LedgersFolderMissingException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;

/**
 * Walks the configured Ledgers folder for the given user and returns
 * metadata + raw content for every `*.loan.yaml` file it can find.
 *
 * Recursion is intentional: a loan that lives in `/Ledgers/Shared with me/`
 * (because someone shared a single file into a sub-folder there) still
 * shows up. All file operations go through `IRootFolder::getUserFolder`,
 * which means share permissions are enforced for free — the storage
 * wrapper stack returns nodes carrying the effective permission mask.
 */
class FileScanner {
	public function __construct(
		private readonly IRootFolder $rootFolder,
		private readonly ConfigService $config,
	) {
	}

	/**
	 * @return list<array{fileid: int, path: string, content_yaml: string, mtime: int, permissions: int}>
	 */
	public function listLoans(string $userId): array {
		$folder = $this->getLedgersFolder($userId);
		return $this->collect($folder);
	}

	/**
	 * Resolve a Nextcloud `fileid` to the matching loan file inside the
	 * user's ledgers folder, or `null` if no such loan exists in scope.
	 */
	public function findLoan(string $userId, int $fileId): ?File {
		$folder = $this->getLedgersFolder($userId);
		$matches = $folder->getById($fileId);
		foreach ($matches as $node) {
			if ($node instanceof File && $this->isLoanFile($node)) {
				return $node;
			}
		}
		return null;
	}

	/**
	 * The user's configured ledgers folder, resolved against their root.
	 *
	 * @throws LedgersFolderMissingException
	 */
	public function getLedgersFolder(string $userId): Folder {
		$userFolder = $this->rootFolder->getUserFolder($userId);
		$path = $this->config->getLedgersFolder($userId);
		try {
			$node = $userFolder->get($path);
		} catch (NotFoundException) {
			throw new LedgersFolderMissingException(
				"Ledgers folder {$path} does not exist for user {$userId}",
			);
		}
		if (!$node instanceof Folder) {
			throw new LedgersFolderMissingException(
				"Ledgers path {$path} is not a folder for user {$userId}",
			);
		}
		return $node;
	}

	/**
	 * @return list<array{fileid: int, path: string, content_yaml: string, mtime: int, permissions: int}>
	 */
	private function collect(Folder $folder): array {
		$out = [];
		foreach ($folder->getDirectoryListing() as $node) {
			if ($node instanceof Folder) {
				foreach ($this->collect($node) as $entry) {
					$out[] = $entry;
				}
				continue;
			}
			if ($node instanceof File && $this->isLoanFile($node)) {
				$out[] = [
					'fileid' => $node->getId(),
					'path' => $node->getPath(),
					'content_yaml' => $node->getContent(),
					'mtime' => $node->getMTime(),
					'permissions' => $node->getPermissions(),
				];
			}
		}
		usort($out, static fn (array $a, array $b): int => strcmp($a['path'], $b['path']));
		return $out;
	}

	private function isLoanFile(Node $node): bool {
		return str_ends_with($node->getName(), '.loan.yaml');
	}
}
