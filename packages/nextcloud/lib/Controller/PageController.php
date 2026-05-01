<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Controller;

use OCA\LoanLedger\AppInfo\Application;
use OCA\LoanLedger\Service\ConfigService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\AppFramework\Services\IInitialState;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Util;

class PageController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private readonly IInitialState $initialState,
		private readonly IUserSession $userSession,
		private readonly ConfigService $config,
	) {
		parent::__construct($appName, $request);
	}

	#[FrontpageRoute(verb: 'GET', url: '/')]
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		$user = $this->userSession->getUser();
		$userId = $user?->getUID() ?? '';

		$this->initialState->provideInitialState(
			'folder',
			$this->config->getLedgersFolder($userId),
		);

		Util::addScript(Application::APP_ID, 'loanledger-main');
		Util::addStyle(Application::APP_ID, 'loanledger-main');

		$response = new TemplateResponse(Application::APP_ID, 'index');

		// ajv (the JSON-schema validator in `@loan-ledger/core`) compiles
		// validators from our static schemas at runtime via `new Function()`.
		// Nextcloud's default CSP forbids `unsafe-eval`; we relax it here
		// for this single page. Safe because the schemas are bundled at
		// build time — no user input ever reaches the validator factory.
		$csp = new ContentSecurityPolicy();
		$csp->allowEvalScript(true);
		$response->setContentSecurityPolicy($csp);

		return $response;
	}
}
