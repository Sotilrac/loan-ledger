<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Controller;

use OCA\LoanLedger\Exception\LedgersFolderMissingException;
use OCA\LoanLedger\Service\MappingsRepository;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\Files\NotPermittedException;
use OCP\IRequest;
use OCP\IUserSession;

class MappingController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private readonly IUserSession $userSession,
		private readonly MappingsRepository $repo,
	) {
		parent::__construct($appName, $request);
	}

	#[ApiRoute(verb: 'GET', url: '/api/v1/mappings/raw')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function show(): DataResponse {
		$userId = $this->getUserId();
		try {
			$yaml = $this->repo->read($userId);
		} catch (LedgersFolderMissingException $e) {
			return new DataResponse(
				['error' => 'folder_missing', 'message' => $e->getMessage()],
				Http::STATUS_NOT_FOUND,
			);
		}
		return new DataResponse(['content_yaml' => $yaml]);
	}

	#[ApiRoute(verb: 'PUT', url: '/api/v1/mappings/raw')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function update(): DataResponse {
		$userId = $this->getUserId();
		$body = $this->request->getParam('content_yaml');
		if (!is_string($body)) {
			return new DataResponse(
				['error' => 'invalid_body', 'message' => 'Expected string content_yaml'],
				Http::STATUS_BAD_REQUEST,
			);
		}

		try {
			$this->repo->write($userId, $body);
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
		return new DataResponse(['ok' => true]);
	}

	private function getUserId(): string {
		$user = $this->userSession->getUser();
		if ($user === null) {
			throw new \RuntimeException('No active user');
		}
		return $user->getUID();
	}
}
