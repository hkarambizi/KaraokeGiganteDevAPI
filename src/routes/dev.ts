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
  const changelogPath = join(__dirname, '../../docs/CHANGELOG.md');
  const docsDir = join(__dirname, '../../docs/shared');

  // Ensure docs directory exists
  await fs.mkdir(docsDir, { recursive: true });

  // =============================================================================
  // CHANGELOG ENDPOINTS
  // =============================================================================

  // POST /api/dev/changelog - Receive changelog from frontend or backend agents
  fastify.post('/api/dev/changelog', async (request, reply) => {
    const body = request.body as {
      agent: 'frontend' | 'backend';
      timestamp: string;
      tasks?: string[];
      notes?: string[];
      pendingRequirements?: string[];
      questions?: string[];
      title?: string;
      description?: string;
      type?: string; // 'bug' | 'fix' | 'feature' | 'architecture' | etc.
    };

    const {
      agent,
      timestamp,
      tasks = [],
      notes = [],
      pendingRequirements = [],
      questions = [],
      title,
      description,
      type = 'update'
    } = body;

    // Format timestamp for CHANGELOG.md (YYYY-MM-DD HH:MM UTC)
    const date = new Date(timestamp);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = date.toISOString().split('T')[1].split('.')[0]; // HH:MM:SS

    // Legacy format for cursor.log (backward compatibility)
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

    // Format entry for CHANGELOG.md
    let changelogEntry = '';

    if (title && description) {
      // Structured entry for CHANGELOG.md
      const typeEmoji = {
        bug: '🐛',
        fix: '🔧',
        feature: '📦',
        architecture: '🏗️',
        enhancement: '✨',
        update: '📝'
      }[type] || '📝';

      changelogEntry = `\n### ${typeEmoji} ${title} (${agent === 'frontend' ? 'Frontend' : 'Backend'})\n\n`;
      changelogEntry += `**Time:** ${timeStr} UTC  \n`;
      changelogEntry += `**Description:** ${description}\n\n`;

      if (tasks.length > 0) {
        changelogEntry += `**Changes:**\n`;
        tasks.forEach(task => {
          changelogEntry += `- ${task}\n`;
        });
        changelogEntry += `\n`;
      }

      if (notes.length > 0) {
        changelogEntry += `**Notes:**\n`;
        notes.forEach(note => {
          changelogEntry += `- ${note}\n`;
        });
        changelogEntry += `\n`;
      }

      if (pendingRequirements.length > 0) {
        changelogEntry += `**Pending:**\n`;
        pendingRequirements.forEach(req => {
          changelogEntry += `- [ ] ${req}\n`;
        });
        changelogEntry += `\n`;
      }

      changelogEntry += `**Result:** ✅ Completed\n\n---\n`;
    } else {
      // Fallback to simple entry
      changelogEntry = `\n### 📝 Update from ${agent === 'frontend' ? 'Frontend' : 'Backend'} (${dateStr})\n\n`;
      changelogEntry += `**Time:** ${timeStr} UTC  \n\n`;

      if (tasks.length > 0) {
        changelogEntry += `**Tasks:**\n`;
        tasks.forEach(task => {
          changelogEntry += `- ${task}\n`;
        });
        changelogEntry += `\n`;
      }

      if (notes.length > 0) {
        changelogEntry += `**Notes:**\n`;
        notes.forEach(note => {
          changelogEntry += `- ${note}\n`;
        });
        changelogEntry += `\n`;
      }

      changelogEntry += `---\n`;
    }

    try {
      // Ensure directories exist
      await fs.mkdir(dirname(logPath), { recursive: true });
      await fs.mkdir(dirname(changelogPath), { recursive: true });

      // Write to legacy cursor.log (backward compatibility)
      await fs.appendFile(logPath, logEntry + '\n');

      // Read current CHANGELOG.md
      let changelogContent = '';
      try {
        changelogContent = await fs.readFile(changelogPath, 'utf-8');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Create new changelog if it doesn't exist
          changelogContent = `# 📋 Changelog - Karaoke Gigante API\n\n**Last Updated:** ${dateStr}  \n**Format:** Date/Time sorted entries with clear titles and descriptions\n\n---\n\n## ${dateStr}\n`;
        }
      }

      // Insert new entry at the top of the current date section
      if (changelogContent.includes(`## ${dateStr}`)) {
        // Add to existing date section
        const dateSectionIndex = changelogContent.indexOf(`## ${dateStr}`);
        const nextSectionIndex = changelogContent.indexOf('\n## ', dateSectionIndex + 1);

        if (nextSectionIndex === -1) {
          // No next section, append to end
          changelogContent = changelogContent.replace(`## ${dateStr}`, `## ${dateStr}${changelogEntry}`);
        } else {
          // Insert before next section
          changelogContent = changelogContent.slice(0, nextSectionIndex) + changelogEntry + changelogContent.slice(nextSectionIndex);
        }
      } else {
        // Add new date section at the top (after header)
        const headerEnd = changelogContent.indexOf('---\n\n');
        if (headerEnd === -1) {
          changelogContent = changelogContent + `\n## ${dateStr}${changelogEntry}`;
        } else {
          changelogContent = changelogContent.slice(0, headerEnd + 5) + `## ${dateStr}${changelogEntry}` + changelogContent.slice(headerEnd + 5);
        }
      }

      // Update "Last Updated" date
      changelogContent = changelogContent.replace(
        /\*\*Last Updated:\*\* .+?\n/,
        `**Last Updated:** ${dateStr}  \n`
      );

      // Write updated CHANGELOG.md
      await fs.writeFile(changelogPath, changelogContent, 'utf-8');

      fastify.log.info(`Changelog recorded from ${agent} agent (cursor.log + CHANGELOG.md)`);

      return {
        success: true,
        message: 'Changelog recorded',
        location: {
          cursorLog: logPath,
          changelog: changelogPath,
        },
      };
    } catch (error: any) {
      fastify.log.error('Failed to write changelog:', error);
      return reply.code(500).send({
        error: 'Failed to write changelog',
        code: 'CHANGELOG_WRITE_ERROR',
        details: env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // GET /api/dev/changelog - Read changelog for agent communication
  fastify.get('/api/dev/changelog', async (request, reply) => {
    try {
      const { format } = request.query as { format?: 'legacy' | 'central' | 'both' };

      // Default to both for backward compatibility
      const returnFormat = format || 'both';

      if (returnFormat === 'legacy' || returnFormat === 'both') {
        // Read legacy cursor.log
        try {
          const legacyContent = await fs.readFile(logPath, 'utf-8');
          const legacyStats = await fs.stat(logPath);

          if (returnFormat === 'legacy') {
            return {
              exists: true,
              format: 'legacy',
              content: legacyContent,
              lastModified: legacyStats.mtime.toISOString(),
            };
          }

          // Also read central changelog
          try {
            const centralContent = await fs.readFile(changelogPath, 'utf-8');
            const centralStats = await fs.stat(changelogPath);

            return {
              exists: true,
              format: 'both',
              legacy: {
                content: legacyContent,
                lastModified: legacyStats.mtime.toISOString(),
              },
              central: {
                content: centralContent,
                lastModified: centralStats.mtime.toISOString(),
              },
            };
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              return {
                exists: true,
                format: 'legacy-only',
                legacy: {
                  content: legacyContent,
                  lastModified: legacyStats.mtime.toISOString(),
                },
                central: {
                  exists: false,
                  message: 'Central changelog not found',
                },
              };
            }
            throw error;
          }
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            // Try central only if format allows it
            if (returnFormat !== 'legacy') {
              try {
                const centralContent = await fs.readFile(changelogPath, 'utf-8');
                const centralStats = await fs.stat(changelogPath);

                return {
                  exists: true,
                  format: 'central-only',
                  central: {
                    content: centralContent,
                    lastModified: centralStats.mtime.toISOString(),
                  },
                };
              } catch (centralError: any) {
                if (centralError.code === 'ENOENT') {
                  return {
                    exists: false,
                    content: null,
                    lastModified: null,
                  };
                }
                throw centralError;
              }
            }

            return {
              exists: false,
              content: null,
              lastModified: null,
            };
          }
          throw error;
        }
      } else {
        // Return central changelog only
        try {
          const centralContent = await fs.readFile(changelogPath, 'utf-8');
          const centralStats = await fs.stat(changelogPath);

          return {
            exists: true,
            format: 'central',
            content: centralContent,
            lastModified: centralStats.mtime.toISOString(),
          };
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            return {
              exists: false,
              content: null,
              lastModified: null,
            };
          }
          throw error;
        }
      }
    } catch (error: any) {
      fastify.log.error('Failed to read changelog:', error);
      return reply.code(500).send({
        error: 'Failed to read changelog',
        code: 'CHANGELOG_READ_ERROR',
        details: env.NODE_ENV === 'development' ? error.message : undefined,
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
      const docs = [];

      // Check shared docs (from frontend and backend - all in docs/shared now)
      try {
        const sharedFiles = await fs.readdir(docsDir);
        for (const filename of sharedFiles) {
          // Skip CHANGELOG.md (has its own endpoint)
          if (filename === 'CHANGELOG.md') continue;

          const filePath = join(docsDir, filename);
          const stats = await fs.stat(filePath);

          if (stats.isFile() && filename.endsWith('.md')) {
            // Determine source based on filename patterns
            const isFrontendDoc = filename.includes('FRONTEND') ||
                                  filename.includes('FOR_BACKEND') ||
                                  filename.includes('OAUTH_CONTEXT') ||
                                  filename.includes('MULTI_STEP') ||
                                  filename.includes('USERNAME_VALIDATION');

            docs.push({
              filename,
              source: isFrontendDoc ? 'frontend' : 'backend',
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              path: `/api/dev/docs/${filename}`,
            });
          }
        }
      } catch (error) {
        // Shared directory doesn't exist or is empty
        fastify.log.warn('docs/shared directory not found or empty');
      }

      // Also include CHANGELOG.md as a special entry
      try {
        const changelogStats = await fs.stat(changelogPath);
        docs.push({
          filename: 'CHANGELOG.md',
          source: 'both',
          size: changelogStats.size,
          lastModified: changelogStats.mtime.toISOString(),
          path: '/api/dev/changelog?format=central',
          special: true,
        });
      } catch (error) {
        // Changelog doesn't exist yet
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
      let source: 'backend' | 'frontend' | 'both';
      let stats: any;

      // All docs are now in docs/shared
      const sharedPath = join(docsDir, filename);
      content = await fs.readFile(sharedPath, 'utf-8');
      stats = await fs.stat(sharedPath);

      // Determine source based on filename patterns
      const isFrontendDoc = filename.includes('FRONTEND') ||
                            filename.includes('FOR_BACKEND') ||
                            filename.includes('OAUTH_CONTEXT') ||
                            filename.includes('MULTI_STEP') ||
                            filename.includes('USERNAME_VALIDATION');

      source = isFrontendDoc ? 'frontend' : 'backend';

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
