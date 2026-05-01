<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\Exception\LoanConflictException;
use OCA\LoanLedger\Exception\LoanNotFoundException;
use OCP\Files\File;

/**
 * Persists loan YAML back through `IRootFolder`. Optimistic concurrency
 * control is opt-in: pass `$expectedMtime` (typically forwarded from the
 * client's `If-Match` header) to refuse the write if the on-disk mtime
 * has moved since the client last read. This is the entire defense
 * against two collaborators silently clobbering each other on a shared
 * loan file.
 */
class FileWriter {
	public function __construct(
		private readonly FileScanner $scanner,
	) {
	}

	public function writeLoan(
		string $userId,
		int $fileId,
		string $yaml,
		?int $expectedMtime = null,
	): int {
		$node = $this->scanner->findLoan($userId, $fileId);
		if ($node === null) {
			throw new LoanNotFoundException("Loan #{$fileId} not found in ledgers folder");
		}
		if ($expectedMtime !== null && $node->getMTime() !== $expectedMtime) {
			throw new LoanConflictException(
				"Loan #{$fileId} was modified externally "
				. "(expected mtime {$expectedMtime}, on-disk mtime {$node->getMTime()})",
			);
		}
		$node->putContent($yaml);
		return $node->getMTime();
	}

	/**
	 * Create a new loan file in the user's ledgers folder. The filename is
	 * derived from a slug of `$name` plus the `.loan.yaml` suffix; if a file
	 * with that name already exists, a numeric suffix is appended.
	 *
	 * @return array{fileid: int, path: string, mtime: int, permissions: int}
	 */
	public function createLoan(string $userId, string $name, string $yaml): array {
		$folder = $this->scanner->getPrimaryFolder($userId);
		$baseSlug = $this->slug($name);
		if ($baseSlug === '') {
			$baseSlug = 'loan';
		}

		$candidate = $baseSlug . '.loan.yaml';
		$counter = 2;
		while ($folder->nodeExists($candidate)) {
			$candidate = $baseSlug . '-' . $counter . '.loan.yaml';
			$counter += 1;
		}

		$file = $folder->newFile($candidate, $yaml);
		if (!$file instanceof File) {
			throw new \RuntimeException('Failed to create loan file');
		}

		return [
			'fileid' => $file->getId(),
			'path' => $file->getPath(),
			'mtime' => $file->getMTime(),
			'permissions' => $file->getPermissions(),
		];
	}

	private function slug(string $name): string {
		$lower = strtolower($name);
		$ascii = preg_replace('/[^a-z0-9]+/', '-', $lower) ?? '';
		return trim($ascii, '-');
	}
}
