<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Controller;

use OCA\LoanLedger\Exception\LedgersFolderMissingException;
use OCA\LoanLedger\Exception\LoanConflictException;
use OCA\LoanLedger\Exception\LoanNotFoundException;
use OCA\LoanLedger\Service\FileScanner;
use OCA\LoanLedger\Service\FileWriter;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\Files\NotPermittedException;
use OCP\IRequest;
use OCP\IUserSession;

class LoanController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private readonly IUserSession $userSession,
		private readonly FileScanner $scanner,
		private readonly FileWriter $writer,
	) {
		parent::__construct($appName, $request);
	}

	#[ApiRoute(verb: 'POST', url: '/api/v1/loans')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function create(): DataResponse {
		$userId = $this->getUserId();
		$name = $this->request->getParam('name');
		$body = $this->request->getParam('content_yaml');
		$folder = $this->request->getParam('folder');
		if (!is_string($name) || trim($name) === '') {
			return new DataResponse(
				['error' => 'invalid_body', 'message' => 'Expected non-empty string name'],
				Http::STATUS_BAD_REQUEST,
			);
		}
		if (!is_string($body) || trim($body) === '') {
			return new DataResponse(
				['error' => 'invalid_body', 'message' => 'Expected non-empty string content_yaml'],
				Http::STATUS_BAD_REQUEST,
			);
		}
		$folderPath = is_string($folder) && trim($folder) !== '' ? trim($folder) : null;

		try {
			$created = $this->writer->createLoan($userId, $name, $body, $folderPath);
		} catch (LedgersFolderMissingException $e) {
			return new DataResponse(
				['error' => 'folder_missing', 'message' => $e->getMessage()],
				Http::STATUS_NOT_FOUND,
			);
		} catch (NotPermittedException $e) {
			return new DataResponse(
				['error' => 'forbidden', 'message' => $e->getMessage()],
				Http::STATUS_FORBIDDEN,
			);
		}
		return new DataResponse($created, Http::STATUS_CREATED);
	}

	#[ApiRoute(verb: 'GET', url: '/api/v1/loans')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): DataResponse {
		$userId = $this->getUserId();
		try {
			$loans = $this->scanner->listLoans($userId);
			$missing = $this->scanner->getMissingFolders($userId);
		} catch (LedgersFolderMissingException $e) {
			return new DataResponse(
				['error' => 'folder_missing', 'message' => $e->getMessage()],
				Http::STATUS_NOT_FOUND,
			);
		}
		return new DataResponse(['loans' => $loans, 'missing_folders' => $missing]);
	}

	#[ApiRoute(verb: 'GET', url: '/api/v1/loans/{fileId}/raw', requirements: ['fileId' => '\d+'])]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function show(int $fileId): DataResponse {
		$userId = $this->getUserId();
		try {
			$node = $this->scanner->findLoan($userId, $fileId);
		} catch (LedgersFolderMissingException $e) {
			return new DataResponse(
				['error' => 'folder_missing', 'message' => $e->getMessage()],
				Http::STATUS_NOT_FOUND,
			);
		}
		if ($node === null) {
			return new DataResponse(['error' => 'not_found'], Http::STATUS_NOT_FOUND);
		}
		return new DataResponse([
			'fileid' => $node->getId(),
			'path' => $node->getPath(),
			'content_yaml' => $node->getContent(),
			'mtime' => $node->getMTime(),
			'permissions' => $node->getPermissions(),
		]);
	}

	#[ApiRoute(verb: 'PUT', url: '/api/v1/loans/{fileId}/raw', requirements: ['fileId' => '\d+'])]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function update(int $fileId): DataResponse {
		$userId = $this->getUserId();
		$body = $this->request->getParam('content_yaml');
		if (!is_string($body)) {
			return new DataResponse(
				['error' => 'invalid_body', 'message' => 'Expected string content_yaml'],
				Http::STATUS_BAD_REQUEST,
			);
		}

		$expectedMtime = $this->parseIfMatchHeader();

		try {
			$newMtime = $this->writer->writeLoan($userId, $fileId, $body, $expectedMtime);
		} catch (LedgersFolderMissingException $e) {
			return new DataResponse(
				['error' => 'folder_missing', 'message' => $e->getMessage()],
				Http::STATUS_NOT_FOUND,
			);
		} catch (LoanNotFoundException) {
			return new DataResponse(['error' => 'not_found'], Http::STATUS_NOT_FOUND);
		} catch (LoanConflictException $e) {
			return new DataResponse(
				['error' => 'conflict', 'message' => $e->getMessage()],
				Http::STATUS_PRECONDITION_FAILED,
			);
		} catch (NotPermittedException $e) {
			return new DataResponse(
				['error' => 'forbidden', 'message' => $e->getMessage()],
				Http::STATUS_FORBIDDEN,
			);
		}

		return new DataResponse(['fileid' => $fileId, 'mtime' => $newMtime]);
	}

	private function parseIfMatchHeader(): ?int {
		$raw = $this->request->getHeader('If-Match');
		if ($raw === '') {
			return null;
		}
		// Strip ETag-style quoting if a client decided to add it.
		$trimmed = trim($raw, '"');
		if ($trimmed === '' || !ctype_digit($trimmed)) {
			return null;
		}
		return (int)$trimmed;
	}

	private function getUserId(): string {
		$user = $this->userSession->getUser();
		if ($user === null) {
			// `#[NoAdminRequired]` still requires a logged-in user; this
			// branch only fires if NC routes a non-authenticated request
			// here, which it won't in normal operation.
			throw new \RuntimeException('No active user');
		}
		return $user->getUID();
	}
}
