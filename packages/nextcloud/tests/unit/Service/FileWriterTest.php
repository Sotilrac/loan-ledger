<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Tests\Unit\Service;

use OCA\LoanLedger\Exception\LoanConflictException;
use OCA\LoanLedger\Exception\LoanNotFoundException;
use OCA\LoanLedger\Service\FileScanner;
use OCA\LoanLedger\Service\FileWriter;
use OCP\Files\File;
use OCP\Files\Folder;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class FileWriterTest extends TestCase {
	private FileScanner&MockObject $scanner;
	private FileWriter $writer;

	protected function setUp(): void {
		$this->scanner = $this->createMock(FileScanner::class);
		$this->writer = new FileWriter($this->scanner);
	}

	public function testWritesContentAndReturnsNewMtime(): void {
		$file = $this->createMock(File::class);
		$file->expects(self::once())->method('putContent')->with('new yaml');
		$file->method('getMTime')->willReturn(2000);

		$this->scanner->method('findLoan')->with('alice', 101)->willReturn($file);

		self::assertSame(2000, $this->writer->writeLoan('alice', 101, 'new yaml'));
	}

	public function testThrowsLoanNotFoundWhenScannerReturnsNull(): void {
		$this->scanner->method('findLoan')->with('alice', 999)->willReturn(null);

		$this->expectException(LoanNotFoundException::class);
		$this->writer->writeLoan('alice', 999, 'yaml');
	}

	public function testWritesWhenIfMatchMtimeAgrees(): void {
		$file = $this->createMock(File::class);
		$file->method('getMTime')->willReturnOnConsecutiveCalls(1500, 1501);
		$file->expects(self::once())->method('putContent')->with('yaml');
		$this->scanner->method('findLoan')->willReturn($file);

		self::assertSame(1501, $this->writer->writeLoan('alice', 101, 'yaml', 1500));
	}

	public function testThrowsConflictWhenIfMatchMtimeDisagrees(): void {
		$file = $this->createMock(File::class);
		$file->method('getMTime')->willReturn(1500);
		$file->expects(self::never())->method('putContent');
		$this->scanner->method('findLoan')->willReturn($file);

		$this->expectException(LoanConflictException::class);
		$this->writer->writeLoan('alice', 101, 'yaml', 1499);
	}

	public function testCreateLoanSlugifiesNameAndAppendsExtension(): void {
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->willReturn(false);
		$file = $this->createMock(File::class);
		$file->method('getId')->willReturn(42);
		$file->method('getPath')->willReturn('/alice/files/Ledgers/my-cabin.loan.yaml');
		$file->method('getMTime')->willReturn(2000);
		$file->method('getPermissions')->willReturn(31);
		$folder->expects(self::once())
			->method('newFile')
			->with('my-cabin.loan.yaml', 'yaml-content')
			->willReturn($file);

		$this->scanner->method('getLedgersFolder')->with('alice')->willReturn($folder);

		$result = $this->writer->createLoan('alice', 'My Cabin', 'yaml-content');
		self::assertSame(42, $result['fileid']);
		self::assertSame('/alice/files/Ledgers/my-cabin.loan.yaml', $result['path']);
	}

	public function testCreateLoanAppendsCounterWhenSlugCollides(): void {
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->willReturnMap([
			['cabin.loan.yaml', true],
			['cabin-2.loan.yaml', true],
			['cabin-3.loan.yaml', false],
		]);
		$file = $this->createMock(File::class);
		$file->method('getId')->willReturn(99);
		$file->method('getPath')->willReturn('/p');
		$file->method('getMTime')->willReturn(0);
		$file->method('getPermissions')->willReturn(31);
		$folder->expects(self::once())
			->method('newFile')
			->with('cabin-3.loan.yaml', 'yaml')
			->willReturn($file);
		$this->scanner->method('getLedgersFolder')->willReturn($folder);

		$this->writer->createLoan('alice', 'Cabin', 'yaml');
	}

	public function testCreateLoanFallsBackToGenericSlugForUnusableName(): void {
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->willReturn(false);
		$file = $this->createMock(File::class);
		$file->method('getId')->willReturn(1);
		$file->method('getPath')->willReturn('/p');
		$file->method('getMTime')->willReturn(0);
		$file->method('getPermissions')->willReturn(31);
		$folder->expects(self::once())
			->method('newFile')
			->with('loan.loan.yaml', 'yaml')
			->willReturn($file);
		$this->scanner->method('getLedgersFolder')->willReturn($folder);

		$this->writer->createLoan('alice', '!!!', 'yaml');
	}
}
