<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Tests\Unit\Service;

use OCA\LoanLedger\Service\FolderService;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class FolderServiceTest extends TestCase {
	private IRootFolder&MockObject $rootFolder;
	private FolderService $service;

	protected function setUp(): void {
		$this->rootFolder = $this->createMock(IRootFolder::class);
		$this->service = new FolderService($this->rootFolder);
	}

	public function testCreatesFolderWhenItDoesNotExist(): void {
		$created = $this->createMock(Folder::class);
		$created->method('getId')->willReturn(101);
		$created->method('getPath')->willReturn('/alice/files/Ledgers');

		$userFolder = $this->createMock(Folder::class);
		$userFolder
			->method('get')
			->with('/Ledgers')
			->willThrowException(new NotFoundException());
		$userFolder
			->expects(self::once())
			->method('newFolder')
			->with('/Ledgers')
			->willReturn($created);
		$this->rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);

		$result = $this->service->create('alice', '/Ledgers');
		self::assertSame(101, $result['fileid']);
		self::assertSame('/alice/files/Ledgers', $result['path']);
	}

	public function testReturnsExistingFolderWithoutRecreating(): void {
		$existing = $this->createMock(Folder::class);
		$existing->method('getId')->willReturn(202);
		$existing->method('getPath')->willReturn('/alice/files/Ledgers');

		$userFolder = $this->createMock(Folder::class);
		$userFolder->method('get')->with('/Ledgers')->willReturn($existing);
		$userFolder->expects(self::never())->method('newFolder');
		$this->rootFolder->method('getUserFolder')->willReturn($userFolder);

		$result = $this->service->create('alice', '/Ledgers');
		self::assertSame(202, $result['fileid']);
	}

	public function testThrowsWhenPathExistsButIsAFile(): void {
		$file = $this->createMock(File::class);
		$userFolder = $this->createMock(Folder::class);
		$userFolder->method('get')->with('/Ledgers')->willReturn($file);
		$this->rootFolder->method('getUserFolder')->willReturn($userFolder);

		$this->expectException(\RuntimeException::class);
		$this->service->create('alice', '/Ledgers');
	}

	public function testNormalizesPath(): void {
		$created = $this->createMock(Folder::class);
		$created->method('getId')->willReturn(1);
		$created->method('getPath')->willReturn('/p');

		$userFolder = $this->createMock(Folder::class);
		$userFolder
			->method('get')
			->with('/Loans/Mortgage')
			->willThrowException(new NotFoundException());
		$userFolder
			->expects(self::once())
			->method('newFolder')
			->with('/Loans/Mortgage')
			->willReturn($created);
		$this->rootFolder->method('getUserFolder')->willReturn($userFolder);

		$this->service->create('alice', '  Loans/Mortgage/  ');
	}
}
