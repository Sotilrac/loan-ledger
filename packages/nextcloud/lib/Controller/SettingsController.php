<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Controller;

use OCA\LoanLedger\Service\ConfigService;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\ApiRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\OCSController;
use OCP\IRequest;
use OCP\IUserSession;

class SettingsController extends OCSController {
	public function __construct(
		string $appName,
		IRequest $request,
		private readonly IUserSession $userSession,
		private readonly ConfigService $config,
	) {
		parent::__construct($appName, $request);
	}

	#[ApiRoute(verb: 'GET', url: '/api/v1/settings')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function show(): DataResponse {
		$userId = $this->getUserId();
		return new DataResponse([
			'folders' => $this->config->getLedgersFolders($userId),
		]);
	}

	#[ApiRoute(verb: 'PUT', url: '/api/v1/settings')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function update(): DataResponse {
		$userId = $this->getUserId();
		$folders = $this->request->getParam('folders');
		if (!is_array($folders)) {
			return new DataResponse(
				['error' => 'invalid_body', 'message' => 'Expected array of folder paths'],
				Http::STATUS_BAD_REQUEST,
			);
		}
		$this->config->setLedgersFolders($userId, array_values($folders));
		return new DataResponse([
			'folders' => $this->config->getLedgersFolders($userId),
		]);
	}

	private function getUserId(): string {
		$user = $this->userSession->getUser();
		if ($user === null) {
			throw new \RuntimeException('No active user');
		}
		return $user->getUID();
	}
}
