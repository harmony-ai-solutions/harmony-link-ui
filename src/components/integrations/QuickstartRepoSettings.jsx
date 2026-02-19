import React, { useState, useEffect } from 'react';
import { setQuickstartRepoPath } from '../../services/management/integrationsService.js';
import DirectoryBrowserModal from './DirectoryBrowserModal';
import { openSystemUrl } from '../../services/management/systemService.js';

const QuickstartRepoSettings = ({ onPathSet, currentPath }) => {
  const [path, setPath] = useState(currentPath || '');
  const [isEditing, setIsEditing] = useState(!currentPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDirectoryBrowser, setShowDirectoryBrowser] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  useEffect(() => {
    setPath(currentPath || '');
    setIsEditing(!currentPath);
  }, [currentPath]);

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await setQuickstartRepoPath(path);
      onPathSet(path);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to set quickstart repo path:', err);
      setError(err.message || 'Failed to set path.');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = () => {
    setShowDirectoryBrowser(true);
  };

  const handlePathSelected = (selectedPath) => {
    setPath(selectedPath);
    setShowDirectoryBrowser(false);
  };

  const handleOpenGitHub = async () => {
    setGithubLoading(true);
    try {
      await openSystemUrl('https://github.com/harmony-ai-solutions/quickstart');
    } catch (err) {
      console.error('Failed to open GitHub repository:', err);
      setError(err.message || 'Failed to open GitHub repository.');
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <>
      <div className="integration-row">
        {/* Accent tint overlay */}
        <div className="integration-row-tint" />

        {/* Left accent stripe */}
        <div className="integration-row-stripe" />

        {/* ── Header Row ─────────────────────────────────────────────── */}
        <div className="relative flex items-center gap-3 pl-5 pr-4 py-3">

          {/* Identity */}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="integration-row-name text-sm font-bold leading-tight break-words">
              Quickstart Repository
            </span>
            <span className="text-xs leading-tight mt-0.5 break-words" style={{ color: 'var(--color-text-muted)' }}>
              Local path to the Harmony AI Quickstart repository
            </span>
          </div>

          {/* GitHub button */}
          <button
            onClick={handleOpenGitHub}
            disabled={githubLoading}
            className="btn-website-link py-1 px-3 text-xs rounded flex-shrink-0 disabled:opacity-50"
            title="Open GitHub repository"
          >
            {githubLoading ? '…' : '🌐 GitHub'}
          </button>
        </div>

        {/* ── Path Configuration Area ─────────────────────────────────── */}
        <div
          className="relative px-5 py-3"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}
        >
          {isEditing ? (
            /* Editing state */
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="Enter path to quickstart repository (e.g., D:/projects/quickstart)"
                  className="input-field flex-1 text-sm"
                />
                <button
                  onClick={handleBrowse}
                  disabled={loading}
                  className="instance-action-btn flex-shrink-0 disabled:opacity-50"
                >
                  Browse
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading || !path}
                  className="instance-action-btn-success flex-shrink-0 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Save'}
                </button>
              </div>
              {error && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {error}
                </p>
              )}
            </div>
          ) : (
            /* Display state */
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-medium flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Path:
              </span>
              <input
                type="text"
                value={path || 'Not configured'}
                disabled
              className="input-field flex-1 font-mono text-xs opacity-90 cursor-default"
                style={{ color: 'var(--color-accent-primary)' }}
              />
              <button
                onClick={() => setIsEditing(true)}
                className="instance-action-btn flex-shrink-0"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Directory Browser Modal */}
      <DirectoryBrowserModal
        isOpen={showDirectoryBrowser}
        onClose={() => setShowDirectoryBrowser(false)}
        onPathSelected={handlePathSelected}
        initialPath={path}
      />
    </>
  );
};

export default QuickstartRepoSettings;
