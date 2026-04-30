<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Tests\Unit\Service;

use OCA\LoanLedger\AppInfo\Application;
use OCA\LoanLedger\Service\ConfigService;
use OCP\Config\IUserConfig;
use PHPUnit\Framework\TestCase;

class ConfigServiceTest extends TestCase {
	private IUserConfig $userConfig;
	private ConfigService $service;

	protected function setUp(): void {
		$this->userConfig = $this->createMock(IUserConfig::class);
		$this->service = new ConfigService($this->userConfig);
	}

	public function testReturnsDefaultFolderWhenUserHasNoOverride(): void {
		$this->userConfig
			->method('getValueString')
			->willReturnCallback(static fn (string $u, string $a, string $k, string $d): string => $d);

		self::assertSame(Application::DEFAULT_FOLDER, $this->service->getLedgersFolder('alice'));
	}

	public function testReturnsConfiguredFolderNormalized(): void {
		$this->userConfig
			->method('getValueString')
			->willReturn('Loans/Mortgage');

		self::assertSame('/Loans/Mortgage', $this->service->getLedgersFolder('alice'));
	}

	public function testNormalizesEmptyOrSlashOnlyToDefault(): void {
		$this->userConfig
			->method('getValueString')
			->willReturn('  /  ');

		self::assertSame(Application::DEFAULT_FOLDER, $this->service->getLedgersFolder('alice'));
	}

	public function testWritesNormalizedPath(): void {
		$this->userConfig
			->expects(self::once())
			->method('setValueString')
			->with('alice', Application::APP_ID, 'folder', '/Books');

		$this->service->setLedgersFolder('alice', 'Books/');
	}
}
