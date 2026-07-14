import 'dart:io';

import 'package:feedin/src/features/messages/chat/generic_file_attachment.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('GenericFileAttachmentValidator', () {
    test('resolves supported extensions case-insensitively', () {
      expect(
        GenericFileAttachmentValidator.mimeTypeForName('Quarterly.PDF'),
        'application/pdf',
      );
      expect(
        GenericFileAttachmentValidator.mimeTypeForName('budget.XLSX'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(
        GenericFileAttachmentValidator.mimeTypeForName('archive.tar.gz'),
        isNull,
      );
    });

    test('rejects empty, oversized, and unsupported files', () {
      expect(
        GenericFileAttachmentValidator.validate(
          const GenericFileCandidate(
            path: '/tmp/empty.pdf',
            name: 'empty.pdf',
            sizeBytes: 0,
          ),
        ),
        'Empty files cannot be shared.',
      );
      expect(
        GenericFileAttachmentValidator.validate(
          const GenericFileCandidate(
            path: '/tmp/large.pdf',
            name: 'large.pdf',
            sizeBytes: GenericFileAttachmentValidator.maxFileSizeBytes + 1,
          ),
        ),
        'Files must be 50 MB or smaller.',
      );
      expect(
        GenericFileAttachmentValidator.validate(
          const GenericFileCandidate(
            path: '/tmp/script.sh',
            name: 'script.sh',
            sizeBytes: 10,
          ),
        ),
        'That file type is not supported.',
      );
    });
  });

  group('GenericFileAttachmentPicker', () {
    late Directory temporaryRoot;

    setUp(() async {
      temporaryRoot = await Directory.systemTemp.createTemp(
        'feedin-generic-file-test-',
      );
    });

    tearDown(() async {
      if (await temporaryRoot.exists()) {
        await temporaryRoot.delete(recursive: true);
      }
    });

    test('returns a cancelled result when no file is selected', () async {
      final picker = GenericFileAttachmentPicker(
        candidatePicker: () async => null,
        cacheDirectoryProvider: () async => temporaryRoot,
      );

      final result = await picker.pickAndStage();

      expect(result.isCancelled, isTrue);
      expect(result.isSuccess, isFalse);
      expect(result.isFailure, isFalse);
    });

    test('copies a validated file into the message cache', () async {
      final source = File('${temporaryRoot.path}/source.PDF');
      await source.writeAsString('report body');
      final cacheRoot = Directory('${temporaryRoot.path}/cache');
      final picker = GenericFileAttachmentPicker(
        candidatePicker: () async => GenericFileCandidate(
          path: source.path,
          name: '  Quarterly Report.PDF  ',
          sizeBytes: await source.length(),
        ),
        cacheDirectoryProvider: () async => cacheRoot,
      );

      final result = await picker.pickAndStage();

      expect(result.isSuccess, isTrue);
      final attachment = result.attachment!;
      expect(attachment.fileName, 'Quarterly Report.PDF');
      expect(attachment.fileSizeBytes, await source.length());
      expect(attachment.mimeType, 'application/pdf');
      expect(attachment.localPath, isNot(source.path));
      expect(attachment.localPath.endsWith('.pdf'), isTrue);
      expect(await File(attachment.localPath).readAsString(), 'report body');
    });

    test('rechecks the actual file size before staging', () async {
      final source = File('${temporaryRoot.path}/empty.pdf');
      await source.create();
      final picker = GenericFileAttachmentPicker(
        candidatePicker: () async => GenericFileCandidate(
          path: source.path,
          name: 'empty.pdf',
          sizeBytes: 12,
        ),
        cacheDirectoryProvider: () async => temporaryRoot,
      );

      final result = await picker.pickAndStage();

      expect(result.isFailure, isTrue);
      expect(result.error, 'Empty files cannot be shared.');
    });

    test('reports a file that disappeared after selection', () async {
      final picker = GenericFileAttachmentPicker(
        candidatePicker: () async => GenericFileCandidate(
          path: '${temporaryRoot.path}/missing.pdf',
          name: 'missing.pdf',
          sizeBytes: 12,
        ),
        cacheDirectoryProvider: () async => temporaryRoot,
      );

      final result = await picker.pickAndStage();

      expect(result.isFailure, isTrue);
      expect(result.error, 'That file is no longer available.');
    });
  });
}
