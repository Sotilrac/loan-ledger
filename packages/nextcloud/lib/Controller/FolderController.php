<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Controller;

use OCA\LoanLedger\Service\FolderService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\Files\NotPermittedException;
use OCP\IRequest;
use OCP\IUserSession;

class FolderController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private readonly IUserSession $userSession,
		private readonly FolderService $folders,
	) {
		parent::__construct($appName, $request);
	}

	#[ApiRoute(verb: 'POST', url: '/api/v1/folders')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function create(): DataResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			throw new \RuntimeException('No active user');
		}
		$path = $this->request->getParam('path');
		if (!is_string($path) || trim($path) === '') {
			return new DataResponse(
				['error' => 'invalid_body', 'message' => 'Expected non-empty string path'],
				Http::STATUS_BAD_REQUEST,
			);
		}

		try {
			$created = $this->folders->create($user->getUID(), $path);
		} catch (NotPermittedException $e) {
			return new DataResponse(
				['error' => 'forbidden', 'message' => $e->getMessage()],
				Http::STATUS_FORBIDDEN,
			);
		} catch (\RuntimeException $e) {
			return new DataResponse(
				['error' => 'conflict', 'message' => $e->getMessage()],
				Http::STATUS_CONFLICT,
			);
		}
		return new DataResponse($created, Http::STATUS_CREATED);
	}
}
