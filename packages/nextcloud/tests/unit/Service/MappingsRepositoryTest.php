<?php

declare(strict_types=1);

namespace OCA\LoanLedger\Tests\Unit\Service;

use OCA\LoanLedger\Service\FileScanner;
use OCA\LoanLedger\Service\MappingsRepository;
use OCP\Files\File;
use OCP\Files\Folder;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class MappingsRepositoryTest extends TestCase {
	private FileScanner&MockObject $scanner;
	private MappingsRepository $repo;

	protected function setUp(): void {
		$this->scanner = $this->createMock(FileScanner::class);
		$this->repo = new MappingsRepository($this->scanner);
	}

	public function testReadReturnsEmptyStringWhenMappingsFileDoesNotExist(): void {
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->with('.mappings.yaml')->willReturn(false);
		$this->scanner->method('getPrimaryFolder')->with('alice')->willReturn($folder);

		self::assertSame('', $this->repo->read('alice'));
	}

	public function testReadReturnsFileContent(): void {
		$file = $this->createMock(File::class);
		$file->method('getContent')->willReturn("schema_version: 1\nmappings: []\n");
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->with('.mappings.yaml')->willReturn(true);
		$folder->method('get')->with('.mappings.yaml')->willReturn($file);
		$this->scanner->method('getPrimaryFolder')->willReturn($folder);

		self::assertStringContainsString('schema_version: 1', $this->repo->read('alice'));
	}

	public function testWriteUpdatesExistingFile(): void {
		$file = $this->createMock(File::class);
		$file->expects(self::once())->method('putContent')->with('new');
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->with('.mappings.yaml')->willReturn(true);
		$folder->method('get')->with('.mappings.yaml')->willReturn($file);
		$folder->expects(self::never())->method('newFile');
		$this->scanner->method('getPrimaryFolder')->willReturn($folder);

		$this->repo->write('alice', 'new');
	}

	public function testWriteCreatesFileWhenMissing(): void {
		$folder = $this->createMock(Folder::class);
		$folder->method('nodeExists')->with('.mappings.yaml')->willReturn(false);
		$folder->expects(self::once())->method('newFile')->with('.mappings.yaml', 'new');
		$this->scanner->method('getPrimaryFolder')->willReturn($folder);

		$this->repo->write('alice', 'new');
	}
}
