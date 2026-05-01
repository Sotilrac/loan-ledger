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

	public function testReturnsDefaultFolderListWhenUserHasNeitherKey(): void {
		$this->userConfig->method('getValueArray')->willReturn([]);
		$this->userConfig->method('getValueString')->willReturn('');

		self::assertSame([Application::DEFAULT_FOLDER], $this->service->getLedgersFolders('alice'));
	}

	public function testMigratesLegacySingleFolderKey(): void {
		$this->userConfig->method('getValueArray')->willReturn([]);
		$this->userConfig->method('getValueString')->willReturn('Loans/Mortgage');

		self::assertSame(['/Loans/Mortgage'], $this->service->getLedgersFolders('alice'));
	}

	public function testReturnsArrayNormalizedAndDeduped(): void {
		$this->userConfig
			->method('getValueArray')
			->willReturn(['Loans/A', '/loans/A', '/Loans/B', '  /  ']);

		self::assertSame(
			['/Loans/A', '/loans/A', '/Loans/B', Application::DEFAULT_FOLDER],
			$this->service->getLedgersFolders('alice'),
		);
	}

	public function testPrimaryFolderIsHeadOfList(): void {
		$this->userConfig
			->method('getValueArray')
			->willReturn(['/Loans/Primary', '/Loans/Secondary']);

		self::assertSame('/Loans/Primary', $this->service->getPrimaryFolder('alice'));
	}

	public function testPrimaryFolderFallsBackToDefaultWhenEmpty(): void {
		$this->userConfig->method('getValueArray')->willReturn([]);
		$this->userConfig->method('getValueString')->willReturn('');

		self::assertSame(Application::DEFAULT_FOLDER, $this->service->getPrimaryFolder('alice'));
	}

	public function testWritesNormalizedAndDedupedArray(): void {
		$this->userConfig
			->expects(self::once())
			->method('setValueArray')
			->with('alice', Application::APP_ID, 'folders', ['/Books', '/Other'])
			->willReturn(true);

		$this->service->setLedgersFolders('alice', ['Books/', '/Books/', 'Other']);
	}

	public function testWritingEmptyArrayFallsBackToDefault(): void {
		$this->userConfig
			->expects(self::once())
			->method('setValueArray')
			->with('alice', Application::APP_ID, 'folders', [Application::DEFAULT_FOLDER])
			->willReturn(true);

		$this->service->setLedgersFolders('alice', []);
	}
}
