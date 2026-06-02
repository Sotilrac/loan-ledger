<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Tests\Unit\Service;

use OCA\LoanLedger\AppInfo\Application;
use OCA\LoanLedger\Service\ConfigService;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

class ConfigServiceTest extends TestCase {
	private IConfig $config;
	private ConfigService $service;

	protected function setUp(): void {
		$this->config = $this->createMock(IConfig::class);
		$this->service = new ConfigService($this->config);
	}

	/**
	 * Stub `getUserValue` per stored key. Keys absent from $values
	 * resolve to the supplied default (mirrors IConfig behaviour).
	 *
	 * @param array<string, string> $values
	 */
	private function stubUserValues(array $values): void {
		$this->config
			->method('getUserValue')
			->willReturnCallback(
				static fn (string $userId, string $app, string $key, $default = '')
					=> $values[$key] ?? $default,
			);
	}

	public function testReturnsDefaultFolderListWhenUserHasNeitherKey(): void {
		$this->stubUserValues([]);

		self::assertSame([Application::DEFAULT_FOLDER], $this->service->getLedgersFolders('alice'));
	}

	public function testMigratesLegacySingleFolderKey(): void {
		$this->stubUserValues(['folder' => 'Loans/Mortgage']);

		self::assertSame(['/Loans/Mortgage'], $this->service->getLedgersFolders('alice'));
	}

	public function testReturnsArrayNormalizedAndDeduped(): void {
		$this->stubUserValues([
			'folders' => json_encode(['Loans/A', '/loans/A', '/Loans/B', '  /  ']),
		]);

		self::assertSame(
			['/Loans/A', '/loans/A', '/Loans/B', Application::DEFAULT_FOLDER],
			$this->service->getLedgersFolders('alice'),
		);
	}

	public function testPrimaryFolderIsHeadOfList(): void {
		$this->stubUserValues([
			'folders' => json_encode(['/Loans/Primary', '/Loans/Secondary']),
		]);

		self::assertSame('/Loans/Primary', $this->service->getPrimaryFolder('alice'));
	}

	public function testPrimaryFolderFallsBackToDefaultWhenEmpty(): void {
		$this->stubUserValues([]);

		self::assertSame(Application::DEFAULT_FOLDER, $this->service->getPrimaryFolder('alice'));
	}

	public function testWritesNormalizedAndDedupedArray(): void {
		$this->config
			->expects(self::once())
			->method('setUserValue')
			->with('alice', Application::APP_ID, 'folders', json_encode(['/Books', '/Other']));

		$this->service->setLedgersFolders('alice', ['Books/', '/Books/', 'Other']);
	}

	public function testWritingEmptyArrayFallsBackToDefault(): void {
		$this->config
			->expects(self::once())
			->method('setUserValue')
			->with('alice', Application::APP_ID, 'folders', json_encode([Application::DEFAULT_FOLDER]));

		$this->service->setLedgersFolders('alice', []);
	}
}
