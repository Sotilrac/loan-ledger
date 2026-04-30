<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Exception;

use RuntimeException;

/**
 * Raised when a write rejects because the on-disk mtime no longer matches
 * the `If-Match` header — i.e. another collaborator (or another tab) edited
 * the same shared loan file between read and write.
 */
class LoanConflictException extends RuntimeException {
}
