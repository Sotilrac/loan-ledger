<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Exception;

use RuntimeException;

/**
 * Raised when the user's configured Ledgers folder does not exist. The app
 * never auto-creates it; the user must set it up explicitly (in the Files
 * app or by changing the configured path).
 */
class LedgersFolderMissingException extends RuntimeException {
}
