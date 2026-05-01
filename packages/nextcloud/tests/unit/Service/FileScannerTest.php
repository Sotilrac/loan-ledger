<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Tests\Unit\Service;

use OCA\LoanLedger\Exception\LedgersFolderMissingException;
use OCA\LoanLedger\Service\ConfigService;
use OCA\LoanLedger\Service\FileScanner;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\Node;
use OCP\Files\NotFoundException;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class FileScannerTest extends TestCase {
	private IRootFolder&MockObject $rootFolder;
	private ConfigService&MockObject $config;
	private FileScanner $scanner;

	protected function setUp(): void {
		$this->rootFolder = $this->createMock(IRootFolder::class);
		$this->config = $this->createMock(ConfigService::class);
		$this->scanner = new FileScanner($this->rootFolder, $this->config);

		$this->config
			->method('getLedgersFolders')
			->with('alice')
			->willReturn(['/Ledgers']);
		$this->config
			->method('getPrimaryFolder')
			->with('alice')
			->willReturn('/Ledgers');
	}

	public function testListLoansReturnsEveryLoanFileInOrder(): void {
		$ledgers = $this->mockFolder([
			$this->mockLoanFile(101, '/alice/files/Ledgers/home.loan.yaml', 'yaml-home', 1234),
			$this->mockLoanFile(102, '/alice/files/Ledgers/cabin.loan.yaml', 'yaml-cabin', 1235),
			$this->mockNonLoanFile('README.md'),
		]);
		$this->wireUserFolder($ledgers);

		$result = $this->scanner->listLoans('alice');

		self::assertCount(2, $result);
		self::assertSame('/alice/files/Ledgers/cabin.loan.yaml', $result[0]['path']);
		self::assertSame('/alice/files/Ledgers/home.loan.yaml', $result[1]['path']);
		self::assertSame('yaml-cabin', $result[0]['content_yaml']);
	}

	public function testListLoansRecursesIntoSubfolders(): void {
		$nested = $this->mockFolder([
			$this->mockLoanFile(201, '/alice/files/Ledgers/Shared/inherited.loan.yaml', 'yaml-x', 100),
		]);
		$ledgers = $this->mockFolder([
			$this->mockLoanFile(101, '/alice/files/Ledgers/home.loan.yaml', 'yaml-home', 200),
			$nested,
		]);
		$this->wireUserFolder($ledgers);

		$result = $this->scanner->listLoans('alice');

		self::assertCount(2, $result);
		$ids = array_map(static fn (array $r): int => $r['fileid'], $result);
		self::assertContains(101, $ids);
		self::assertContains(201, $ids);
	}

	public function testListLoansSkipsMissingFoldersInsteadOfThrowing(): void {
		$userFolder = $this->createMock(Folder::class);
		$userFolder
			->method('get')
			->with('/Ledgers')
			->willThrowException(new NotFoundException());
		$this->rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);

		self::assertSame([], $this->scanner->listLoans('alice'));
	}

	public function testGetPrimaryFolderThrowsWhenMissing(): void {
		$userFolder = $this->createMock(Folder::class);
		$userFolder
			->method('get')
			->with('/Ledgers')
			->willThrowException(new NotFoundException());
		$this->rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);

		$this->expectException(LedgersFolderMissingException::class);
		$this->scanner->getPrimaryFolder('alice');
	}

	public function testFindLoanReturnsNodeWhenIdMatchesAndIsLoanFile(): void {
		$loan = $this->mockLoanFile(101, '/alice/files/Ledgers/home.loan.yaml', 'yaml', 9);
		$ledgers = $this->mockFolder([]);
		$ledgers->method('getById')->with(101)->willReturn([$loan]);
		$this->wireUserFolder($ledgers);

		$found = $this->scanner->findLoan('alice', 101);

		self::assertSame($loan, $found);
	}

	public function testFindLoanReturnsNullWhenIdDoesNotPointToLoanFile(): void {
		$other = $this->mockNonLoanFile('README.md');
		$ledgers = $this->mockFolder([]);
		$ledgers->method('getById')->with(202)->willReturn([$other]);
		$this->wireUserFolder($ledgers);

		self::assertNull($this->scanner->findLoan('alice', 202));
	}

	public function testFindLoanReturnsNullWhenIdNotInScope(): void {
		$ledgers = $this->mockFolder([]);
		$ledgers->method('getById')->with(404)->willReturn([]);
		$this->wireUserFolder($ledgers);

		self::assertNull($this->scanner->findLoan('alice', 404));
	}

	private function wireUserFolder(Folder $ledgers): void {
		$userFolder = $this->createMock(Folder::class);
		$userFolder->method('get')->with('/Ledgers')->willReturn($ledgers);
		$this->rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
	}

	/** @param list<Node> $children */
	private function mockFolder(array $children): Folder&MockObject {
		$folder = $this->createMock(Folder::class);
		$folder->method('getDirectoryListing')->willReturn($children);
		return $folder;
	}

	private function mockLoanFile(int $id, string $path, string $content, int $mtime): File&MockObject {
		$file = $this->createMock(File::class);
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturn(basename($path));
		$file->method('getPath')->willReturn($path);
		$file->method('getContent')->willReturn($content);
		$file->method('getMTime')->willReturn($mtime);
		$file->method('getPermissions')->willReturn(31);
		return $file;
	}

	private function mockNonLoanFile(string $name): File&MockObject {
		$file = $this->createMock(File::class);
		$file->method('getName')->willReturn($name);
		return $file;
	}
}
