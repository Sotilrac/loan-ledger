<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Service;

use OCA\LoanLedger\Exception\LoanConflictException;
use OCA\LoanLedger\Exception\LoanNotFoundException;

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
}
