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
 * Walks the user's configured ledgers folders and returns metadata + raw
 * content for every `*.loan.yaml` file. Multiple folders are supported;
 * folders that don't exist are silently skipped during listing so a
 * partially-configured user still sees what's available.
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
		$userFolder = $this->rootFolder->getUserFolder($userId);
		$out = [];
		foreach ($this->config->getLedgersFolders($userId) as $path) {
			$folder = $this->resolveFolder($userFolder, $path);
			if ($folder === null) {
				continue;
			}
			foreach ($this->collect($folder) as $entry) {
				$out[] = $entry;
			}
		}
		usort($out, static fn (array $a, array $b): int => strcmp($a['path'], $b['path']));
		return $out;
	}

	/**
	 * Resolve a Nextcloud `fileid` to the matching loan file inside any
	 * of the user's ledgers folders, or `null` if no such loan exists in
	 * scope.
	 */
	public function findLoan(string $userId, int $fileId): ?File {
		$userFolder = $this->rootFolder->getUserFolder($userId);
		foreach ($this->config->getLedgersFolders($userId) as $path) {
			$folder = $this->resolveFolder($userFolder, $path);
			if ($folder === null) {
				continue;
			}
			foreach ($folder->getById($fileId) as $node) {
				if ($node instanceof File && $this->isLoanFile($node)) {
					return $node;
				}
			}
		}
		return null;
	}

	/**
	 * The user's primary ledgers folder, resolved against their root.
	 * Used by `MappingsRepository` (mappings live here) and `FileWriter`
	 * (new loans land here when no other folder is specified).
	 *
	 * @throws LedgersFolderMissingException
	 */
	public function getPrimaryFolder(string $userId): Folder {
		$userFolder = $this->rootFolder->getUserFolder($userId);
		$path = $this->config->getPrimaryFolder($userId);
		$folder = $this->resolveFolder($userFolder, $path);
		if ($folder === null) {
			throw new LedgersFolderMissingException(
				"Primary ledgers folder {$path} does not exist for user {$userId}",
			);
		}
		return $folder;
	}

	/**
	 * Resolve a single ledgers folder by path. Used by services that need
	 * to write to a *specific* folder (not just the primary).
	 *
	 * @throws LedgersFolderMissingException
	 */
	public function getFolder(string $userId, string $path): Folder {
		$userFolder = $this->rootFolder->getUserFolder($userId);
		$folder = $this->resolveFolder($userFolder, $path);
		if ($folder === null) {
			throw new LedgersFolderMissingException(
				"Ledgers folder {$path} does not exist for user {$userId}",
			);
		}
		return $folder;
	}

	/**
	 * @deprecated Kept for compatibility with existing tests that mock
	 * a single folder. Prefer `getPrimaryFolder()` or `getFolder()`.
	 */
	public function getLedgersFolder(string $userId): Folder {
		return $this->getPrimaryFolder($userId);
	}

	private function resolveFolder(Folder $userFolder, string $path): ?Folder {
		try {
			$node = $userFolder->get($path);
		} catch (NotFoundException) {
			return null;
		}
		return $node instanceof Folder ? $node : null;
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
		return $out;
	}

	private function isLoanFile(Node $node): bool {
		return str_ends_with($node->getName(), '.loan.yaml');
	}
}
