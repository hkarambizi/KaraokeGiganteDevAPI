import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function devRoutes(fastify: FastifyInstance) {
  // Only register these routes in development
  if (env.NODE_ENV !== 'development') {
    return;
  }

  fastify.log.warn('⚠️ Development endpoints active');

  const logPath = join(__dirname, '../../logs/cursor.log');
  const contractsPath = join(__dirname, '../types/api-contracts.ts');
  const docsDir = join(__dirname, '../../docs/shared');
  const backendDocsDir = join(__dirname, '../../');

  // Ensure docs directory exists
  await fs.mkdir(docsDir, { recursive: true });

  // =============================================================================
  // CHANGELOG ENDPOINTS
  // =============================================================================

  // POST /api/dev/changelog - Receive changelog from frontend or backend agents
  fastify.post('/api/dev/changelog', async (request, reply) => {
    const body = request.body as {
      agent: string;
      timestamp: string;
      tasks: string[];
      notes: string[];
      pendingRequirements?: string[];
      questions?: string[];
    };

    const { agent, timestamp, tasks, notes, pendingRequirements = [], questions = [] } = body;

    const logEntry = `
${'='.repeat(80)}
AGENT: ${agent}
TIMESTAMP: ${timestamp}
TASKS COMPLETED:
${tasks.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

NOTES FOR OTHER AGENT:
${notes.map((n) => `  - ${n}`).join('\n')}

${pendingRequirements.length > 0 ? `PENDING REQUIREMENTS:\n${pendingRequirements.map((r) => `  [ ] ${r}`).join('\n')}\n` : ''}
${questions.length > 0 ? `QUESTIONS:\n${questions.map((q) => `  ? ${q}`).join('\n')}\n` : ''}
${'='.repeat(80)}
`;

    try {
      await fs.mkdir(dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, logEntry + '\n');
      fastify.log.info(`Changelog recorded from ${agent} agent`);

      return {
        success: true,
        message: 'Changelog recorded',
      };
    } catch (error: any) {
      fastify.log.error('Failed to write changelog:', error);
      return reply.code(500).send({
        error: 'Failed to write changelog',
        code: 'CHANGELOG_WRITE_ERROR',
      });
    }
  });

  // GET /api/dev/changelog - Read changelog for agent communication
  fastify.get('/api/dev/changelog', async (_request, reply) => {
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const stats = await fs.stat(logPath);

      return {
        exists: true,
        content,
        lastModified: stats.mtime.toISOString(),
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          exists: false,
          content: null,
          lastModified: null,
        };
      }

      fastify.log.error('Failed to read changelog:', error);
      return reply.code(500).send({
        error: 'Failed to read changelog',
        code: 'CHANGELOG_READ_ERROR',
      });
    }
  });

  // =============================================================================
  // API CONTRACT ENDPOINTS
  // =============================================================================

  // GET /api/dev/contracts - Get API contracts with version
  fastify.get('/api/dev/contracts', async (_request, reply) => {
    try {
      const content = await fs.readFile(contractsPath, 'utf-8');
      const stats = await fs.stat(contractsPath);

      const versionMatch = content.match(/Version:\s*(\d+\.\d+\.\d+)/);
      const dateMatch = content.match(/Last Updated:\s*(\d{4}-\d{2}-\d{2})/);

      const version = versionMatch ? versionMatch[1] : '1.0.0';
      const lastUpdated = dateMatch ? dateMatch[1] : stats.mtime.toISOString().split('T')[0];

      fastify.log.info(`API contracts requested - version ${version}`);

      return {
        version,
        lastUpdated,
        content,
        fileModified: stats.mtime.toISOString(),
        instructions: {
          usage: 'Save this content to your frontend: src/types/api-contracts.ts',
          checkVersion: 'Compare version before updating to prevent downgrade',
          breaking: 'Major version changes (e.g., 1.x.x -> 2.x.x) may have breaking changes',
        },
      };
    } catch (error: any) {
      fastify.log.error('Failed to read API contracts:', error);
      return reply.code(500).send({
        error: 'Failed to read API contracts',
        code: 'CONTRACTS_READ_ERROR',
      });
    }
  });

  // POST /api/dev/contracts/verify - Verify frontend version matches
  fastify.post('/api/dev/contracts/verify', async (request, reply) => {
    const body = request.body as {
      frontendVersion: string;
    };

    try {
      const content = await fs.readFile(contractsPath, 'utf-8');
      const versionMatch = content.match(/Version:\s*(\d+\.\d+\.\d+)/);
      const backendVersion = versionMatch ? versionMatch[1] : '1.0.0';

      const parseVersion = (v: string) => {
        const parts = v.split('.').map(Number);
        return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
      };

      const backend = parseVersion(backendVersion);
      const frontend = parseVersion(body.frontendVersion);

      const matches = backendVersion === body.frontendVersion;
      const compatible = backend.major === frontend.major;
      const isNewer = backend.major > frontend.major ||
        (backend.major === frontend.major && backend.minor > frontend.minor) ||
        (backend.major === frontend.major && backend.minor === frontend.minor && backend.patch > frontend.patch);
      const isOlder = !matches && !isNewer;

      let message = '';
      let severity: 'ok' | 'warning' | 'error' = 'ok';

      if (matches) {
        message = '✅ Frontend and backend API contracts are in sync';
        severity = 'ok';
      } else if (!compatible) {
        message = `⚠️ BREAKING CHANGE: Backend is v${backendVersion}, frontend is v${body.frontendVersion}. Major version mismatch!`;
        severity = 'error';
      } else if (isNewer) {
        message = `⚠️ Backend has newer contracts (v${backendVersion}). Frontend is v${body.frontendVersion}. Update recommended.`;
        severity = 'warning';
      } else if (isOlder) {
        message = `⚠️ Frontend has newer contracts (v${body.frontendVersion}). Backend is v${backendVersion}. This shouldn't happen!`;
        severity = 'error';
      }

      fastify.log.info(`Contract verification: ${message}`);

      return {
        matches,
        compatible,
        backendVersion,
        frontendVersion: body.frontendVersion,
        message,
        severity,
        shouldUpdate: !matches && (isNewer || !compatible),
      };
    } catch (error: any) {
      fastify.log.error('Failed to verify contracts:', error);
      return reply.code(500).send({
        error: 'Failed to verify contracts',
        code: 'CONTRACTS_VERIFY_ERROR',
      });
    }
  });

  // =============================================================================
  // DOCUMENTATION SHARING ENDPOINTS
  // =============================================================================

  // GET /api/dev/docs - List all available documentation
  fastify.get('/api/dev/docs', async (_request, reply) => {
    try {
      const backendDocs = [
        'README.md',
        'QUICKSTART.md',
        'API_CONTRACTS.md',
        'TESTING.md',
        'CONTRACTS_SYNC.md',
        'ENV_TEMPLATE.md',
        'IMPLEMENTATION_SUMMARY.md',
        'FINAL_SUMMARY.md',
      ];

      const docs = [];

      // Check backend docs
      for (const filename of backendDocs) {
        try {
          const filePath = join(backendDocsDir, filename);
          const stats = await fs.stat(filePath);
          docs.push({
            filename,
            source: 'backend',
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            path: `/api/dev/docs/${filename}`,
          });
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Check shared docs (from frontend)
      try {
        const sharedFiles = await fs.readdir(docsDir);
        for (const filename of sharedFiles) {
          const filePath = join(docsDir, filename);
          const stats = await fs.stat(filePath);

          if (stats.isFile()) {
            docs.push({
              filename,
              source: 'frontend',
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              path: `/api/dev/docs/${filename}`,
            });
          }
        }
      } catch (error) {
        // Shared directory doesn't exist or is empty
      }

      fastify.log.info(`Documentation list requested - ${docs.length} docs available`);

      return {
        docs,
        count: docs.length,
        instructions: {
          getDoc: 'GET /api/dev/docs/:filename to retrieve a document',
          uploadDoc: 'POST /api/dev/docs/:filename to upload/update a document',
          deleteDoc: 'DELETE /api/dev/docs/:filename to remove a shared document',
        },
      };
    } catch (error: any) {
      fastify.log.error('Failed to list docs:', error);
      return reply.code(500).send({
        error: 'Failed to list documentation',
        code: 'DOCS_LIST_ERROR',
      });
    }
  });

  // GET /api/dev/docs/:filename - Get a specific document
  fastify.get('/api/dev/docs/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Validate filename (prevent directory traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.code(400).send({
        error: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
    }

    try {
      let content: string;
      let source: 'backend' | 'frontend';
      let stats: any;

      // Try backend docs first
      try {
        const backendPath = join(backendDocsDir, filename);
        content = await fs.readFile(backendPath, 'utf-8');
        stats = await fs.stat(backendPath);
        source = 'backend';
      } catch (error) {
        // Try shared docs (from frontend)
        const sharedPath = join(docsDir, filename);
        content = await fs.readFile(sharedPath, 'utf-8');
        stats = await fs.stat(sharedPath);
        source = 'frontend';
      }

      // Encode as base64 for safe transport
      const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

      fastify.log.info(`Document retrieved: ${filename} (source: ${source})`);

      return {
        filename,
        source,
        content,
        contentBase64,
        size: stats.size,
        lastModified: stats.mtime.toISOString(),
        encoding: 'utf-8',
        instructions: {
          decodeBase64: 'Buffer.from(contentBase64, "base64").toString("utf-8")',
          usage: 'Save to your docs folder for reference',
        },
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send({
          error: `Document not found: ${filename}`,
          code: 'DOC_NOT_FOUND',
        });
      }

      fastify.log.error(`Failed to read document ${filename}:`, error);
      return reply.code(500).send({
        error: 'Failed to read document',
        code: 'DOC_READ_ERROR',
      });
    }
  });

  // POST /api/dev/docs/:filename - Upload/update a document (from frontend)
  fastify.post('/api/dev/docs/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const body = request.body as {
      content?: string;
      contentBase64?: string;
      metadata?: {
        description?: string;
        agent?: string;
        version?: string;
      };
    };

    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.code(400).send({
        error: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
    }

    // Only allow markdown and text files
    const ext = extname(filename).toLowerCase();
    if (!['.md', '.txt'].includes(ext)) {
      return reply.code(400).send({
        error: 'Only .md and .txt files are allowed',
        code: 'INVALID_FILE_TYPE',
      });
    }

    try {
      let content: string;

      // Decode from base64 if provided
      if (body.contentBase64) {
        content = Buffer.from(body.contentBase64, 'base64').toString('utf-8');
      } else if (body.content) {
        content = body.content;
      } else {
        return reply.code(400).send({
          error: 'Missing content or contentBase64',
          code: 'MISSING_CONTENT',
        });
      }

      // Save to shared docs directory
      const filePath = join(docsDir, filename);
      await fs.writeFile(filePath, content, 'utf-8');

      // Save metadata if provided
      if (body.metadata) {
        const metadataPath = join(docsDir, `${filename}.meta.json`);
        await fs.writeFile(
          metadataPath,
          JSON.stringify({
            ...body.metadata,
            uploadedAt: new Date().toISOString(),
            filename,
          }, null, 2),
          'utf-8'
        );
      }

      fastify.log.info(`Document uploaded: ${filename} from ${body.metadata?.agent || 'unknown'}`);

      return {
        success: true,
        filename,
        size: content.length,
        message: `Document ${filename} uploaded successfully`,
        retrieveUrl: `/api/dev/docs/${filename}`,
      };
    } catch (error: any) {
      fastify.log.error(`Failed to upload document ${filename}:`, error);
      return reply.code(500).send({
        error: 'Failed to upload document',
        code: 'DOC_UPLOAD_ERROR',
      });
    }
  });

  // DELETE /api/dev/docs/:filename - Delete a shared document
  fastify.delete('/api/dev/docs/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };

    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return reply.code(400).send({
        error: 'Invalid filename',
        code: 'INVALID_FILENAME',
      });
    }

    try {
      const filePath = join(docsDir, filename);
      const metadataPath = join(docsDir, `${filename}.meta.json`);

      // Only allow deleting from shared docs (not backend docs)
      await fs.unlink(filePath);

      // Also delete metadata if exists
      try {
        await fs.unlink(metadataPath);
      } catch (error) {
        // Metadata doesn't exist, that's fine
      }

      fastify.log.info(`Document deleted: ${filename}`);

      return {
        success: true,
        message: `Document ${filename} deleted successfully`,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send({
          error: `Document not found: ${filename}`,
          code: 'DOC_NOT_FOUND',
        });
      }

      fastify.log.error(`Failed to delete document ${filename}:`, error);
      return reply.code(500).send({
        error: 'Failed to delete document',
        code: 'DOC_DELETE_ERROR',
      });
    }
  });

  // =============================================================================
  // ENDPOINT SUMMARY
  // =============================================================================

  fastify.log.info('✅ Development endpoints registered:');
  fastify.log.info('   POST   /api/dev/changelog - Record agent updates');
  fastify.log.info('   GET    /api/dev/changelog - Read agent communication');
  fastify.log.info('   GET    /api/dev/contracts - Get API contracts');
  fastify.log.info('   POST   /api/dev/contracts/verify - Verify contract versions');
  fastify.log.info('   GET    /api/dev/docs - List all documentation');
  fastify.log.info('   GET    /api/dev/docs/:filename - Get specific document');
  fastify.log.info('   POST   /api/dev/docs/:filename - Upload/update document');
  fastify.log.info('   DELETE /api/dev/docs/:filename - Delete shared document');
}
